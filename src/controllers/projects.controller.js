const prisma = require('../lib/prisma')
const { notifyUserLinkedToProject, notifyNewProject } = require('../services/notifications.service')
const logger = require('../lib/logger')
const { logActivity, ACTION_TYPES } = require('../services/activityLog.service')

const TI_AREA = 'Tecnologia da Informação'
const FULL_VIEW_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
const AREA_MANAGER_ROLES = ['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR']

async function visibilityFilter(requester) {
  const isFromTI = requester.area === TI_AREA

  if (FULL_VIEW_ROLES.includes(requester.role) && isFromTI) {
    return {}
  }

  if (isFromTI) {
    return { requesters: { some: { user_id: requester.id, type: 'RESPONSAVEL' } } }
  }

  if (AREA_MANAGER_ROLES.includes(requester.role)) {
    const user = await prisma.user.findUnique({ where: { id: requester.id } })
    return { area: { contains: user.area } }
  }

  return {
    OR: [
      { requesters: { some: { user_id: requester.id } } },
      { members: { some: { user_id: requester.id } } },
    ],
  }
}
async function ensureCoordenadorTI({ project_id, responsible_ids = [], creatorRole }) {
  let needsCoordenador = creatorRole === 'ESTAGIARIO'

  if (!needsCoordenador && responsible_ids.length > 0) {
    const responsibles = await prisma.user.findMany({
      where: { id: { in: responsible_ids } },
      select: { role: true },
    })
    needsCoordenador = responsibles.some(u => u.role === 'ESTAGIARIO')
  }

  if (!needsCoordenador) return

  const jaTemCoordenador = await prisma.projectRequester.findFirst({
    where: {
      project_id,
      type: 'RESPONSAVEL',
      user: { role: 'COORDENADOR', area: TI_AREA, status: 'ATIVO' },
    },
  })
  if (jaTemCoordenador) return

  const coordenador = await prisma.user.findFirst({
    where: { role: 'COORDENADOR', area: TI_AREA, status: 'ATIVO' },
    orderBy: { created_at: 'asc' },
  })
  if (!coordenador) {
    logger.warn(`Nenhum coordenador de TI ativo encontrado para vincular ao projeto ${project_id}`)
    return
  }

  await prisma.projectRequester.create({
    data: { project_id, user_id: coordenador.id, type: 'RESPONSAVEL' },
  })
}

const closeFreshserviceTicket = async (ticketId, tipo = 'aprovado') => {
  if (!ticketId || !process.env.FRESHSERVICE_DOMAIN || !process.env.FRESHSERVICE_API_KEY) return
  try {
    const numericId = String(ticketId).replace(/^SR-/i, '')
    const credentials = Buffer.from(`${process.env.FRESHSERVICE_API_KEY}:X`).toString('base64')
    const url = `https://${process.env.FRESHSERVICE_DOMAIN}/api/v2/tickets/${numericId}?bypass_mandatory=true`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({ status: 5 }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error({ ticketId: numericId, status: response.status, body: errorBody }, 'Falha ao fechar ticket no FreshService')
    } else {
      logger.info({ ticketId: numericId, tipo }, 'Ticket fechado no FreshService')
    }
  } catch (err) {
    logger.error({ err }, 'Erro ao fechar ticket no FreshService')
  }
}

const listProjects = async (req, res) => {
  try {
    const requester = req.user
    const visibility = await visibilityFilter(requester)

    let whereClause = {
      archived: false,
      origin: 'NORMAL',
      current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] },
      ...visibility,
    }

    const { filtro } = req.query

    if (filtro === 'sem_golive') {
      whereClause = { ...whereClause, go_live: null }
    } else if (filtro === 'sem_status') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const recentStatus = await prisma.statusUpdate.findMany({
        where: { created_at: { gte: sevenDaysAgo } },
        select: { project_id: true },
        distinct: ['project_id'],
      })
      const recentIds = recentStatus.map(s => s.project_id)
      whereClause = { ...whereClause, id: { notIn: recentIds } }
    } else if (filtro === 'sem_cronograma') {
      const comCronograma = await prisma.scopeItem.findMany({
        select: { project_id: true },
        distinct: ['project_id'],
      })
      const comIds = comCronograma.map(s => s.project_id)
      whereClause = { ...whereClause, id: { notIn: comIds } }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true }
        },
      },
      orderBy: { created_at: 'desc' }
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return res.status(200).json(projects)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos' })
  }
}

