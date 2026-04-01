const { PrismaClient } = require('@prisma/client')

const calculateTrafficLight = (go_live, current_traffic_light) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const goLiveDate = new Date(go_live)
  goLiveDate.setHours(0, 0, 0, 0)

  if (goLiveDate < today) return 'VERMELHO'
  return current_traffic_light
}

const prisma = new PrismaClient()

const listProjects = async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { archived: false },
    include: {
      requesters: {
        include: {
          user: { select: { id: true, name: true, area: true } }
        }
      },
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
}

const listArchivedProjects = async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { archived: true },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } }
    },
    orderBy: { archived_at: 'desc' }
  })
  return res.status(200).json(projects)
}

const getProjectById = async (req, res) => {
  const { id } = req.params

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      requesters: {
        include: {
          user: { select: { id: true, name: true, area: true } }
        }
      },
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      status_updates: {
        orderBy: { created_at: 'desc' },
        include: { risks: true, author: { select: { id: true, name: true } } }
      },
      requirements: {
        include: { author: { select: { id: true, name: true } } }
      },
      costs: true,
    }
  })

  if (!project) {
    return res.status(404).json({ error: 'Projeto não encontrado' })
  }

  return res.status(200).json(project)
}

const createProject = async (req, res) => {
  const {
    title, area, requester_name, execution_type,
    priority, description, go_live, owner_id, member_ids,
    requester_ids, responsible_ids, costs
  } = req.body

  if (!title || !description || !go_live) {
    return res.status(400).json({ error: 'Campos obrigatórios: título, descrição e go-live.' })
  }

  const goLiveDate = new Date(go_live)
  const today = new Date()
  let autoTrafficLight = 'VERDE'
  if (goLiveDate < today) {
    autoTrafficLight = 'VERMELHO'
  }

  const project = await prisma.project.create({
    data: {
      title,
      area,
      requester_name: '',
      execution_type: execution_type || 'INTERNA',
      priority: priority || 3,
      description,
      go_live: new Date(go_live),
      owner_id: owner_id || null,
      traffic_light: autoTrafficLight
    }
  })

  if (requester_ids && requester_ids.length > 0) {
    for (const user_id of requester_ids) {
      await prisma.projectRequester.create({
        data: { project_id: project.id, user_id, type: 'SOLICITANTE' }
      })
    }
  }

  if (responsible_ids && responsible_ids.length > 0) {
    for (const user_id of responsible_ids) {
      await prisma.projectRequester.create({
        data: { project_id: project.id, user_id, type: 'RESPONSAVEL' }
      })
    }
  }

  if (member_ids && member_ids.length > 0) {
    for (const user_id of member_ids) {
      await prisma.projectMember.create({
        data: { project_id: project.id, user_id }
      })
    }
  }

  if (costs && costs.length > 0) {
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

  return res.status(201).json(project)
}

const updateProject = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const project = await prisma.project.findUnique({
    where: { id },
    include: { members: true }
  })

  if (!project) {
    return res.status(404).json({ error: 'Projeto não encontrado' })
  }

  const isOwner = project.owner_id === requester.id
  const isMember = project.members.some(m => m.user_id === requester.id)
  const isPrivileged = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)

  if (!isOwner && !isMember && !isPrivileged) {
    return res.status(403).json({ error: 'Sem permissão para editar este projeto' })
  }

  const {
    title, area, requester_name, execution_type,
    priority, description, budget_planned,
    budget_actual, go_live, owner_id,
    current_phase, traffic_light, completion_pct
  } = req.body

  const canUpdateSensitiveFields = isPrivileged

  const dataToUpdate = {
    ...(title && { title }),
    ...(area && { area }),
    ...(requester_name && { requester_name }),
    ...(execution_type && { execution_type }),
    ...(priority && { priority }),
    ...(description && { description }),
    ...(budget_planned !== undefined && { budget_planned }),
    ...(budget_actual !== undefined && { budget_actual }),
    ...(go_live && { go_live: new Date(go_live) }),
    ...(owner_id !== undefined && { owner_id }),
    ...(canUpdateSensitiveFields && current_phase && { current_phase }),
    ...(canUpdateSensitiveFields && traffic_light && { traffic_light }),
    ...(canUpdateSensitiveFields && completion_pct !== undefined && { completion_pct }),
  }

  const shouldArchive =
    (canUpdateSensitiveFields && current_phase === 'ENTREGUE') ||
    (canUpdateSensitiveFields && completion_pct !== undefined && parseInt(completion_pct) === 100)

  if (shouldArchive) {
    dataToUpdate.archived = true
    dataToUpdate.archived_at = new Date()
  }

  const updated = await prisma.project.update({
    where: { id },
    data: dataToUpdate
  })

  return res.status(200).json(updated)
}

const deleteProject = async (req, res) => {
  const { id } = req.params
  const requester = req.user

  const project = await prisma.project.findUnique({
    where: { id },
    include: { requesters: true }
  })

  if (!project) {
    return res.status(404).json({ error: 'Projeto não encontrado' })
  }

  const isAnalistaMaster = requester.role === 'ANALISTA_MASTER'
  const isResponsible = project.requesters.some(
    r => r.user_id === requester.id && r.type === 'RESPONSAVEL'
  )

  if (!isAnalistaMaster && !isResponsible) {
    return res.status(403).json({ error: 'Sem permissão para excluir este projeto' })
  }

  await prisma.project.delete({ where: { id } })
  return res.status(200).json({ message: 'Projeto excluído com sucesso' })
}

const assignMember = async (req, res) => {
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
}

const archiveExpiredProjects = async () => {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  await prisma.project.updateMany({
    where: {
      current_phase: 'ENTREGUE',
      archived: false,
      archived_at: { lte: thirtyDaysAgo }
    },
    data: { archived: true }
  })
}

module.exports = {
  listProjects,
  listArchivedProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  assignMember,
  archiveExpiredProjects
}