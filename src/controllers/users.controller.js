const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const listUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'ATIVO' },
    select: { id: true, email: true, name: true, role: true, created_at: true }
  })
  return res.status(200).json(users)
}

const getUserById = async (req, res) => {
  const { id } = req.params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, created_at: true }
  })

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
  }

  return res.status(200).json(user)
}

const updateUserRole = async (req, res) => {
  const { id } = req.params
  const { role } = req.body
  const requester = req.user

  const allowedRoles = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA']

  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Perfil inválido' })
  }

  if (!['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR'].includes(requester.role)) {
    return res.status(403).json({ error: 'Sem permissão para alterar perfis' })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, name: true, role: true }
  })

  return res.status(200).json(updated)
}

const listPendingUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'PENDENTE' },
    select: { id: true, email: true, name: true, role: true, created_at: true, status: true }
  })
  return res.status(200).json(users)
}

const approveUser = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const allowed = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER']
  if (!allowed.includes(requester.role)) {
    return res.status(403).json({ error: 'Sem permissão para aprovar usuários' })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'ATIVO' },
    select: { id: true, email: true, name: true, role: true, status: true }
  })

  return res.status(200).json(updated)
}

const rejectUser = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const allowed = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER']
  if (!allowed.includes(requester.role)) {
    return res.status(403).json({ error: 'Sem permissão para recusar usuários' })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

  const updated = await prisma.user.update({
    where: { id },
    data: { status: 'RECUSADO' },
    select: { id: true, email: true, name: true, role: true, status: true }
  })

  return res.status(200).json(updated)
}

const deleteUser = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const HIERARCHY = {
    SUPERINTENDENTE: 5,
    GERENTE: 4,
    COORDENADOR: 3,
    ANALISTA_MASTER: 2,
    ANALISTA: 1,
  }

  const CAN_DELETE = {
    SUPERINTENDENTE: ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA'],
    GERENTE: ['COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA'],
    COORDENADOR: ['ANALISTA_MASTER', 'ANALISTA'],
    ANALISTA_MASTER: ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA'],
    ANALISTA: [],
  }

  if (!CAN_DELETE[requester.role]?.length) {
    return res.status(403).json({ error: 'Sem permissão para excluir usuários' })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado' })

  if (!CAN_DELETE[requester.role].includes(target.role)) {
    return res.status(403).json({ error: 'Você não pode excluir um usuário com perfil igual ou superior ao seu' })
  }

  await prisma.user.delete({ where: { id } })
  return res.status(200).json({ message: 'Usuário excluído com sucesso' })
}

module.exports = { listUsers, getUserById, updateUserRole, listPendingUsers, approveUser, rejectUser, deleteUser }