const listGoLiveProjects = async (req, res) => {
  try {
    const requester = req.user
    const visibility = await visibilityFilter(requester)
    const { filtro } = req.query
    let whereClause = { current_phase: 'SUPORTE', archived: false, origin: 'NORMAL', ...visibility }

    if (filtro === 'sem_cronograma') {
      const comCronograma = await prisma.scopeItem.findMany({
        select: { project_id: true },
        distinct: ['project_id'],
      })
      const comIds = comCronograma.map(s => s.project_id)
      whereClause = { ...whereClause, id: { notIn: comIds } }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
      },
      orderBy: { delivered_at: 'desc' }
    })
    return res.status(200).json(projects)
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar projetos em go-live' })
  }
}

const listArchivedProjects = async (req, res) => {
  try {
    const requester = req.user
    const visibility = await visibilityFilter(requester)

    let whereClause = { archived: true, current_phase: { not: 'CANCELADO' }, ...visibility }

    const { filtro } = req.query

    if (filtro === 'entregues_mes') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      whereClause = {
        ...whereClause,
        archived_at: { gte: startOfMonth }
      }
    } else if (filtro === 'sem_cronograma') {
      const comCronograma = await prisma.scopeItem.findMany({
        select: { project_id: true },
        distinct: ['project_id'],
      })
      const comIds = comCronograma.map(s => s.project_id)
      whereClause = { ...whereClause, id: { notIn: comIds } }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
      },
      orderBy: { archived_at: 'desc' }
    })

    return res.status(200).json(projects)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos arquivados' })
  }
}

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        status_updates: {
          orderBy: { created_at: 'desc' },
          include: { risks: true, author: { select: { id: true, name: true } } }
        },
        requirements: {
          include: {
            author: { select: { id: true, name: true } },
            history: {
              orderBy: { edited_at: 'desc' },
              include: { editor: { select: { id: true, name: true } } }
            }
          }
        },
        go_live_history: {
          orderBy: { changed_at: 'desc' },
          include: { changed_by_user: { select: { id: true, name: true } } }
        },
        phase_history: {
          orderBy: { changed_at: 'asc' },
          include: { changed_by_user: { select: { id: true, name: true } } }
        },
        costs: true,
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    return res.status(200).json(project)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao buscar projeto' })
  }
}

