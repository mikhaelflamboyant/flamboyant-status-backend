const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

const TI_AREA = 'Tecnologia da Informação'
const ALLOWED_ROLES = ['ANALISTA_MASTER', 'GERENTE', 'COORDENADOR', 'ANALISTA', 'SUPERVISOR', 'DIRETOR']

const canManageTokens = (user) => {
  return user.area === TI_AREA && ALLOWED_ROLES.includes(user.role)
}

const listTokens = async (req, res) => {
  if (!canManageTokens(req.user)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }

  const tokens = await prisma.apiToken.findMany({
    where: { active: true },
    include: { creator: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' }
  })

  return res.status(200).json(tokens)
}

const createToken = async (req, res) => {
  const { name } = req.body

  if (!canManageTokens(req.user)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório' })
  }

  const token = `flb_${crypto.randomBytes(32).toString('hex')}`

  const apiToken = await prisma.apiToken.create({
    data: { name, token, created_by: req.user.id },
    include: { creator: { select: { id: true, name: true } } }
  })

  return res.status(201).json(apiToken)
}

const revokeToken = async (req, res) => {
  const { id } = req.params

  if (!canManageTokens(req.user)) {
    return res.status(403).json({ error: 'Sem permissão' })
  }

  const token = await prisma.apiToken.findUnique({ where: { id } })
  if (!token) return res.status(404).json({ error: 'Token não encontrado' })

  await prisma.apiToken.update({
    where: { id },
    data: { active: false }
  })

  return res.status(200).json({ message: 'Token revogado com sucesso' })
}

module.exports = { listTokens, createToken, revokeToken }