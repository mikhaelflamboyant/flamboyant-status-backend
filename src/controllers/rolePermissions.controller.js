const prisma = require('../lib/prisma')
const logger = require('../lib/logger')
const { isTIManager } = require('../services/approvals.service')

const getPermissions = async (req, res) => {
  try {
    if (!isTIManager(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para acessar permissões' })
    }

    const rows = await prisma.rolePermission.findMany({
      orderBy: [{ role: 'asc' }, { permission: 'asc' }]
    })

    return res.status(200).json(rows)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar permissões' })
  }
}

const updatePermission = async (req, res) => {
  try {
    if (!isTIManager(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para alterar permissões' })
    }

    const { role, permission, enabled } = req.body

    if (!role || !permission || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Dados inválidos' })
    }

    const updated = await prisma.rolePermission.upsert({
      where: { role_permission: { role, permission } },
      update: { enabled },
      create: { role, permission, enabled },
    })

    return res.status(200).json(updated)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao salvar permissão' })
  }
}

module.exports = { getPermissions, updatePermission }