const createProject = async (req, res) => {
  try {
    const requester = req.user
    const {
      title, area, business_unit, execution_type, level, complexity, description,
      go_live, owner_id, member_ids, requester_ids, responsible_ids, costs
    } = req.body

    const BACKLOG_ALLOWED_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const isTI = requester.area === 'Tecnologia da Informação' || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    const canCreateBacklog = BACKLOG_ALLOWED_ROLES.includes(requester.role)

    if (!isTI && !canCreateBacklog) {
      return res.status(403).json({ error: 'Sem permissão para criar projetos.' })
    }

    if (!title || !description) {
      return res.status(400).json({ error: 'Campos obrigatórios: título e descrição.' })
    }

    const autoTrafficLight = go_live ? (new Date(go_live) < new Date() ? 'VERMELHO' : 'VERDE') : 'VERDE'

    const project = await prisma.project.create({
      data: {
        title, area,
        business_unit: business_unit || null,
        requester_name: '',
        execution_type: execution_type || 'INTERNA',
        level: level || null,
        complexity: complexity || null,
        description,
        go_live: go_live ? new Date(go_live) : null,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        owner_id: owner_id || null,
        traffic_light: autoTrafficLight,
        current_phase: req.body.current_phase || 'RECEBIDA',
        legacy: req.body.legacy === true || req.body.legacy === 'true',
        requested_at: new Date(),
      }
    })

    if (requester_ids?.length > 0) {
      for (const user_id of requester_ids) {
        await prisma.projectRequester.create({ data: { project: { connect: { id: project.id } }, user: { connect: { id: user_id } }, type: 'SOLICITANTE' } })
      }
    }

    if (req.body.requester_names?.length > 0) {
      for (const person of req.body.requester_names) {
        await prisma.projectRequester.create({ data: { project: { connect: { id: project.id } }, manual_name: person.name, manual_area: person.area, type: 'SOLICITANTE' } })
      }
    }

    if (responsible_ids?.length > 0) {
      for (const user_id of responsible_ids) {
        await prisma.projectRequester.create({ data: { project: { connect: { id: project.id } }, user: { connect: { id: user_id } }, type: 'RESPONSAVEL' } })
      }
    }

    if (req.body.responsible_names?.length > 0) {
      for (const person of req.body.responsible_names) {
        await prisma.projectRequester.create({ data: { project: { connect: { id: project.id } }, manual_name: person.name, manual_area: person.area, type: 'RESPONSAVEL' } })
      }
    }

    await ensureCoordenadorTI({
      project_id: project.id,
      responsible_ids: responsible_ids || [],
      creatorRole: requester.role,
    })

    if (member_ids?.length > 0) {
      for (const user_id of member_ids) {
        await prisma.projectMember.create({ data: { project: { connect: { id: project.id } }, user: { connect: { id: user_id } } } })
      }
    }

    if (req.body.member_names?.length > 0) {
      for (const person of req.body.member_names) {
        await prisma.projectMember.create({ data: { project: { connect: { id: project.id } }, manual_name: person.name, manual_area: person.area } })
      }
    }

    if (costs?.length > 0) {
      for (const cost of costs) {
        await prisma.projectCost.create({
          data: {
            project_id: project.id,
            name: cost.name,
            budget_planned: parseFloat(cost.budget_planned),
            budget_actual: cost.budget_actual ? parseFloat(cost.budget_actual) : null,
          }
        })
      }
    }

    const allLinkedIds = [...(requester_ids || []), ...(responsible_ids || []), ...(member_ids || [])]
    for (const user_id of allLinkedIds) {
      await notifyUserLinkedToProject(project, user_id)
    }

    const managers = await prisma.user.findMany({
      where: { status: 'ATIVO', role: { in: ['SUPERINTENDENTE', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR'] } }
    })

    const areaManagers = await prisma.user.findMany({
      where: {
        status: 'ATIVO',
        role: { in: ['GERENTE', 'COORDENADOR'] },
        area: { in: (project.area || '').split(', ').filter(Boolean) }
      }
    })

    await notifyNewProject(project, [...managers, ...areaManagers])

    return res.status(201).json(project)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao criar projeto' })
  }
}

const updateProject = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const project = await prisma.project.findUnique({
      where: { id },
      include: { requesters: true, members: true, costs: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isAnalistaMaster = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    const isRequester = project.requesters.some(r => r.user_id === requester.id && r.type === 'SOLICITANTE')
    const isResponsible = project.requesters.some(r => r.user_id === requester.id && r.type === 'RESPONSAVEL')

    if (!isAnalistaMaster && !isRequester && !isResponsible) {
      return res.status(403).json({ error: 'Sem permissão para editar este projeto' })
    }

    const {
      title, area, business_unit, execution_type, level, complexity, description,
      go_live, owner_id, current_phase, traffic_light, completion_pct,
      requester_ids, requester_names, responsible_ids, responsible_names,
      member_ids, member_names, costs
    } = req.body

    const PRIVILEGED_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const isPrivileged = PRIVILEGED_ROLES.includes(requester.role) && isResponsible

    if (current_phase && current_phase !== project.current_phase && !project.legacy && !isPrivileged) {
      const scopeItems = await prisma.scopeItem.findMany({
        where: { project_id: id, status: 'APROVADO' }
      })

      const stageComplete = (stageKey) => {
        const stagePending = scopeItems.some(s => s.stage === stageKey && s.pending_action)
        if (stagePending) return false

        const items = scopeItems.filter(s => s.stage === stageKey)
        if (items.length === 0) return true
        return items.every(s => s.completion_date !== null)
      }

      const TRANSITIONS = {
        DESENVOLVIMENTO: () => stageComplete('PLANEJAMENTO'),
        TESTES: () => stageComplete('PLANEJAMENTO'),
        VALIDACAO_SOLICITANTE: () => stageComplete('PLANEJAMENTO'),
        SUPORTE: () => stageComplete('EXECUCAO'),
        ENTREGUE: () => stageComplete('EXECUCAO'),
      }

      if (TRANSITIONS[current_phase] && !TRANSITIONS[current_phase]()) {
        return res.status(400).json({
          error: `Não é possível avançar para "${current_phase}". Conclua todas as atividades aprovadas do cronograma correspondente.`
        })
      }
    }  

    const dataToUpdate = {
      ...(title && { title }),
      ...(area && { area }),
      ...(execution_type && { execution_type }),
      ...(level && { level }),
      ...(complexity !== undefined && { complexity }),
      ...(description && { description }),
      ...(business_unit !== undefined && { business_unit }),
      ...(go_live !== undefined && { go_live: go_live ? new Date(go_live) : null }),
      ...(req.body.start_date !== undefined && { start_date: req.body.start_date ? new Date(req.body.start_date) : null }),
      ...(owner_id !== undefined && { owner_id }),
      ...(current_phase && { current_phase }),
      ...(traffic_light && { traffic_light }),
      ...(completion_pct !== undefined && { completion_pct }),
      ...(req.body.requested_at !== undefined && { requested_at: req.body.requested_at ? new Date(req.body.requested_at) : null }),
    }

    if (go_live) {
      const newGoLive = new Date(go_live)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const existingGoLive = project.go_live ? new Date(project.go_live).toISOString().split('T')[0] : null
      const newGoLiveStr = new Date(go_live).toISOString().split('T')[0]
      if (existingGoLive !== newGoLiveStr) {
        if (newGoLive > today) {
          dataToUpdate.traffic_light = 'VERDE'
        } else {
          dataToUpdate.traffic_light = 'VERMELHO'
        }
      }
    }

    if (current_phase === 'SUPORTE') {
      dataToUpdate.completion_pct = 100
      dataToUpdate.delivered_at = new Date()
      dataToUpdate.archived = false
      dataToUpdate.archived_at = null
    }

    if (current_phase === 'ENTREGUE') {
      dataToUpdate.archived = true
      dataToUpdate.archived_at = new Date()
      dataToUpdate.completion_pct = 100
    }

    if (current_phase && current_phase !== 'SUPORTE' && current_phase !== 'ENTREGUE') {
      dataToUpdate.archived = false
      dataToUpdate.archived_at = null
    }

    if (completion_pct !== undefined && parseInt(completion_pct) < 100 && project.current_phase === 'ENTREGUE' && !current_phase) {
      dataToUpdate.archived = false
      dataToUpdate.archived_at = null
    }

    const updated = await prisma.project.update({ where: { id }, data: dataToUpdate })

    if (current_phase && current_phase !== project.current_phase) {
      await prisma.phaseHistory.create({
        data: {
          project_id: id,
          changed_by: requester.id,
          from_phase: project.current_phase,
          to_phase: current_phase,
        }
      })
    }

    if (go_live && project.go_live && new Date(go_live).toISOString() !== new Date(project.go_live).toISOString()) {
      await prisma.goLiveHistory.create({
        data: {
          project_id: id,
          changed_by: requester.id,
          previous_date: project.go_live,
          new_date: new Date(go_live),
        }
      })
    }

    if (requester_ids !== undefined || requester_names !== undefined) {
      await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'SOLICITANTE' } })
      for (const user_id of (requester_ids || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } }, type: 'SOLICITANTE' } })
      }
      for (const person of (requester_names || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area, type: 'SOLICITANTE' } })
      }
    }

    if (responsible_ids !== undefined || responsible_names !== undefined) {
      await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'RESPONSAVEL' } })
      for (const user_id of (responsible_ids || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } }, type: 'RESPONSAVEL' } })
      }
      for (const person of (responsible_names || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area, type: 'RESPONSAVEL' } })
      }

      await ensureCoordenadorTI({ project_id: id, responsible_ids: responsible_ids || [] })

      if (requester_ids?.length > 0 || responsible_ids?.length > 0) {
        const firstResponsible = (responsible_ids || [])[0] || null
        await prisma.project.update({ where: { id }, data: { owner_id: firstResponsible || null } })
      }
    }

    if (member_ids !== undefined || member_names !== undefined) {
      const existingMembers = await prisma.projectMember.findMany({ where: { project_id: id } })
      const existingUserIds = existingMembers.filter(m => m.user_id).map(m => m.user_id)
      const newUserIds = member_ids || []

      const toAdd = newUserIds.filter(uid => !existingUserIds.includes(uid))
      const toRemove = existingUserIds.filter(uid => !newUserIds.includes(uid))

      if (toRemove.length > 0) {
        await prisma.projectMember.deleteMany({ where: { project_id: id, user_id: { in: toRemove } } })
      }
      for (const user_id of toAdd) {
        await prisma.projectMember.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } } } })
      }
      await prisma.projectMember.deleteMany({ where: { project_id: id, user_id: null } })
      for (const person of (member_names || [])) {
        await prisma.projectMember.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area } })
      }
    }

    if (costs !== undefined) {
      const existingCosts = await prisma.projectCost.findMany({ where: { project_id: id } })
      const existingNames = existingCosts.map(c => c.name)
      const newNames = costs.map(c => c.name)

      const toRemove = existingCosts.filter(c => !newNames.includes(c.name))
      if (toRemove.length > 0) {
        await prisma.projectCost.deleteMany({ where: { id: { in: toRemove.map(c => c.id) } } })
      }

      for (const cost of costs) {
        const existing = existingCosts.find(c => c.name === cost.name)
        if (existing) {
          await prisma.projectCost.update({
            where: { id: existing.id },
            data: {
              budget_planned: parseFloat(cost.budget_planned),
              budget_actual: cost.budget_actual ? parseFloat(cost.budget_actual) : null,
            }
          })
        } else {
          await prisma.projectCost.create({
            data: {
              project_id: id,
              name: cost.name,
              budget_planned: parseFloat(cost.budget_planned),
              budget_actual: cost.budget_actual ? parseFloat(cost.budget_actual) : null,
            }
          })
        }
      }
    }

    await logActivity({
      project_id: id,
      user_id: requester.id,
      action_type: ACTION_TYPES.PROJECT_EDITED,
      description: `${requester.name} editou o projeto.`,
    })

    return res.status(200).json(updated)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao atualizar projeto' })
  }
}

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const project = await prisma.project.findUnique({
      where: { id },
      include: { requesters: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isAnalistaMaster = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    const isRequester = project.requesters.some(r => r.user_id === requester.id && r.type === 'SOLICITANTE')
    const isResponsible = project.requesters.some(r => r.user_id === requester.id && r.type === 'RESPONSAVEL')

    if (!isAnalistaMaster && !isRequester && !isResponsible) {
      return res.status(403).json({ error: 'Sem permissão para excluir este projeto' })
    }

    const statusCount = await prisma.statusUpdate.count({ where: { project_id: id } })
    if (statusCount > 0) {
      return res.status(400).json({ error: 'Não é possível excluir um projeto que possui status reports cadastrados. Você pode cancelar o projeto.' })
    }

    await prisma.project.delete({ where: { id } })
    return res.status(200).json({ message: 'Projeto excluído com sucesso' })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao excluir projeto' })
  }
}

const assignMember = async (req, res) => {
  try {
    const { id } = req.params
    const { user_id } = req.body
    const requester = req.user

    if (!['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)) {
      return res.status(403).json({ error: 'Sem permissão para atribuir membros' })
    }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const member = await prisma.projectMember.upsert({
      where: { project_id_user_id: { project_id: id, user_id } },
      update: {},
      create: { project_id: id, user_id }
    })

    return res.status(201).json(member)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao atribuir membro' })
  }
}

const archiveExpiredProjects = async () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  await prisma.project.updateMany({
    where: { current_phase: 'ENTREGUE', archived: false, archived_at: { lte: thirtyDaysAgo } },
    data: { archived: true }
  })
}

const approveFreshservice = async (req, res) => {
  try {
    const { id } = req.params
    const {
      title, area, business_unit, level, go_live, go_live_undefined,
      start_date, responsible_id, responsible_name, responsible_area, execution_type,
      description, requester_ids, requester_names, member_ids, member_names, costs,
    } = req.body

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { title }),
        area,
        business_unit,
        level: level || null,
        go_live: go_live_undefined ? null : (go_live ? new Date(go_live) : null),
        ...(start_date && { start_date: new Date(start_date) }),
        execution_type: execution_type || 'INTERNA',
        origin: 'NORMAL',
        current_phase: 'BACKLOG',
        ...(description && { description }),
        requested_at: new Date(),
      }
    })

    if (responsible_id) {
      await prisma.projectRequester.create({
        data: { project_id: id, user_id: responsible_id, type: 'RESPONSAVEL' }
      })
    } else if (responsible_name) {
      await prisma.projectRequester.create({
        data: { project_id: id, manual_name: responsible_name, manual_area: responsible_area || '', type: 'RESPONSAVEL' }
      })
    }

    if (requester_ids?.length > 0 || requester_names?.length > 0) {
      await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'SOLICITANTE' } })
      for (const user_id of (requester_ids || [])) {
        await prisma.projectRequester.create({
          data: { project_id: id, user_id, type: 'SOLICITANTE' }
        })
      }
      for (const person of (requester_names || [])) {
        await prisma.projectRequester.create({
          data: { project_id: id, manual_name: person.name, manual_area: person.area || '', type: 'SOLICITANTE' }
        })
      }
    }

    if (member_ids?.length > 0) {
      for (const user_id of member_ids) {
        await prisma.projectMember.create({ data: { project_id: id, user_id } })
      }
    }
    if (member_names?.length > 0) {
      for (const person of member_names) {
        await prisma.projectMember.create({ data: { project_id: id, manual_name: person.name, manual_area: person.area || '' } })
      }
    }
    if (costs?.length > 0) {
      for (const cost of costs) {
        await prisma.projectCost.create({
          data: {
            project_id: id,
            name: cost.name,
            budget_planned: parseFloat(cost.budget_planned),
            budget_actual: cost.budget_actual ? parseFloat(cost.budget_actual) : null,
          }
        })
      }
    }

    if (project.freshservice_ticket_id) {
      await closeFreshserviceTicket(project.freshservice_ticket_id, 'aprovado')
    }

    return res.status(200).json(project)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao aprovar projeto' })
  }
}

