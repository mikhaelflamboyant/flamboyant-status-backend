const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const listPublicProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { archived: false },
      include: {
        requesters: {
          include: { user: { select: { id: true, name: true, area: true } } }
        },
        costs: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { risks: true, author: { select: { id: true, name: true } } }
        },
        tasks: {
          include: {
            author: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    return res.status(200).json(projects)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos públicos' })
  }
}

const getPublicProject = async (req, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requesters: {
          include: { user: { select: { id: true, name: true, area: true } } }
        },
        costs: true,
        status_updates: {
          orderBy: { created_at: 'desc' },
          include: { risks: true, author: { select: { id: true, name: true } } }
        },
        tasks: {
          include: {
            author: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } }
          }
        },
        requirements: {
          include: { author: { select: { id: true, name: true } } }
        }
      }
    })

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })

    return res.status(200).json(project)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao buscar projeto' })
  }
}

const listPublicArchivedProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { archived: true },
      include: {
        requesters: {
          include: { user: { select: { id: true, name: true, area: true } } }
        },
        status_updates: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { author: { select: { id: true, name: true } } }
        }
      },
      orderBy: { archived_at: 'desc' }
    })

    return res.status(200).json(projects)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar projetos arquivados públicos' })
  }
}

module.exports = { listPublicProjects, getPublicProject, listPublicArchivedProjects }