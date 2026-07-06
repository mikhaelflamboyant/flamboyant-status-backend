const prisma = require('../lib/prisma')
const logger = require('../lib/logger')

const TI_AREA = 'Tecnologia da Informação'
const MANAGER_ROLES = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR']

const canAccessManagement = (requester) => {
  return MANAGER_ROLES.includes(requester.role) &&
    (requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role))
}

const getDashboard = async (req, res) => {
  try {
    const requester = req.user
    if (!canAccessManagement(requester)) {
      return res.status(403).json({ error: 'Sem permissão para acessar o painel de gestão' })
    }

    const [activeProjects, archivedProjects, backlogProjects, goLiveProjects, finishedProjects] = await Promise.all([
      prisma.project.findMany({
        where: {
          archived: false,
          origin: 'NORMAL',
          current_phase: { notIn: ['BACKLOG', 'SUPORTE'] }
        },
        select: {
          id: true, title: true, area: true, traffic_light: true,
          current_phase: true, go_live: true, completion_pct: true, level: true,
          requested_at: true,
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.project.count({
        where: { archived: true, origin: 'NORMAL', current_phase: { not: 'CANCELADO' } }
      }),
      prisma.project.findMany({
        where: { current_phase: 'BACKLOG', archived: false, origin: 'NORMAL' },
        select: {
          id: true, title: true, area: true, traffic_light: true,
          current_phase: true, go_live: true, requested_at: true,
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.project.findMany({
        where: { current_phase: 'SUPORTE', archived: false, origin: 'NORMAL' },
        select: {
          id: true, title: true, area: true, traffic_light: true,
          current_phase: true, go_live: true, requested_at: true,
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.project.count({
        where: { archived: true, origin: 'NORMAL' }
      }),
    ])

    const inExecutionPhases = ['DESENVOLVIMENTO', 'TESTES', 'VALIDACAO_SOLICITANTE']
    const inExecution = activeProjects.filter(p => inExecutionPhases.includes(p.current_phase)).length

    const PDTI_PHASES = ['DESENVOLVIMENTO', 'TESTES', 'VALIDACAO_SOLICITANTE', 'SUPORTE', 'ENTREGUE']
    const pdtiCandidates = [
      ...activeProjects,
      ...goLiveProjects,
    ].filter(p => PDTI_PHASES.includes(p.current_phase))
    const pdtiTotal = pdtiCandidates.length
    const pdtiOnTime = pdtiCandidates.filter(p => p.traffic_light === 'VERDE').length

    const allActiveForStats = [
      ...activeProjects,
      ...goLiveProjects,
    ]

    const byFarol = allActiveForStats.reduce((acc, p) => {
      acc[p.traffic_light] = (acc[p.traffic_light] || 0) + 1
      return acc
    }, { VERDE: 0, AMARELO: 0, VERMELHO: 0 })

    const PHASE_ORDER = [
      'RECEBIDA', 'ENTREVISTA_SOLICITANTE', 'LEVANTAMENTO_REQUISITOS',
      'ANALISE_SOLUCAO', 'DESENVOLVIMENTO', 'TESTES',
      'VALIDACAO_SOLICITANTE', 'ENTREGUE', 'SUPORTE'
    ]
    const byPhase = allActiveForStats.reduce((acc, p) => {
      acc[p.current_phase] = (acc[p.current_phase] || 0) + 1
      return acc
    }, {})

    const byUnit = allActiveForStats.reduce((acc, p) => {
      const areas = (p.area || '').split(', ').filter(Boolean)
      areas.forEach(area => {
        acc[area] = (acc[area] || 0) + 1
      })
      return acc
    }, {})

    const byLevel = allActiveForStats.reduce((acc, p) => {
      const key = p.level || 'null'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const overdue = allActiveForStats.filter(p => {
      if (p.traffic_light === 'VERMELHO') return true
      if (p.go_live && new Date(p.go_live) < new Date() && p.current_phase !== 'ENTREGUE') return true
      return false
    }).length

    const avgCompletion = activeProjects.length > 0
      ? Math.round(activeProjects.reduce((sum, p) => sum + (p.completion_pct || 0), 0) / activeProjects.length)
      : 0

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const projectsWithRecentStatus = await prisma.statusUpdate.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      select: { project_id: true },
      distinct: ['project_id']
    })
    const recentStatusIds = new Set(projectsWithRecentStatus.map(s => s.project_id))
    const noRecentStatus = activeProjects.filter(p => !recentStatusIds.has(p.id)).length

    const noGoLive = activeProjects.filter(p => !p.go_live).length

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      deliveredThisMonth, cancelledThisMonth, createdThisMonth,
    ] = await Promise.all([
      prisma.project.count({
        where: { archived_at: { gte: startOfMonth }, archived: true, current_phase: { not: 'CANCELADO' } }
      }),
      prisma.project.count({
        where: { cancelled_at: { gte: startOfMonth }, current_phase: 'CANCELADO' }
      }),
      prisma.project.count({
        where: { created_at: { gte: startOfMonth }, origin: 'NORMAL' }
      }),
    ])

    const byLevelMap = { A: 0, B: 0, C: 0, D: 0, null: 0 }
    for (const [k, v] of Object.entries(byLevel)) {
      byLevelMap[k] = v
    }

    const deliveredProjects = await prisma.project.findMany({
      where: { archived: true, origin: 'NORMAL', current_phase: { not: 'CANCELADO' }, archived_at: { not: null } },
      select: { area: true, created_at: true, archived_at: true }
    })

    const deliveryByUnit = {}
    let globalDeliverySum = 0
    let globalDeliveryCount = 0
    for (const p of deliveredProjects) {
      if (!p.created_at || !p.archived_at) continue
      const days = Math.round((new Date(p.archived_at) - new Date(p.created_at)) / (1000 * 60 * 60 * 24))
      if (days < 0) continue
      globalDeliverySum += days
      globalDeliveryCount++
      const areas = (p.area || '').split(', ').filter(Boolean)
      areas.forEach(area => {
        if (!deliveryByUnit[area]) deliveryByUnit[area] = { sum: 0, count: 0 }
        deliveryByUnit[area].sum += days
        deliveryByUnit[area].count++
      })
    }
    const avgDeliveryByUnit = {}
    for (const [area, { sum, count }] of Object.entries(deliveryByUnit)) {
      avgDeliveryByUnit[area] = Math.round(sum / count)
    }
    const globalAvgDelivery = globalDeliveryCount > 0 ? Math.round(globalDeliverySum / globalDeliveryCount) : 0

    const goLiveProjectsForTimeline = await prisma.project.findMany({
      where: { go_live: { not: null }, archived: false, origin: 'NORMAL' },
      select: { go_live: true }
    })
    const goLiveByMonth = {}
    const now = new Date()
    for (const p of goLiveProjectsForTimeline) {
      const gl = new Date(p.go_live)
      if (gl < new Date(now.getFullYear(), now.getMonth(), 1)) continue
      const key = gl.toISOString().slice(0, 7)
      goLiveByMonth[key] = (goLiveByMonth[key] || 0) + 1
    }

    const activeUsersCount = await prisma.user.count({ where: { status: 'ATIVO', area: TI_AREA } })
    const usersWithProjectsData = await prisma.projectRequester.findMany({
      where: { project: { archived: false } },
      select: { user_id: true },
      distinct: ['user_id']
    })
    const usersWithProjectsSet = new Set(usersWithProjectsData.map(u => u.user_id).filter(Boolean))
    const tiUsers = await prisma.user.findMany({ where: { status: 'ATIVO', area: TI_AREA }, select: { id: true } })
    const usersWithoutProjects = tiUsers.filter(u => !usersWithProjectsSet.has(u.id)).length

    return res.status(200).json({
      backlog_projects: backlogProjects,
      go_live_projects: goLiveProjects,
      active_projects: activeProjects,
      totals: {
        active: activeProjects.length,
        active_only: activeProjects.length,
        in_execution: inExecution,
        pdti_total: pdtiTotal,
        pdti_on_time: pdtiOnTime,
        archived: archivedProjects,
        overdue,
        avg_completion: avgCompletion,
        no_recent_status: noRecentStatus,
        no_go_live: noGoLive,
        users_without_projects: usersWithoutProjects,
        backlog: backlogProjects.length,
        go_live: goLiveProjects.length,
        support: goLiveProjects.length,
        delivered_this_month: deliveredThisMonth,
        cancelled_this_month: cancelledThisMonth,
        created_this_month: createdThisMonth,
      },
      by_farol: byFarol,
      by_phase: byPhase,
      by_unit: byUnit,
      by_level: byLevelMap,
      avg_delivery_by_unit: avgDeliveryByUnit,
      avg_delivery_global: globalAvgDelivery,
      go_live_timeline: goLiveByMonth,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar painel de gestão' })
  }
}

const getUsers = async (req, res) => {
  try {
    const requester = req.user
    if (!canAccessManagement(requester)) {
      return res.status(403).json({ error: 'Sem permissão para acessar o painel de gestão' })
    }

    const users = await prisma.user.findMany({
      where: { status: 'ATIVO' },
      select: {
        id: true, name: true, email: true, area: true, role: true,
        project_requests: {
          select: {
            type: true,
            project: {
              select: {
                id: true, title: true, traffic_light: true,
                current_phase: true, go_live: true, completion_pct: true,
                archived: true
              }
            }
          }
        },
        project_members: {
          include: {
            project: {
              select: {
                id: true, title: true, traffic_light: true,
                current_phase: true, go_live: true, completion_pct: true,
                archived: true
              }
            }
          }
        }
      },
      orderBy: [{ area: 'asc' }, { name: 'asc' }]
    })

    const usersWithProjects = users.map(user => {
      const projectsAsResponsavel = user.project_requests
        .filter(r => r.type === 'RESPONSAVEL')
        .map(r => r.project)
        .filter(p => !p.archived)

      const projectsAsRequester = user.project_requests
        .map(r => r.project)
        .filter(p => !p.archived)

      const projectsAsMember = user.project_members
        .map(m => m.project)
        .filter(p => !p.archived)

      const allProjects = [
        ...projectsAsRequester,
        ...projectsAsMember.filter(m => !projectsAsRequester.find(r => r.id === m.id))
      ]

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        area: user.area || 'Sem área',
        role: user.role,
        projects: allProjects,
        projects_count: allProjects.length,
        responsavel_projects: projectsAsResponsavel,
        responsavel_count: projectsAsResponsavel.length,
        projects_by_phase: allProjects.reduce((acc, p) => {
          acc[p.current_phase] = (acc[p.current_phase] || 0) + 1
          return acc
        }, {}),
      }
    })

    const byArea = usersWithProjects.reduce((acc, user) => {
      const area = user.area || 'Sem área'
      if (!acc[area]) acc[area] = []
      acc[area].push(user)
      return acc
    }, {})

    const usersWithoutProjects = usersWithProjects
      .filter(u => u.projects_count === 0)
      .reduce((acc, u) => {
        const area = u.area || 'Sem área'
        if (!acc[area]) acc[area] = []
        acc[area].push(u)
        return acc
      }, {})

    const responsaveis = usersWithProjects
      .filter(u => u.area === TI_AREA)
      .map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        area: u.area,
        carga: u.responsavel_count,
        projects: u.responsavel_projects,
        farol: u.responsavel_projects.reduce((acc, p) => {
          acc[p.traffic_light] = (acc[p.traffic_light] || 0) + 1
          return acc
        }, {}),
      }))
      .sort((a, b) => b.carga - a.carga)

    return res.status(200).json({
      by_area: byArea,
      without_projects: usersWithoutProjects,
      responsaveis,
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar usuários' })
  }
}

const getPendingApprovals = async (req, res) => {
  try {
    const requester = req.user
    if (!canAccessManagement(requester)) {
      return res.status(403).json({ error: 'Sem permissão para acessar aprovações' })
    }

    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.page_size) || 10
    const order = req.query.order === 'asc' ? 'asc' : 'desc'
    const filterProjectId = req.query.project_id || null
    const filterUserId = req.query.user_id || null

    const pendingItems = await prisma.scopeItem.findMany({
      where: {
        OR: [
          { status: 'AGUARDANDO_APROVACAO' },
          { pending_action: { not: null } },
        ],
        project: {
          archived: false,
          ...(filterProjectId ? { id: filterProjectId } : {}),
        },
        ...(filterUserId ? { created_by: filterUserId } : {}),
      },
      include: {
        project: { select: { id: true, title: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { updated_at: order },
    })

    const byProject = {}
    for (const item of pendingItems) {
      const pid = item.project.id
      if (!byProject[pid]) {
        byProject[pid] = {
          project_id: pid,
          project_title: item.project.title,
          items: [],
          submitted_by: item.creator,
          latest_updated_at: item.updated_at,
        }
      }
      byProject[pid].items.push(item)
      if (new Date(item.updated_at) > new Date(byProject[pid].latest_updated_at)) {
        byProject[pid].latest_updated_at = item.updated_at
      }
    }

    let projectGroups = Object.values(byProject)
    projectGroups.sort((a, b) => {
      const da = new Date(a.latest_updated_at).getTime()
      const db = new Date(b.latest_updated_at).getTime()
      return order === 'asc' ? da - db : db - da
    })

    const total = projectGroups.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const paged = projectGroups.slice(start, start + pageSize)

    const allPending = await prisma.scopeItem.findMany({
      where: {
        OR: [
          { status: 'AGUARDANDO_APROVACAO' },
          { pending_action: { not: null } },
        ],
        project: { archived: false },
      },
      include: {
        project: { select: { id: true, title: true } },
        creator: { select: { id: true, name: true } },
      },
    })
    const projectOptions = []
    const userOptions = []
    const seenProjects = new Set()
    const seenUsers = new Set()
    for (const item of allPending) {
      if (!seenProjects.has(item.project.id)) {
        seenProjects.add(item.project.id)
        projectOptions.push({ id: item.project.id, title: item.project.title })
      }
      if (item.creator && !seenUsers.has(item.creator.id)) {
        seenUsers.add(item.creator.id)
        userOptions.push({ id: item.creator.id, name: item.creator.name })
      }
    }

    return res.status(200).json({
      projects: paged,
      total,
      total_pages: totalPages,
      page,
      filter_options: {
        projects: projectOptions.sort((a, b) => a.title.localeCompare(b.title)),
        users: userOptions.sort((a, b) => a.name.localeCompare(b.name)),
      },
    })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao carregar aprovações' })
  }
}

module.exports = { getDashboard, getUsers, getPendingApprovals }