const rejectFreshservice = async (req, res) => {
  try {
    const { id } = req.params
    const project = await prisma.project.findUnique({ where: { id }, select: { freshservice_ticket_id: true } })
    await prisma.project.delete({ where: { id } })
    if (project?.freshservice_ticket_id) {
      await closeFreshserviceTicket(project.freshservice_ticket_id, 'rejeitado')
    }
    return res.status(200).json({ message: 'Solicitação rejeitada e removida' })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao rejeitar projeto' })
  }
}

const listFreshserviceRequests = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { origin: 'FRESHSERVICE', archived: false },
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: { created_at: true }
        },
      },
      orderBy: { created_at: 'desc' }
    })
    return res.status(200).json(projects)
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar solicitações' })
  }
}

const listBacklogProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { current_phase: 'BACKLOG', archived: false, origin: 'NORMAL' },
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        costs: true,
      },
      select: undefined,
      orderBy: { created_at: 'desc' }
    })
    return res.status(200).json(projects)
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao listar backlog' })
  }
}

const assignResponsible = async (req, res) => {
  try {
    const { id } = req.params
    const {
      user_id, responsible_name, responsible_area,
      description, execution_type, start_date, go_live, go_live_undefined,
      member_ids, member_names, costs
    } = req.body
    const requester = req.user

    const TI_AREA = 'Tecnologia da Informação'
    const ASSIGN_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const canAssign = requester.area === TI_AREA && ASSIGN_ROLES.includes(requester.role)
    if (!canAssign) return res.status(403).json({ error: 'Sem permissão para atribuir responsáveis' })

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })
    if (project.current_phase !== 'BACKLOG') {
      return res.status(400).json({ error: 'Projeto não está em backlog' })
    }

    await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'RESPONSAVEL' } })

    if (user_id) {
      await prisma.projectRequester.create({
        data: { project_id: id, user_id, type: 'RESPONSAVEL' }
      })
    } else if (responsible_name) {
      await prisma.projectRequester.create({
        data: { project_id: id, manual_name: responsible_name, manual_area: responsible_area || '', type: 'RESPONSAVEL' }
      })
    }

    await ensureCoordenadorTI({ project_id: id, responsible_ids: user_id ? [user_id] : [] })

    const dataToUpdate = {
      current_phase: 'RECEBIDA',
      owner_id: user_id || null,
      origin: 'NORMAL',
      ...(description && { description }),
      ...(execution_type && { execution_type }),
      ...(start_date && { start_date: new Date(start_date) }),
      go_live: go_live_undefined ? null : (go_live ? new Date(go_live) : project.go_live),
      ...(req.body.requested_at !== undefined && { requested_at: req.body.requested_at ? new Date(req.body.requested_at) : null }),
    }

    await prisma.project.update({ where: { id }, data: dataToUpdate })

    await prisma.phaseHistory.create({
      data: {
        project_id: id,
        changed_by: user_id || requester.id,
        from_phase: 'BACKLOG',
        to_phase: 'RECEBIDA',
      }
    })

    if (member_ids?.length > 0) {
      for (const uid of member_ids) {
        await prisma.projectMember.create({ data: { project_id: id, user_id: uid } })
      }
    }
    if (member_names?.length > 0) {
      for (const person of member_names) {
        await prisma.projectMember.create({ data: { project_id: id, manual_name: person.name, manual_area: person.area || '' } })
      }
    }

    if (costs?.length > 0) {
      await prisma.projectCost.deleteMany({ where: { project_id: id } })
      for (const cost of costs) {
        await prisma.projectCost.create({
          data: {
            project_id: id,
            name: cost.name,
            budget_planned: parseFloat(cost.budget_planned),
            budget_actual: cost.budget_actual ? parseFloat(cost.budget_actual) : null,
          }
        })
      }
    }

    return res.status(200).json({ message: 'Responsável atribuído com sucesso' })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao atribuir responsável' })
  }
}

