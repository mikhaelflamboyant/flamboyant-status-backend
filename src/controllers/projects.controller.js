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

    let whereClause = { archived: false }

    if (requester.role === 'ANALISTA_MASTER') {
      whereClause = { archived: false }
    } else if ((requester.role === 'GERENTE' || requester.role === 'COORDENADOR') && isFromTI) {
      whereClause = { archived: false }
    } else if (['SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR'].includes(requester.role)) {
      const user = await prisma.user.findUnique({ where: { id: requester.id } })
      whereClause = { archived: false, area: { contains: user.area } }
    } else {
      whereClause = {
        archived: false,
        OR: [
          { requesters: { some: { user_id: requester.id } } },
          { members: { some: { user_id: requester.id } } }
        ]
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
    const PRIVILEGED_ROLES = ['ANALISTA_MASTER', 'GERENTE', 'COORDENADOR']
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
      title, area, business_unit, execution_type, priority, description,
      go_live, owner_id, member_ids, requester_ids, responsible_ids, costs
    } = req.body

    if (requester.area !== 'Tecnologia da Informação' && requester.role !== 'ANALISTA_MASTER') {
      return res.status(403).json({ error: 'Apenas o time de TI pode criar projetos.' })
    }

    if (!title || !description || !go_live) {
      return res.status(400).json({ error: 'Campos obrigatórios: título, descrição e go-live.' })
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
        priority: priority || 3,
        description,
        go_live: new Date(go_live),
        owner_id: owner_id || null,
        traffic_light: autoTrafficLight
      }
    })

    if (requester_ids?.length > 0) {
      for (const user_id of requester_ids) {
        await prisma.projectRequester.create({ data: { project_id: project.id, user_id, type: 'SOLICITANTE' } })
      }
    }

    if (responsible_ids?.length > 0) {
      for (const user_id of responsible_ids) {
        await prisma.projectRequester.create({ data: { project_id: project.id, user_id, type: 'RESPONSAVEL' } })
      }
    }

    if (member_ids?.length > 0) {
      for (const user_id of member_ids) {
        await prisma.projectMember.create({ data: { project_id: project.id, user_id } })
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
      where: { status: 'ATIVO', role: { in: ['SUPERINTENDENTE', 'ANALISTA_MASTER'] } }
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
      include: { requesters: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isAnalistaMaster = requester.role === 'ANALISTA_MASTER'
    const isRequester = project.requesters.some(r => r.user_id === requester.id && r.type === 'SOLICITANTE')
    const isResponsible = project.requesters.some(r => r.user_id === requester.id && r.type === 'RESPONSAVEL')

    if (!isAnalistaMaster && !isRequester && !isResponsible) {
      return res.status(403).json({ error: 'Sem permissão para editar este projeto' })
    }

    const {
      title, area, business_unit, requester_name, execution_type, priority, description,
      budget_planned, budget_actual, go_live, owner_id, current_phase, traffic_light, completion_pct
    } = req.body

    const dataToUpdate = {
      ...(title && { title }),
      ...(area && { area }),
      ...(requester_name && { requester_name }),
      ...(execution_type && { execution_type }),
      ...(priority && { priority }),
      ...(description && { description }),
      ...(business_unit !== undefined && { business_unit }),
      ...(budget_planned !== undefined && { budget_planned }),
      ...(budget_actual !== undefined && { budget_actual }),
      ...(go_live && { go_live: new Date(go_live) }),
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

    const isAnalistaMaster = requester.role === 'ANALISTA_MASTER'
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

module.exports = {
  listProjects, listArchivedProjects, getProjectById,
  createProject, updateProject, deleteProject,
  assignMember, archiveExpiredProjects
}