const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const createRisk = async (req, res) => {
  const { status_update_id } = req.params
  const { title, description, mitigation } = req.body
  const requester = req.user

  if (!title || !description || !mitigation) {
    return res.status(400).json({ error: 'Campos obrigatórios: title, description, mitigation' })
  }

  const statusUpdate = await prisma.statusUpdate.findUnique({
    where: { id: status_update_id },
    include: {
      project: { include: { members: true } }
    }
  })

  if (!statusUpdate) {
    return res.status(404).json({ error: 'Atualização de status não encontrada' })
  }

  const isOwner = statusUpdate.project.owner_id === requester.id
  const isMember = statusUpdate.project.members.some(m => m.user_id === requester.id)
  const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)

  if (!isOwner && !isMember && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para adicionar riscos neste projeto' })
  }

  const risk = await prisma.risk.create({
    data: { status_update_id, title, description, mitigation }
  })

  return res.status(201).json(risk)
}

const updateRisk = async (req, res) => {
  const { id } = req.params
  const { title, description, mitigation } = req.body
  const requester = req.user

  const risk = await prisma.risk.findUnique({
    where: { id },
    include: {
      status_update: {
        include: { project: { include: { members: true } } }
      }
    }
  })

  if (!risk) {
    return res.status(404).json({ error: 'Risco não encontrado' })
  }

  const isOwner = risk.status_update.project.owner_id === requester.id
  const isMember = risk.status_update.project.members.some(m => m.user_id === requester.id)
  const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)

  if (!isOwner && !isMember && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para editar este risco' })
  }

  const updated = await prisma.risk.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(mitigation && { mitigation })
    }
  })

  return res.status(200).json(updated)
}

const deleteRisk = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const risk = await prisma.risk.findUnique({
    where: { id },
    include: {
      status_update: {
        include: { project: { include: { members: true } } }
      }
    }
  })

  if (!risk) {
    return res.status(404).json({ error: 'Risco não encontrado' })
  }

  const isOwner = risk.status_update.project.owner_id === requester.id
  const isMember = risk.status_update.project.members.some(m => m.user_id === requester.id)
  const isPrivileged = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)

  if (!isOwner && !isMember && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para excluir este risco' })
  }

  await prisma.risk.delete({ where: { id } })

  return res.status(200).json({ message: 'Risco excluído com sucesso' })
}

module.exports = { createRisk, updateRisk, deleteRisk }