const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { notifyNewStatus } = require('../services/notifications.service')

const listStatusUpdates = async (req, res) => {
  try {
    const { project_id } = req.params

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const updates = await prisma.statusUpdate.findMany({
      where: { project_id },
      orderBy: { created_at: 'desc' },
      include: {
        author: { select: { id: true, name: true } },
        risks: true
      }
    })

    return res.status(200).json(updates)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar status reports' })
  }
}

const getStatusUpdateById = async (req, res) => {
  try {
    const { project_id, id } = req.params

    const update = await prisma.statusUpdate.findFirst({
      where: { id, project_id },
      include: {
        author: { select: { id: true, name: true } },
        risks: true
      }
    })

    if (!update) {
      return res.status(404).json({ error: 'Atualização não encontrada' })
    }

    return res.status(200).json(update)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar status report' })
  }
}

const createStatusUpdate = async (req, res) => {
  try {
    const { project_id } = req.params
    const { description, highlights, next_steps, reported_by_name } = req.body
    const requester = req.user

    if (!description) {
      return res.status(400).json({ error: 'Campo obrigatório: description' })
    }
    if (!highlights && !next_steps) {
      return res.status(400).json({ error: 'Preencha pelo menos destaques ou próximos passos' })
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { members: true, requesters: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isOwner = project.owner_id === requester.id
    const isMember = project.members.some(m => m.user_id === requester.id)
    const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'SUPERINTENDENTE'].includes(requester.role)

    if (!isOwner && !isMember && !isPrivileged) {
      return res.status(403).json({ error: 'Sem permissão para atualizar este projeto' })
    }

    const update = await prisma.statusUpdate.create({
      data: { project_id, author_id: requester.id, description, highlights: highlights || '', next_steps: next_steps || '', reported_by_name: reported_by_name || null },
      include: {
        author: { select: { id: true, name: true } },
        risks: true
      }
    })

    const linkedUserIds = [
      ...project.requesters.map(r => r.user_id),
      ...project.members.map(m => m.user_id),
    ].filter(uid => uid && uid !== requester.id)

    const tiManagers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'] }
      }
    })

    const tiAreaManagers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['GERENTE', 'COORDENADOR', 'SUPERINTENDENTE'] },
        area: 'Tecnologia da Informação'
      }
    })

    const areaManagers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['GERENTE', 'COORDENADOR', 'SUPERINTENDENTE'] },
        area: { in: project.area.split(', ') },
        NOT: { area: 'Tecnologia da Informação' }
      }
    })

    const linkedUsers = await prisma.user.findMany({
      where: { id: { in: linkedUserIds }, status: 'ATIVO' }
    })

    const allToNotify = [
      ...linkedUsers, ...tiManagers, ...tiAreaManagers, ...areaManagers,
    ].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)

    await notifyNewStatus(project, update, allToNotify)

    return res.status(201).json(update)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar status report' })
  }
}

const updateStatusUpdate = async (req, res) => {
  try {
    const { project_id, id } = req.params
    const { description, highlights, next_steps, reported_by_name } = req.body
    const requester = req.user

    const update = await prisma.statusUpdate.findFirst({
      where: { id, project_id }
    })

    if (!update) {
      return res.status(404).json({ error: 'Atualização não encontrada' })
    }

    const isAuthor = update.author_id === requester.id
    const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'SUPERINTENDENTE'].includes(requester.role)

    if (!isAuthor && !isPrivileged) {
      return res.status(403).json({ error: 'Sem permissão para editar esta atualização' })
    }

    const updated = await prisma.statusUpdate.update({
      where: { id },
      data: {
        ...(description && { description }),
        ...(highlights !== undefined && { highlights }),
        ...(next_steps !== undefined && { next_steps }),
        ...(reported_by_name !== undefined && { reported_by_name }),
      },
      include: {
        author: { select: { id: true, name: true } },
        risks: true
      }
    })

    return res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao editar status report' })
  }
}

const deleteStatusUpdate = async (req, res) => {
  try {
    const { project_id, id } = req.params
    const requester = req.user

    const update = await prisma.statusUpdate.findFirst({ where: { id, project_id } })
    if (!update) return res.status(404).json({ error: 'Atualização não encontrada' })

    const isAuthor = update.author_id === requester.id
    const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'SUPERINTENDENTE'].includes(requester.role)

    if (!isAuthor && !isPrivileged) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta atualização' })
    }

    await prisma.statusUpdate.delete({ where: { id } })
    return res.status(200).json({ message: 'Status report excluído com sucesso' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao excluir status report' })
  }
}

module.exports = { listStatusUpdates, getStatusUpdateById, createStatusUpdate, updateStatusUpdate, deleteStatusUpdate }