const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { notifyNewProject } = require('../services/notifications.service')

const freshserviceWebhook = async (req, res) => {
  try {
    const payload = req.body

    const title = payload.subject || payload.title || 'Projeto via FreshService'
    const description = payload.description_text || payload.description || 'Projeto criado via FreshService'
    const requesterEmail = payload.requester?.email || payload.email || null
    const ticketId = payload.id || payload.ticket_id || null

    const goLive = new Date()
    goLive.setMonth(goLive.getMonth() + 1)

    const project = await prisma.project.create({
      data: {
        title,
        area: '',
        requester_name: payload.requester?.name || '',
        execution_type: 'INTERNA',
        priority: 3,
        description,
        go_live: null,
        traffic_light: 'VERDE',
        current_phase: 'RECEBIDA',
        completion_pct: 0,
        origin: 'FRESHSERVICE',
        freshservice_ticket_id: ticketId ? String(ticketId) : null,
      }
    })

    if (requesterEmail) {
      const requester = await prisma.user.findUnique({
        where: { email: requesterEmail }
      })
      if (requester) {
        await prisma.projectRequester.create({
          data: { project_id: project.id, user_id: requester.id, type: 'SOLICITANTE' }
        })
      }
    }

    const managers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['SUPERINTENDENTE', 'ANALISTA_MASTER'] }
      }
    })

    const areaManagers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['GERENTE', 'COORDENADOR'] },
        area: 'Tecnologia da Informação'
      }
    })

    await notifyNewProject(project, [...managers, ...areaManagers])

    return res.status(200).json({ message: 'Projeto criado com sucesso', project_id: project.id })
  } catch (err) {
    console.error('Webhook FreshService erro:', err)
    return res.status(500).json({ error: 'Erro ao processar webhook' })
  }
}

module.exports = { freshserviceWebhook }