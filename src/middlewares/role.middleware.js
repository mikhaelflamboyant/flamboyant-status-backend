const ROLE_HIERARCHY = {
  SUPERINTENDENTE: 5,
  GERENTE: 4,
  COORDENADOR: 3,
  ANALISTA_MASTER: 2,
  ANALISTA: 1,
}

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão' })
    }
    next()
  }
}

const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0
    const minLevel = ROLE_HIERARCHY[minRole] || 0
    if (userLevel < minLevel) {
      return res.status(403).json({ error: 'Sem permissão' })
    }
    next()
  }
}

module.exports = { requireRole, requireMinRole, ROLE_HIERARCHY }