const cron = require('node-cron')
const { PrismaClient } = require('@prisma/client')
const { sendWeeklyReminderEmail } = require('../services/email.service')

const prisma = new PrismaClient()

const startWeeklyReminderJob = () => {
  cron.schedule('0 9 * * 5', async () => {
    console.log('[CRON] Rodando lembrete semanal...')

    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const activeProjects = await prisma.project.findMany({
        where: {
          archived: false,
          current_phase: { not: 'ENTREGUE' }
        },
        include: {
          owner: true,
          members: { include: { user: true } }
        }
      })

      const usersToNotify = new Map()

      for (const project of activeProjects) {
        const lastUpdate = await prisma.statusUpdate.findFirst({
          where: { project_id: project.id },
          orderBy: { created_at: 'desc' }
        })

        const needsUpdate = !lastUpdate || lastUpdate.created_at < oneWeekAgo

        if (needsUpdate) {
          if (project.owner) {
            usersToNotify.set(project.owner.id, {
              email: project.owner.email,
              name: project.owner.name
            })
          }

          for (const member of project.members) {
            usersToNotify.set(member.user.id, {
              email: member.user.email,
              name: member.user.name
            })
          }
        }
      }

      for (const [, user] of usersToNotify) {
        await sendWeeklyReminderEmail(user.email, user.name)
        console.log(`[CRON] E-mail enviado para ${user.email}`)
      }

      console.log(`[CRON] Lembrete enviado para ${usersToNotify.size} usuário(s)`)
    } catch (err) {
      console.error('[CRON] Erro ao enviar lembretes:', err)
    }
  }, {
    timezone: 'America/Sao_Paulo'
  })

  console.log('[CRON] Job de lembrete semanal iniciado — sextas-feiras às 9h')
}

module.exports = { startWeeklyReminderJob }