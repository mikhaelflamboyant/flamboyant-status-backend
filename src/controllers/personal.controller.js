const prisma = require('../lib/prisma')
const logger = require('../lib/logger')

const TI_AREA = 'Tecnologia da Informação'
const EXECUTION_PHASES = ['DESENVOLVIMENTO', 'TESTES', 'VALIDACAO_SOLICITANTE']
const GO_LIVE_PHASES = ['RECEBIDA', 'ENTREVISTA_SOLICITANTE', 'LEVANTAMENTO_REQUISITOS', 'ANALISE_SOLUCAO', 'DESENVOLVIMENTO', 'TESTES', 'VALIDACAO_SOLICITANTE']

const isTI = (user) =>
  user.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(user.role)

function getCurrentWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToSaturday = day === 6 ? 0 : -(day + 1)
  const start = new Date(now)
  start.setDate(now.getDate() + diffToSaturday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getStatusReportTag(lastStatusDate) {
  const now = new Date()
  const day = now.getDay()
  const { start: weekStart } = getCurrentWeekRange()

  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(weekStart.getDate() - 7)

  const last = lastStatusDate ? new Date(lastStatusDate) : null

  if (last && last >= weekStart) return 'verde'
  if (!last || last < lastWeekStart) return 'vermelho'
  if (day === 5 || day === 6) return 'vermelho'
  if (day === 4) return 'amarelo'

  return 'verde'
}

async function filterProjectIds(projectIds, { project_id, phase } = {}) {
  let ids = projectIds
  if (project_id && ids.includes(project_id)) {
    ids = [project_id]
  } else if (project_id) {
    ids = []
  }
  if (phase && ids.length > 0) {
    const matching = await prisma.project.findMany({
      where: { id: { in: ids }, current_phase: phase },
      select: { id: true },
    })
    ids = matching.map(p => p.id)
  }
  return ids
}

async function getResponsibleProjectIds(userId) {
  const requesters = await prisma.projectRequester.findMany({
    where: {
      user_id: userId,
      type: 'RESPONSAVEL',
      project: {
        archived: false,
        current_phase: {
          notIn: ['BACKLOG', 'CANCELADO'],
        },
      },
    },
    select: { project_id: true },
  })
  return requesters.map(r => r.project_id)
}

const getPersonalDashboard = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const { project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    if (projectIds.length === 0) {
      return res.status(200).json({
        goLive: [], statusReports: [], scopeItems: [], tasks: [], feed: [],
        counts: { goLive: 0, statusReportsPending: 0, scopeItems: 0, tasks: 0 },
      })
    }

    const { start: weekStart, end: weekEnd } = getCurrentWeekRange()
    const now = new Date()
    const tenDaysFromNow = new Date(now)
    tenDaysFromNow.setDate(now.getDate() + 10)

    const goLiveProjects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        go_live: { lte: tenDaysFromNow },
        current_phase: { in: GO_LIVE_PHASES },
      },
      select: { id: true, title: true, go_live: true, current_phase: true },
      orderBy: { go_live: 'asc' },
      take: 3,
    })

    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds }, current_phase: { in: EXECUTION_PHASES } },
      select: {
        id: true, title: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true },
        },
      },
    })
    const statusReports = projects
      .map(p => ({
        project_id: p.id,
        project_title: p.title,
        last_status_at: p.status_updates[0]?.created_at || null,
        tag: getStatusReportTag(p.status_updates[0]?.created_at || null),
        launched_this_week: p.status_updates[0]?.created_at
          ? new Date(p.status_updates[0].created_at) >= weekStart
          : false,
      }))
      .sort((a, b) => {
        const order = { vermelho: 0, amarelo: 1, verde: 2 }
        return order[a.tag] - order[b.tag]
      })
      .slice(0, 3)

    const scopeItems = await prisma.scopeItem.findMany({
      where: {
        project_id: { in: projectIds },
        end_date: { lte: weekEnd },
        status: 'APROVADO',
        completion_date: null,
      },
      select: {
        id: true, title: true, end_date: true, completion_date: true,
        completion_pct: true, stage: true,
        project: { select: { id: true, title: true } },
      },
      orderBy: { end_date: 'asc' },
      take: 3,
    })

    const tasks = await prisma.task.findMany({
      where: {
        project_id: { in: projectIds },
        end_date: { lte: weekEnd },
        completed: false,
        OR: [
          { assignee_id: requester.id },
          { assignees: { some: { user_id: requester.id } } },
        ],
      },
      select: {
        id: true, title: true, end_date: true, completed: true,
        project: { select: { id: true, title: true } },
      },
      orderBy: { end_date: 'asc' },
      take: 3,
    })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const feed = await prisma.activityLog.findMany({
      where: {
        project_id: { in: projectIds },
        created_at: { gte: sevenDaysAgo },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
      take: 3,
    })

    const goLiveCount = await prisma.project.count({
      where: { id: { in: projectIds }, go_live: { lte: tenDaysFromNow }, current_phase: { in: GO_LIVE_PHASES } },
    })
    const statusPendingCount = projects.filter(p =>
      !p.status_updates[0]?.created_at ||
      new Date(p.status_updates[0].created_at) < weekStart
    ).length
    const scopeCount = await prisma.scopeItem.count({
      where: {
        project_id: { in: projectIds },
        end_date: { lte: weekEnd },
        status: 'APROVADO',
        completion_date: null,
      },
    })
    const taskCount = await prisma.task.count({
      where: {
        project_id: { in: projectIds },
        end_date: { lte: weekEnd },
        completed: false,
        OR: [
          { assignee_id: requester.id },
          { assignees: { some: { user_id: requester.id } } },
        ],
      },
    })

    return res.status(200).json({
      goLive: goLiveProjects,
      statusReports,
      scopeItems,
      tasks,
      feed,
      counts: {
        goLive: goLiveCount,
        statusReportsPending: statusPendingCount,
        scopeItems: scopeCount,
        tasks: taskCount,
      },
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar painel pessoal' })
  }
}

const getGoLive = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const { project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    const now = new Date()
    const tenDaysFromNow = new Date(now)
    tenDaysFromNow.setDate(now.getDate() + 10)

    const where = { id: { in: projectIds }, go_live: { lte: tenDaysFromNow }, current_phase: { in: GO_LIVE_PHASES } }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: { id: true, title: true, go_live: true, current_phase: true, traffic_light: true },
        orderBy: { go_live: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.project.count({ where }),
    ])

    return res.status(200).json({
      data: projects,
      page,
      totalPages: Math.ceil(total / pageSize),
      total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar go-lives' })
  }
}

const getStatusReports = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const { tab = 'pendentes', project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    const { start: weekStart } = getCurrentWeekRange()

    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds }, current_phase: { in: EXECUTION_PHASES } },
      select: {
        id: true, title: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true },
        },
      },
    })

    const mapped = projects.map(p => ({
      project_id: p.id,
      project_title: p.title,
      last_status_at: p.status_updates[0]?.created_at || null,
      tag: getStatusReportTag(p.status_updates[0]?.created_at || null),
      launched_this_week: p.status_updates[0]?.created_at
        ? new Date(p.status_updates[0].created_at) >= weekStart
        : false,
    }))

    const filtered = tab === 'concluidos'
      ? mapped.filter(p => p.launched_this_week)
      : mapped.filter(p => !p.launched_this_week)

    filtered.sort((a, b) => {
      const order = { vermelho: 0, amarelo: 1, verde: 2 }
      return order[a.tag] - order[b.tag]
    })

    const total = filtered.length
    const paginated = filtered.slice(skip, skip + pageSize)

    return res.status(200).json({
      data: paginated,
      page,
      totalPages: Math.ceil(total / pageSize),
      total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar status reports' })
  }
}

