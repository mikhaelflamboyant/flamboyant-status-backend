const prisma = require('../lib/prisma')

const TI_AREA = 'Tecnologia da Informação'

const GATED_ROLES = ['ESTAGIARIO', 'ANALISTA']

async function hasPermission(user, key) {
  if (user.area !== TI_AREA || !GATED_ROLES.includes(user.role)) return true

  const row = await prisma.rolePermission.findUnique({
    where: { role_permission: { role: user.role, permission: key } }
  })

  if (!row) return true

  return row.enabled
}

module.exports = { hasPermission, GATED_ROLES }