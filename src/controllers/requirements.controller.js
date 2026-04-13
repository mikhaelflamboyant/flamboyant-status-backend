const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const getRequirement = async (req, res) => {
  try {
    const { project_id } = req.params

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: { project_id },
      include: {
        author: { select: { id: true, name: true } },
        history: {
          orderBy: { edited_at: 'desc' },
          include: { editor: { select: { id: true, name: true } } }
        }
      }
    })

    if (!requirement) {
      return res.status(404).json({ error: 'Requisitos ainda não cadastrados para este projeto' })
    }

    return res.status(200).json(requirement)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar requisitos' })
  }
}

const createRequirement = async (req, res) => {
  try {
    const { project_id } = req.params
    const { content } = req.body
    const requester = req.user

    if (!content) {
      return res.status(400).json({ error: 'Campo obrigatório: content' })
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { members: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isOwner = project.owner_id === requester.id
    const isMember = project.members.some(m => m.user_id === requester.id)
    const isResponsible = await prisma.projectRequester.findFirst({
      where: { project_id, user_id: requester.id, type: 'RESPONSAVEL' }
    })
    const isPrivileged = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)

    if (!isOwner && !isMember && !isResponsible && !isPrivileged) {
      return res.status(403).json({ error: 'Sem permissão para criar requisitos neste projeto' })
    }

    const existing = await prisma.requirement.findFirst({ where: { project_id } })
    if (existing) {
      return res.status(400).json({ error: 'Requisitos já cadastrados. Use o método PATCH para atualizar.' })
    }

    const requirement = await prisma.requirement.create({
      data: { project_id, author_id: requester.id, content },
      include: { author: { select: { id: true, name: true } } }
    })

    return res.status(201).json(requirement)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar requisitos' })
  }
}

const updateRequirement = async (req, res) => {
  try {
    const { project_id } = req.params
    const { content } = req.body
    const requester = req.user

    if (!content) {
      return res.status(400).json({ error: 'Campo obrigatório: content' })
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { members: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' })
    }

    const isOwner = project.owner_id === requester.id
    const isMember = project.members.some(m => m.user_id === requester.id)
    const isResponsible = await prisma.projectRequester.findFirst({
      where: { project_id, user_id: requester.id, type: 'RESPONSAVEL' }
    })
    const isPrivileged = ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'].includes(requester.role)

    if (!isOwner && !isMember && !isResponsible && !isPrivileged) {
      return res.status(403).json({ error: 'Sem permissão para editar requisitos neste projeto' })
    }

    const requirement = await prisma.requirement.findFirst({ where: { project_id } })
    if (!requirement) {
      return res.status(404).json({ error: 'Requisitos não encontrados para este projeto' })
    }

    await prisma.requirementHistory.create({
      data: {
        requirement_id: requirement.id,
        editor_id: requester.id,
        content_snapshot: requirement.content
      }
    })

    const updated = await prisma.requirement.update({
      where: { id: requirement.id },
      data: { content },
      include: {
        author: { select: { id: true, name: true } },
        history: {
          orderBy: { edited_at: 'desc' },
          include: { editor: { select: { id: true, name: true } } }
        }
      }
    })

    return res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao atualizar requisitos' })
  }
}

module.exports = { getRequirement, createRequirement, updateRequirement }