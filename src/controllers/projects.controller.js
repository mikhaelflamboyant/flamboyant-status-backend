const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const {
  notifyUserLinkedToProject,
  notifyNewProject
} = require('../services/notifications.service')

const listProjects = async (req, res) => {
  try {
    const requester = req.user
    const TI_AREA = 'Tecnologia da Informação'
    const isFromTI = requester.area === TI_AREA

    let whereClause = { archived: false, origin: 'NORMAL' }

    if (requester.role === 'ANALISTA_MASTER' || requester.role === 'ANALISTA_TESTADOR') {
      whereClause = { archived: false, origin: 'NORMAL' }
    } else if ((requester.role === 'GERENTE' || requester.role === 'COORDENADOR') && isFromTI) {
      whereClause = { archived: false, origin: 'NORMAL' }
    } else if (['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR'].includes(requester.role)) {
      const user = await prisma.user.findUnique({ where: { id: requester.id } })
      whereClause = { archived: false, origin: 'NORMAL', area: { contains: user.area } }
    } else {
      whereClause = {
        archived: false,
        origin: 'NORMAL',
        OR: [
          { requesters: { some: { user_id: requester.id } } },
          { members: { some: { user_id: requester.id } } }
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

    for (const project of projects) {
      const goLiveDate = new Date(project.go_live)
      goLiveDate.setHours(0, 0, 0, 0)
      if (goLiveDate < today && project.traffic_light === 'VERDE') {
        await prisma.project.update({
          where: { id: project.id },
          data: { traffic_light: 'VERMELHO' }
        })
        project.traffic_light = 'VERMELHO'
      }
    }

    return res.status(200).json(projects)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos' })
  }
}

const listArchivedProjects = async (req, res) => {
  try {
    const requester = req.user
    const TI_AREA = 'Tecnologia da Informação'
    const isFromTI = requester.area === TI_AREA
    const PRIVILEGED_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']
    const MANAGER_ROLES = ['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR']

    let whereClause = { archived: true }

    if (PRIVILEGED_ROLES.includes(requester.role) && isFromTI) {
      whereClause = { archived: true }
    } else if (MANAGER_ROLES.includes(requester.role)) {
      const user = await prisma.user.findUnique({ where: { id: requester.id } })
      whereClause = { archived: true, area: { contains: user.area } }
    } else {
      whereClause = {
        archived: true,
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
    console.error(err)
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
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar projeto' })
  }
}

const createProject = async (req, res) => {
  try {
    const requester = req.user
    const {
      title, area, business_unit, execution_type, level, description,
      go_live, owner_id, member_ids, requester_ids, responsible_ids, costs
    } = req.body

    if (requester.area !== 'Tecnologia da Informação' && !['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)) {
      return res.status(403).json({ error: 'Apenas o time de TI pode criar projetos.' })
    }

    if (!title || !description) {
      return res.status(400).json({ error: 'Campos obrigatórios: título e descrição.' })
    }

    const goLiveDate = new Date(go_live)
    const today = new Date()
    const autoTrafficLight = goLiveDate < today ? 'VERMELHO' : 'VERDE'

    const project = await prisma.project.create({
      data: {
        title, area,
        business_unit: business_unit || null,
        requester_name: '',
        execution_type: execution_type || 'INTERNA',
        level: level || null,
        description,
        go_live: go_live ? new Date(go_live) : null,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        owner_id: owner_id || null,
        traffic_light: autoTrafficLight
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
    console.error(err)
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
      title, area, business_unit, execution_type, level, description,
      go_live, owner_id, current_phase, traffic_light, completion_pct,
      requester_ids, requester_names, responsible_ids, responsible_names,
      member_ids, member_names, costs
    } = req.body

    const dataToUpdate = {
      ...(title && { title }),
      ...(area && { area }),
      ...(execution_type && { execution_type }),
      ...(level && { level }),
      ...(description && { description }),
      ...(business_unit !== undefined && { business_unit }),
      ...(go_live && { go_live: new Date(go_live) }),
      ...(req.body.start_date !== undefined && { start_date: req.body.start_date ? new Date(req.body.start_date) : null }),
      ...(owner_id !== undefined && { owner_id }),
      ...(current_phase && { current_phase }),
      ...(traffic_light && { traffic_light }),
      ...(completion_pct !== undefined && { completion_pct }),
    }

    if (current_phase === 'ENTREGUE') {
      dataToUpdate.completion_pct = 100
    }

    const shouldArchive =
      current_phase === 'ENTREGUE' ||
      (completion_pct !== undefined && parseInt(completion_pct) === 100)

    if (shouldArchive) {
      dataToUpdate.archived = true
      dataToUpdate.archived_at = new Date()
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

    // Atualiza solicitantes se enviados
    if (requester_ids !== undefined || requester_names !== undefined) {
      await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'SOLICITANTE' } })
      for (const user_id of (requester_ids || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } }, type: 'SOLICITANTE' } })
      }
      for (const person of (requester_names || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area, type: 'SOLICITANTE' } })
      }
    }

    // Atualiza responsáveis se enviados
    if (responsible_ids !== undefined || responsible_names !== undefined) {
      await prisma.projectRequester.deleteMany({ where: { project_id: id, type: 'RESPONSAVEL' } })
      for (const user_id of (responsible_ids || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } }, type: 'RESPONSAVEL' } })
      }
      for (const person of (responsible_names || [])) {
        await prisma.projectRequester.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area, type: 'RESPONSAVEL' } })
      }
      // Atualiza owner para primeiro responsável com user_id real
      if (requester_ids?.length > 0 || responsible_ids?.length > 0) {
        const firstResponsible = (responsible_ids || [])[0] || null
        await prisma.project.update({ where: { id }, data: { owner_id: firstResponsible || null } })
      }
    }

    // Atualiza membros se enviados
    if (member_ids !== undefined || member_names !== undefined) {
      await prisma.projectMember.deleteMany({ where: { project_id: id } })
      for (const user_id of (member_ids || [])) {
        await prisma.projectMember.create({ data: { project: { connect: { id } }, user: { connect: { id: user_id } } } })
      }
      for (const person of (member_names || [])) {
        await prisma.projectMember.create({ data: { project: { connect: { id } }, manual_name: person.name, manual_area: person.area } })
      }
    }

    // Atualiza custos se enviados
    if (costs !== undefined) {
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

    return res.status(200).json(updated)
  } catch (err) {
    console.error(err)
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
    console.error(err)
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
    console.error(err)
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
      area,
      business_unit,
      level,
      go_live,
      go_live_undefined,
      responsible_id,
      responsible_name,
      responsible_area,
      execution_type,
    } = req.body

    const project = await prisma.project.update({
      where: { id },
      data: {
        area,
        business_unit,
        level: parseInt(level),
        go_live: go_live_undefined ? null : (go_live ? new Date(go_live) : null),
        execution_type: execution_type || 'INTERNA',
        origin: 'NORMAL',
      }
    })

    // Vincular responsável
    if (responsible_id) {
      await prisma.projectRequester.create({
        data: { project_id: id, user_id: responsible_id, type: 'RESPONSAVEL' }
      })
    } else if (responsible_name) {
      await prisma.projectRequester.create({
        data: { project_id: id, manual_name: responsible_name, manual_area: responsible_area || '', type: 'RESPONSAVEL' }
      })
    }

    return res.status(200).json(project)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao aprovar projeto' })
  }
}

const rejectFreshservice = async (req, res) => {
  try {
    const { id } = req.params
    await prisma.project.delete({ where: { id } })
    return res.status(200).json({ message: 'Solicitação rejeitada e removida' })
  } catch (err) {
    console.error(err)
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

module.exports = {
  listProjects, listArchivedProjects, getProjectById,
  createProject, updateProject, deleteProject,
  assignMember, archiveExpiredProjects,
  approveFreshservice, rejectFreshservice, listFreshserviceRequests
}