const duplicateProject = async (req, res) => {
  try {
    const { id } = req.params
    const { title, include_team, include_schedule, include_costs } = req.body
    const requester = req.user

    const original = await prisma.project.findUnique({
      where: { id },
      include: {
        requesters: true,
        members: true,
        costs: true,
        scope_items: { where: { status: 'APROVADO' } },
      }
    })

    if (!original) return res.status(404).json({ error: 'Projeto não encontrado' })

    const copy = await prisma.project.create({
      data: {
        title: title || `Cópia — ${original.title}`,
        area: original.area,
        business_unit: original.business_unit,
        execution_type: original.execution_type,
        level: original.level,
        complexity: original.complexity,
        description: original.description,
        requester_name: '',
        traffic_light: 'VERDE',
        current_phase: 'RECEBIDA',
        origin: 'NORMAL',
      }
    })

    if (include_team) {
      for (const r of original.requesters) {
        await prisma.projectRequester.create({
          data: {
            project_id: copy.id,
            user_id: r.user_id || null,
            manual_name: r.manual_name || null,
            manual_area: r.manual_area || null,
            type: r.type,
          }
        })
      }
      for (const m of original.members) {
        await prisma.projectMember.create({
          data: {
            project_id: copy.id,
            user_id: m.user_id || null,
            manual_name: m.manual_name || null,
            manual_area: m.manual_area || null,
          }
        })
      }
    }

    if (include_schedule) {
      for (const item of original.scope_items) {
        await prisma.scopeItem.create({
          data: {
            project_id: copy.id,
            title: item.title,
            description: item.description,
            stage: item.stage,
            phase: item.phase,
            completion_pct: 0,
            status: 'RASCUNHO',
            created_by: requester.id,
          }
        })
      }
    }

    if (include_costs) {
      for (const cost of original.costs) {
        await prisma.projectCost.create({
          data: {
            project_id: copy.id,
            name: cost.name,
            budget_planned: cost.budget_planned,
          }
        })
      }
    }

    return res.status(201).json(copy)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao duplicar projeto' })
  }
}

