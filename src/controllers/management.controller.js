const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

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

    const [activeProjects, archivedProjects] = await Promise.all([
      prisma.project.findMany({
        where: { archived: false },
        select: {
          id: true, traffic_light: true, current_phase: true,
          business_unit: true, area: true, completion_pct: true,
          go_live: true, title: true, created_at: true
        }
      }),
      prisma.project.count({ where: { archived: true } })
    ])

    const byFarol = {
      VERDE: activeProjects.filter(p => p.traffic_light === 'VERDE').length,
      AMARELO: activeProjects.filter(p => p.traffic_light === 'AMARELO').length,
      VERMELHO: activeProjects.filter(p => p.traffic_light === 'VERMELHO').length,
    }

    const phases = [
      'RECEBIDA', 'ENTREVISTA_SOLICITANTE', 'LEVANTAMENTO_REQUISITOS',
      'ANALISE_SOLUCAO', 'DESENVOLVIMENTO', 'TESTES',
      'VALIDACAO_SOLICITANTE', 'ENTREGUE'
    ]
    const byPhase = {}
    for (const phase of phases) {
      byPhase[phase] = activeProjects.filter(p => p.current_phase === phase).length
    }

    const units = ['Corporativo', 'Shopping', 'Urbanismo', 'Agropecuária', 'Instituto']
    const byUnit = {}
    for (const unit of units) {
      byUnit[unit] = activeProjects.filter(p => p.business_unit === unit).length
    }
    byUnit['Sem unidade'] = activeProjects.filter(p => !p.business_unit).length

    const avgCompletion = activeProjects.length > 0
      ? Math.round(activeProjects.reduce((acc, p) => acc + p.completion_pct, 0) / activeProjects.length)
      : 0

    const overdue = activeProjects.filter(p =>
      p.traffic_light === 'VERMELHO' ||
      (p.go_live && new Date(p.go_live) < new Date())
    ).length

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const projectsWithRecentStatus = await prisma.statusUpdate.findMany({
      where: { created_at: { gte: sevenDaysAgo } },
      select: { project_id: true },
      distinct: ['project_id'],
    })
    const recentStatusIds = new Set(projectsWithRecentStatus.map(s => s.project_id))
    const noRecentStatus = activeProjects.filter(p => !recentStatusIds.has(p.id)).length

    const noGoLive = activeProjects.filter(p => !p.go_live).length

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const deliveredThisMonth = await prisma.project.count({
      where: {
        archived_at: { gte: startOfMonth },
        OR: [
          { archived: true },
          { current_phase: 'ENTREGUE' },
          { completion_pct: 100 }
        ]
      }
    })

    const allActiveUserIds = new Set()
    const projectMembers = await prisma.projectMember.findMany({
      where: { project: { archived: false } },
      select: { user_id: true }
    })
    const projectRequesters = await prisma.projectRequester.findMany({
      where: { project: { archived: false } },
      select: { user_id: true }
    })
    projectMembers.forEach(m => m.user_id && allActiveUserIds.add(m.user_id))
    projectRequesters.forEach(r => r.user_id && allActiveUserIds.add(r.user_id))

    const totalActiveUsers = await prisma.user.count({ where: { status: 'ATIVO' } })
    const usersWithoutProjects = totalActiveUsers - allActiveUserIds.size

    return res.status(200).json({
      totals: {
        active: activeProjects.length,
        archived: archivedProjects,
        overdue,
        avg_completion: avgCompletion,
        no_recent_status: noRecentStatus,
        no_go_live: noGoLive,
        delivered_this_month: deliveredThisMonth,
        users_without_projects: usersWithoutProjects,
      },
      by_farol: byFarol,
      by_phase: byPhase,
      by_unit: byUnit,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao carregar dashboard' })
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
          include: {
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

return res.status(200).json({ by_area: byArea, without_projects: usersWithoutProjects })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao carregar usuários' })
  }
}

module.exports = { getDashboard, getUsers }