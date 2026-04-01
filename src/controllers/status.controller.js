const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { notifyNewStatus } = require('../services/notifications.service')

const listStatusUpdates = async (req, res) => {
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
}

const getStatusUpdateById = async (req, res) => {
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
}

const createStatusUpdate = async (req, res) => {
  const { project_id } = req.params
  const { description, highlights, next_steps } = req.body
  const requester = req.user

  if (!description || !highlights || !next_steps) {
    return res.status(400).json({ error: 'Campos obrigatórios: description, highlights, next_steps' })
  }

  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      members: true,
      requesters: true
    }
  })

  if (!project) {
    return res.status(404).json({ error: 'Projeto não encontrado' })
  }

  const isOwner = project.owner_id === requester.id
  const isMember = project.members.some(m => m.user_id === requester.id)
  const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'SUPERINTENDENTE'].includes(requester.role)

  if (!isOwner && !isMember && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para atualizar este projeto' })
  }

  const update = await prisma.statusUpdate.create({
    data: {
      project_id,
      author_id: requester.id,
      description,
      highlights,
      next_steps
    },
    include: {
      author: { select: { id: true, name: true } },
      risks: true
    }
  })

  const linkedUserIds = [
    ...project.requesters.map(r => r.user_id),
    ...project.members.map(m => m.user_id),
  ].filter(uid => uid !== requester.id)

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
      area: { in: project.area.split(', ') }
    }
  })

  const linkedUsers = await prisma.user.findMany({
    where: { id: { in: linkedUserIds }, status: 'ATIVO' }
  })

  const allToNotify = [
    ...linkedUsers,
    ...managers,
    ...areaManagers,
  ].filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)

  await notifyNewStatus(project, update, allToNotify)

  return res.status(201).json(update)
}

const updateStatusUpdate = async (req, res) => {
  const { project_id, id } = req.params
  const { description, highlights, next_steps } = req.body
  const requester = req.user

  const update = await prisma.statusUpdate.findFirst({
    where: { id, project_id }
  })

  if (!update) {
    return res.status(404).json({ error: 'Atualização não encontrada' })
  }

  const isAuthor = update.author_id === requester.id
  const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'SUPERINTENDENTE'].includes(requester.role)

  if (!isAuthor && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para editar esta atualização' })
  }

  const updated = await prisma.statusUpdate.update({
    where: { id },
    data: {
      ...(description && { description }),
      ...(highlights && { highlights }),
      ...(next_steps && { next_steps })
    },
    include: {
      author: { select: { id: true, name: true } },
      risks: true
    }
  })

  return res.status(200).json(updated)
}

module.exports = { listStatusUpdates, getStatusUpdateById, createStatusUpdate, updateStatusUpdate }