const cancelProject = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const requester = req.user

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Motivo do cancelamento é obrigatório' })
    }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })

    const updated = await prisma.project.update({
      where: { id },
      data: {
        current_phase: 'CANCELADO',
        archived: true,
        archived_at: new Date(),
        cancel_reason: reason.trim(),
        cancelled_at: new Date(),
        cancelled_by: requester.name,
      }
    })

    return res.status(200).json(updated)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao cancelar projeto' })
  }
}

const listCancelledProjects = async (req, res) => {
  try {
    const requester = req.user
    const visibility = await visibilityFilter(requester)
    const { filtro } = req.query
    let whereClause = { current_phase: 'CANCELADO', archived: true, ...visibility }

    if (filtro === 'sem_cronograma') {
      const comCronograma = await prisma.scopeItem.findMany({
        select: { project_id: true },
        distinct: ['project_id'],
      })
      const comIds = comCronograma.map(s => s.project_id)
      whereClause = { ...whereClause, id: { notIn: comIds } }
    } else if (filtro === 'cancelados_mes') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      whereClause = { ...whereClause, cancelled_at: { gte: startOfMonth } }
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
      },
      orderBy: { archived_at: 'desc' }
    })
    return res.status(200).json(projects)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos cancelados' })
  }
}

const restoreProject = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const TI_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const isFromTI = requester.area === 'Tecnologia da Informação' || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)

    if (!TI_ROLES.includes(requester.role) || !isFromTI) {
      return res.status(403).json({ error: 'Sem permissão para restaurar projetos' })
    }

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })

    const updated = await prisma.project.update({
      where: { id },
      data: {
        current_phase: 'RECEBIDA',
        archived: false,
        archived_at: null,
      }
    })

    return res.status(200).json(updated)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao restaurar projeto' })
  }
}

