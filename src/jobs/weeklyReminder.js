const cron = require('node-cron')
const prisma = require('../lib/prisma')
const { sendWeeklyReminderEmail } = require('../services/email.service')

const startWeeklyReminderJob = () => {
  cron.schedule('0 9 * * 5', async () => {
    console.log('[CRON] Rodando lembrete semanal...')
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const activeProjects = await prisma.project.findMany({
        where: {
          archived: false,
          current_phase: { notIn: ['ENTREGUE', 'SUPORTE', 'BACKLOG'] }
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
            if (!member.user) continue
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
  }, { timezone: 'America/Sao_Paulo' })

  cron.schedule('0 1 * * *', async () => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const projects = await prisma.project.findMany({
        where: {
          current_phase: 'SUPORTE',
          archived: false,
          delivered_at: { lte: thirtyDaysAgo }
        }
      })

      for (const project of projects) {
        await prisma.$executeRaw`
          UPDATE "Project"
          SET "current_phase" = 'ENTREGUE',
              "archived" = true,
              "archived_at" = NOW(),
              "completion_pct" = 100
          WHERE "id" = ${project.id}
        `
      }

      if (projects.length > 0) {
        console.log(`[CRON] ${projects.length} projeto(s) movidos para ENTREGUE`)
      }
    } catch (err) {
      console.error('[CRON] Erro ao mover projetos para ENTREGUE:', err)
    }
  }, { timezone: 'America/Sao_Paulo' })

  cron.schedule('0 1 * * *', async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const result = await prisma.$executeRaw`
        UPDATE "Project"
        SET "traffic_light" = 'VERMELHO'
        WHERE "go_live" < ${today}
          AND "traffic_light" = 'VERDE'
          AND "archived" = false
          AND "origin" = 'NORMAL'
          AND "current_phase" NOT IN ('BACKLOG', 'SUPORTE', 'CANCELADO', 'ENTREGUE')
      `
      if (result > 0) {
        console.log(`[CRON] ${result} projeto(s) com farol atualizado para VERMELHO`)
      }
    } catch (err) {
      console.error('[CRON] Erro ao atualizar faróis:', err)
    }
  }, { timezone: 'America/Sao_Paulo' })

  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const sevenDaysFromNow = new Date(today)
      sevenDaysFromNow.setDate(today.getDate() + 7)

      const projects = await prisma.project.findMany({
        where: {
          archived: false,
          origin: 'NORMAL',
          current_phase: { notIn: ['ENTREGUE', 'SUPORTE', 'BACKLOG', 'CANCELADO'] },
          go_live: {
            gte: today,
            lte: sevenDaysFromNow,
          }
        },
        include: {
          requesters: {
            where: { type: 'RESPONSAVEL' },
            include: { user: { select: { id: true, name: true } } }
          }
        }
      })

      for (const project of projects) {
        const daysUntil = Math.ceil((new Date(project.go_live) - today) / (1000 * 60 * 60 * 24))

        for (const requester of project.requesters) {
          if (!requester.user_id) continue

          const alreadyNotified = await prisma.notification.findFirst({
            where: {
              user_id: requester.user_id,
              type: 'PROXIMO_GO_LIVE',
              link: `/projetos/${project.id}`,
              created_at: { gte: today }
            }
          })

          if (alreadyNotified) continue

          await prisma.notification.create({
            data: {
              user_id: requester.user_id,
              type: 'PROXIMO_GO_LIVE',
              title: `Go-live em ${daysUntil} dia${daysUntil !== 1 ? 's' : ''}`,
              body: `O projeto "${project.title}" tem go-live previsto para ${new Date(project.go_live).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}. Verifique se está tudo pronto.`,
              link: `/projetos/${project.id}`,
            }
          })
        }
      }

      if (projects.length > 0) {
        console.log(`[CRON] Notificações de go-live próximo enviadas para ${projects.length} projeto(s)`)
      }
    } catch (err) {
      console.error('[CRON] Erro ao notificar go-lives próximos:', err)
    }
  }, { timezone: 'America/Sao_Paulo' })

  console.log('[CRON] Jobs iniciados - lembretes às sextas 9h, SUPORTE diário à 1h, go-live próximo diário às 9h')
}

module.exports = { startWeeklyReminderJob }