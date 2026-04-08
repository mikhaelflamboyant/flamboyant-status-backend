const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')
const prisma = new PrismaClient()

const TI_AREA = 'Tecnologia da Informação'
const ALLOWED_ROLES = ['ANALISTA_MASTER', 'GERENTE', 'COORDENADOR', 'ANALISTA', 'SUPERVISOR', 'DIRETOR']

const canManageTokens = (user) => {
  return user.area === TI_AREA && ALLOWED_ROLES.includes(user.role)
}

const listTokens = async (req, res) => {
  try {
    if (!canManageTokens(req.user)) {
      return res.status(403).json({ error: 'Sem permissão' })
    }

    const tokens = await prisma.apiToken.findMany({
      where: { active: true },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' }
    })

    return res.status(200).json(tokens)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar tokens' })
  }
}

const listAllTokens = async (req, res) => {
  try {
    const HISTORY_ROLES = ['ANALISTA_MASTER', 'GERENTE', 'COORDENADOR']

    if (!canManageTokens(req.user) || !HISTORY_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' })
    }

    const tokens = await prisma.apiToken.findMany({
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' }
    })

    return res.status(200).json(tokens)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar histórico de tokens' })
  }
}

const createToken = async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar token' })
  }
}

const revokeToken = async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao revogar token' })
  }
}

module.exports = { listTokens, listAllTokens, createToken, revokeToken }