const getMentionableUsers = async (req, res) => {
  try {
    const { id } = req.params
    const TI_AREA = 'Tecnologia da Informação'

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requesters: { include: { user: true } },
        members: { include: { user: true } },
      },
    })
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })

    const map = new Map()
    const consider = (user) => {
      if (user && user.status === 'ATIVO' && user.area === TI_AREA) {
        map.set(user.id, { id: user.id, name: user.name, area: user.area })
      }
    }
    project.requesters.forEach(r => consider(r.user))
    project.members.forEach(m => consider(m.user))

    return res.status(200).json([...map.values()].sort((a, b) => a.name.localeCompare(b.name)))
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar usuários mencionáveis' })
  }
}

const getMentionableProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      select: { id: true, title: true, current_phase: true, archived: true },
      orderBy: { created_at: 'desc' },
    })
    return res.status(200).json(projects)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos mencionáveis' })
  }
}

module.exports = {
  listProjects, listArchivedProjects, listGoLiveProjects, listBacklogProjects,
  getProjectById, createProject, updateProject,
  deleteProject, assignMember, archiveExpiredProjects,
  approveFreshservice, rejectFreshservice, listFreshserviceRequests,
  assignResponsible, cancelProject, listCancelledProjects, restoreProject,
  duplicateProject, getMentionableUsers, getMentionableProjects,
}