const getScopeItems = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const { tab = 'pendentes', project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange()

    const where = {
      project_id: { in: projectIds },
      end_date: { lte: weekEnd },
      status: 'APROVADO',
      ...(tab === 'pendentes' ? { completion_date: null } : { completion_date: { not: null } }),
    }

    const [items, total] = await Promise.all([
      prisma.scopeItem.findMany({
        where,
        select: {
          id: true, title: true, end_date: true, completion_date: true,
          completion_pct: true, stage: true,
          project: { select: { id: true, title: true } },
        },
        orderBy: { end_date: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.scopeItem.count({ where }),
    ])

    return res.status(200).json({
      data: items,
      page,
      totalPages: Math.ceil(total / pageSize),
      total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar atividades' })
  }
}

const getTasks = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const { tab = 'pendentes', project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange()

    const where = {
      project_id: { in: projectIds },
      end_date: { lte: weekEnd },
      completed: tab === 'concluidos',
      OR: [
        { assignee_id: requester.id },
        { assignees: { some: { user_id: requester.id } } },
      ],
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: {
          id: true, title: true, end_date: true, completed: true,
          project: { select: { id: true, title: true } },
          assignees: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { end_date: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ])

    return res.status(200).json({
      data: tasks,
      page,
      totalPages: Math.ceil(total / pageSize),
      total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar tarefas' })
  }
}

const getFeed = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })

    const page = parseInt(req.query.page) || 1
    const pageSize = 10
    const skip = (page - 1) * pageSize

    const { project_id, phase } = req.query
    const allProjectIds = await getResponsibleProjectIds(requester.id)
    const projectIds = await filterProjectIds(allProjectIds, { project_id, phase })
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const where = {
      project_id: { in: projectIds },
      created_at: { gte: sevenDaysAgo },
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
    ])

    const data = logs.map(l => ({
      ...l,
      is_own: l.user_id === requester.id,
    }))

    return res.status(200).json({
      data,
      page,
      totalPages: Math.ceil(total / pageSize),
      total,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar feed' })
  }
}

const getPersonalProjects = async (req, res) => {
  try {
    const requester = req.user
    if (!isTI(requester)) return res.status(403).json({ error: 'Sem permissão' })
    const projectIds = await getResponsibleProjectIds(requester.id)
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, title: true, current_phase: true },
      orderBy: { title: 'asc' },
    })
    return res.status(200).json(projects)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos' })
  }
}

module.exports = {
  getPersonalDashboard, getGoLive, getStatusReports,
  getScopeItems, getTasks, getFeed, getPersonalProjects,
}