const prisma = require('../lib/prisma')
const { notifyUserLinkedToProject, notifyNewProject } = require('../services/notifications.service')
const logger = require('../lib/logger')

const listProjects = async (req, res) => {
  try {
    const requester = req.user
    const TI_AREA = 'Tecnologia da Informação'
    const isFromTI = requester.area === TI_AREA

    let whereClause = { archived: false, origin: 'NORMAL', current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] } }

    if (requester.role === 'ANALISTA_MASTER' || requester.role === 'ANALISTA_TESTADOR') {
      whereClause = { archived: false, origin: 'NORMAL', current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] } }
    } else if ((requester.role === 'GERENTE' || requester.role === 'COORDENADOR') && isFromTI) {
      whereClause = { archived: false, origin: 'NORMAL', current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] } }
    } else if (['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR'].includes(requester.role)) {
      const user = await prisma.user.findUnique({ where: { id: requester.id } })
      whereClause = { archived: false, origin: 'NORMAL', current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] }, area: { contains: user.area } }
    } else {
      whereClause = {
        archived: false,
        origin: 'NORMAL',
        current_phase: { notIn: ['ENTREGUE', 'BACKLOG', 'SUPORTE'] },
        OR: [
          { requesters: { some: { user_id: requester.id } } },
          { members: { some: { user_id: requester.id } } },
        ]
      }
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
    }

    const projects = await prisma.project.findMany({
      where: whereClause,
      include: {
        requesters: { include: { user: { select: { id: true, name: true, area: true } } } },
        owner: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        costs: true,
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
    const projects = await prisma.project.findMany({
      where: {
        current_phase: 'SUPORTE',
        archived: false,
        origin: 'NORMAL',
      },
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
    const TI_AREA = 'Tecnologia da Informação'
    const isFromTI = requester.area === TI_AREA
    const PRIVILEGED_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const MANAGER_ROLES = ['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR']

    let whereClause = { archived: true, current_phase: { not: 'CANCELADO' } }

    if (PRIVILEGED_ROLES.includes(requester.role) && isFromTI) {
      whereClause = { archived: true, current_phase: { not: 'CANCELADO' } }
    } else if (MANAGER_ROLES.includes(requester.role)) {
      const user = await prisma.user.findUnique({ where: { id: requester.id } })
      whereClause = { archived: true, current_phase: { not: 'CANCELADO' }, area: { contains: user.area } }
    } else {
      whereClause = {
        archived: true,
        current_phase: { not: 'CANCELADO' },
        OR: [
          { requesters: { some: { user_id: requester.id } } },
          { members: { some: { user_id: requester.id } } }
        ]
      }
    }

    const { filtro } = req.query

    if (filtro === 'entregues_mes') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      whereClause = {
        ...whereClause,
        archived_at: { gte: startOfMonth }
      }
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
        area: { in: project.area.split(', ') }
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

    if (current_phase && current_phase !== project.current_phase && !project.legacy) {
      const scopeItems = await prisma.scopeItem.findMany({
        where: { project_id: id, status: 'APROVADO' }
      })

      const stageComplete = (stageKey) => {
        const hasPendingActions = scopeItems.some(s => s.pending_action)
        if (hasPendingActions) return false

        const items = scopeItems.filter(s => s.stage === stageKey)
        if (items.length === 0) return true
        return items.every(s => s.completion_date !== null)
      }

      const TRANSITIONS = {
        DESENVOLVIMENTO: () => stageComplete('PLANEJAMENTO'),
        ENTREGUE: () => stageComplete('EXECUCAO'),
        SUPORTE: () => stageComplete('GO_LIVE'),
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
      ...(go_live && { go_live: new Date(go_live) }),
      ...(req.body.start_date !== undefined && { start_date: req.body.start_date ? new Date(req.body.start_date) : null }),
      ...(owner_id !== undefined && { owner_id }),
      ...(current_phase && { current_phase }),
      ...(traffic_light && { traffic_light }),
      ...(completion_pct !== undefined && { completion_pct }),
    }

    if (go_live) {
      const newGoLive = new Date(go_live)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (newGoLive > today) {
        dataToUpdate.traffic_light = 'VERDE'
      } else {
        dataToUpdate.traffic_light = 'VERMELHO'
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

    if (go_live && new Date(go_live).toISOString() !== new Date(project.go_live).toISOString()) {
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

    return res.status(200).json(project)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao aprovar projeto' })
  }
}

const rejectFreshservice = async (req, res) => {
  try {
    const { id } = req.params
    await prisma.project.delete({ where: { id } })
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
      },
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
    const isFromTI = requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    if (!isFromTI) return res.status(403).json({ error: 'Sem permissão' })

    const canAssignOthers = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    if (!canAssignOthers && user_id !== requester.id) {
      return res.status(403).json({ error: 'Você só pode se vincular a si mesmo' })
    }

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

    const dataToUpdate = {
      current_phase: 'RECEBIDA',
      owner_id: user_id || null,
      origin: 'NORMAL',
      ...(description && { description }),
      ...(execution_type && { execution_type }),
      ...(start_date && { start_date: new Date(start_date) }),
      go_live: go_live_undefined ? null : (go_live ? new Date(go_live) : project.go_live),
    }

    await prisma.project.update({ where: { id }, data: dataToUpdate })

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
    const projects = await prisma.project.findMany({
      where: { current_phase: 'CANCELADO', archived: true },
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

module.exports = {
  listProjects, listArchivedProjects, listGoLiveProjects, listBacklogProjects,
  getProjectById, createProject, updateProject,
  deleteProject, assignMember, archiveExpiredProjects,
  approveFreshservice, rejectFreshservice, listFreshserviceRequests,
  assignResponsible, cancelProject, listCancelledProjects, restoreProject
}