const prisma = require('../lib/prisma')
const logger = require('../lib/logger')
const { canAccessManagement } = require('./management.controller')

const TI_AREA = 'Tecnologia da Informação'

const ROLE_LABELS = {
  ANALISTA_MASTER: 'Analista Master',
  ANALISTA_TESTADOR: 'Analista Testador',
  SUPERINTENDENTE: 'Superintendente',
  DIRETOR: 'Diretor',
  GERENTE: 'Gerente',
  COORDENADOR: 'Coordenador',
  SUPERVISOR: 'Supervisor',
  ANALISTA: 'Analista',
  ESTAGIARIO: 'Estagiário(a)',
}

const TI_USER_FILTER = {
  OR: [
    { area: TI_AREA },
    { role: { in: ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'] } },
  ],
}

function periodStart(period) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === 'today') return start
  if (period === 'last30') { start.setDate(start.getDate() - 30); return start }
  start.setDate(start.getDate() - 7)
  return start
}

const getRecentActions = async (req, res) => {
  try {
    const requester = req.user
    if (!canAccessManagement(requester)) {
      return res.status(403).json({ error: 'Sem permissão para acessar as últimas ações' })
    }

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size) || 20))
    const { user_id, project_id, action_type, period = 'last7' } = req.query

    const where = {
      created_at: { gte: periodStart(period) },
      user: TI_USER_FILTER,
      ...(user_id ? { user_id } : {}),
      ...(project_id ? { project_id } : {}),
      ...(action_type ? { action_type } : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true, area: true } } },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ])

    const actions = rows.map(row => ({
      id: row.id,
      action_type: row.action_type,
      description: row.description,
      project_id: row.project_id,
      project_name: row.project_name || '',
      previous_value: row.previous_value,
      new_value: row.new_value,
      created_at: row.created_at,
      user: {
        id: row.user.id,
        name: row.user.name,
        role: row.user.role,
        role_label: ROLE_LABELS[row.user.role] || row.user.role,
      },
    }))

    return res.status(200).json({
      actions,
      total,
      total_pages: Math.ceil(total / pageSize),
      page,
      has_more: page * pageSize < total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar as últimas ações' })
  }
}

const getRecentActionFilters = async (req, res) => {
  try {
    const requester = req.user
    if (!canAccessManagement(requester)) {
      return res.status(403).json({ error: 'Sem permissão para acessar as últimas ações' })
    }

    const [userRows, projectRows] = await Promise.all([
      prisma.activityLog.findMany({
        where: { user: TI_USER_FILTER },
        select: { user: { select: { id: true, name: true, role: true } } },
        distinct: ['user_id'],
      }),
      prisma.activityLog.findMany({
        where: { NOT: { project_id: null }, user: TI_USER_FILTER },
        select: { project_id: true, project_name: true },
        distinct: ['project_id'],
      }),
    ])

    const users = userRows
      .map(r => ({
        id: r.user.id,
        name: r.user.name,
        role: r.user.role,
        role_label: ROLE_LABELS[r.user.role] || r.user.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const projects = projectRows
      .map(r => ({ id: r.project_id, name: r.project_name || 'Projeto sem nome' }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return res.status(200).json({ users, projects })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar filtros das últimas ações' })
  }
}

module.exports = { getRecentActions, getRecentActionFilters }