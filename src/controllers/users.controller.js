const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const HIERARCHY = {
  ANALISTA_MASTER: 7,
  SUPERINTENDENTE: 6,
  DIRETOR: 5,
  GERENTE: 4,
  COORDENADOR: 3,
  SUPERVISOR: 2,
  ANALISTA: 1,
}

const ALLOWED_ROLES = ['ANALISTA_MASTER', 'SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR', 'ANALISTA']
const CAN_APPROVE = ['ANALISTA_MASTER', 'GERENTE', 'COORDENADOR']
const TI_AREA = 'Tecnologia da Informação'

const listUsers = async (req, res) => {
  try {
    const { area } = req.query
    const where = { status: 'ATIVO' }
    if (area) where.area = area

    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, area: true, created_at: true }
    })
    return res.status(200).json(users)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar usuários' })
  }
}

const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, created_at: true }
    })

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

    return res.status(200).json(user)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar usuário' })
  }
}

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const requester = req.user

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido' })
    }

    if (!CAN_APPROVE.includes(requester.role)) {
      return res.status(403).json({ error: 'Sem permissão para alterar perfis' })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' })

    if ((HIERARCHY[requester.role] || 0) <= (HIERARCHY[role] || 0) && requester.role !== 'ANALISTA_MASTER') {
      return res.status(403).json({ error: 'Você não pode atribuir um perfil igual ou superior ao seu' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    })

    return res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao atualizar perfil' })
  }
}

const listPendingUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'PENDENTE' },
      select: { id: true, email: true, name: true, role: true, area: true, created_at: true, status: true }
    })
    return res.status(200).json(users)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar usuários pendentes' })
  }
}

const approveUser = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    if (!CAN_APPROVE.includes(requester.role) || requester.area !== TI_AREA) {
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
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao aprovar usuário' })
  }
}

const rejectUser = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    if (!CAN_APPROVE.includes(requester.role) || requester.area !== TI_AREA) {
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
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao recusar usuário' })
  }
}

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    if (!CAN_APPROVE.includes(requester.role)) {
      return res.status(403).json({ error: 'Sem permissão para excluir usuários' })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' })

    if ((HIERARCHY[requester.role] || 0) <= (HIERARCHY[target.role] || 0) && requester.role !== 'ANALISTA_MASTER') {
      return res.status(403).json({ error: 'Você não pode excluir um usuário com perfil igual ou superior ao seu' })
    }

    if (requester.role !== 'ANALISTA_MASTER') {
      const requesterUser = await prisma.user.findUnique({ where: { id: requester.id } })
      if (requesterUser.area !== target.area) {
        return res.status(403).json({ error: 'Você só pode excluir usuários da mesma área que a sua' })
      }
    }

    await prisma.user.delete({ where: { id } })
    return res.status(200).json({ message: 'Usuário excluído com sucesso' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao excluir usuário' })
  }
}

module.exports = { listUsers, getUserById, updateUserRole, listPendingUsers, approveUser, rejectUser, deleteUser }