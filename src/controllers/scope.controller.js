const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TI_AREA = 'Tecnologia da Informação'
const APPROVER_ROLES = ['GERENTE', 'COORDENADOR', 'ANALISTA_MASTER', 'ANALISTA_TESTADOR']

const isFromTI = (requester) =>
  requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)

const canApprove = (requester) =>
  APPROVER_ROLES.includes(requester.role) && isFromTI(requester)

const listScopeItems = async (req, res) => {
  try {
    const { project_id } = req.params
    const requester = req.user

    const items = await prisma.scopeItem.findMany({
      where: { project_id },
      include: {
        tasks: { select: { id: true, completed: true } },
        created_by_user: { select: { id: true, name: true } }
      },
      orderBy: { created_at: 'asc' }
    })

    const result = items.map(item => {
      const hasPending = item.pending_action !== null
      const isOwner = item.created_by === requester.id

      if (hasPending && (isOwner || canApprove(requester))) {
        return {
          ...item,
          display_title: item.pending_title ?? item.title,
          display_description: item.pending_description ?? item.description,
          display_phase: item.pending_phase ?? item.phase,
          display_start_date: item.pending_start_date ?? item.start_date,
          display_end_date: item.pending_end_date ?? item.end_date,
          display_completion_pct: item.pending_completion_pct ?? item.completion_pct,
          showing_pending: true,
        }
      }

      return {
        ...item,
        display_title: item.title,
        display_description: item.description,
        display_phase: item.phase,
        display_start_date: item.start_date,
        display_end_date: item.end_date,
        display_completion_pct: item.completion_pct,
        showing_pending: false,
      }
    })

    return res.status(200).json(result)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao listar escopo' })
  }
}

const createScopeItem = async (req, res) => {
  try {
    const { project_id } = req.params
    const { title, description, phase, start_date, end_date, completion_pct } = req.body
    const requester = req.user

    if (!isFromTI(requester)) {
      return res.status(403).json({ error: 'Sem permissão para gerenciar escopo' })
    }
    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' })
    }

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' })

    const item = await prisma.scopeItem.create({
      data: {
        project_id,
        title,
        description: description || null,
        phase: phase || null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        completion_pct: completion_pct || 0,
        status: 'RASCUNHO',
        created_by: requester.id,
      },
      include: {
        tasks: { select: { id: true, completed: true } },
        created_by_user: { select: { id: true, name: true } }
      }
    })

    return res.status(201).json(item)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar item de escopo' })
  }
}

const updateScopeItem = async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, phase, start_date, end_date, completion_pct } = req.body
    const requester = req.user

    if (!isFromTI(requester)) {
      return res.status(403).json({ error: 'Sem permissão para gerenciar escopo' })
    }

    const item = await prisma.scopeItem.findUnique({ where: { id } })
    if (!item) return res.status(404).json({ error: 'Item não encontrado' })

    if (item.status === 'RASCUNHO' || item.status === 'AGUARDANDO_APROVACAO') {
      const updated = await prisma.scopeItem.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(phase !== undefined && { phase }),
          ...(start_date !== undefined && { start_date: start_date ? new Date(start_date) : null }),
          ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
          ...(completion_pct !== undefined && { completion_pct }),
        },
        include: {
          tasks: { select: { id: true, completed: true } },
          created_by_user: { select: { id: true, name: true } }
        }
      })
      return res.status(200).json(updated)
    }

    const updated = await prisma.scopeItem.update({
      where: { id },
      data: {
        pending_title: title ?? item.title,
        pending_description: description !== undefined ? description : item.description,
        pending_phase: phase !== undefined ? phase : item.phase,
        pending_start_date: start_date !== undefined ? (start_date ? new Date(start_date) : null) : item.start_date,
        pending_end_date: end_date !== undefined ? (end_date ? new Date(end_date) : null) : item.end_date,
        pending_completion_pct: completion_pct !== undefined ? completion_pct : item.completion_pct,
        pending_action: 'EDITAR',
      },
      include: {
        tasks: { select: { id: true, completed: true } },
        created_by_user: { select: { id: true, name: true } }
      }
    })

    await _notifyApprovers(item.project_id, requester, 'edição de atividade do escopo')

    return res.status(200).json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao atualizar item de escopo' })
  }
}

const deleteScopeItem = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    if (!isFromTI(requester)) {
      return res.status(403).json({ error: 'Sem permissão para gerenciar escopo' })
    }

    const item = await prisma.scopeItem.findUnique({ where: { id } })
    if (!item) return res.status(404).json({ error: 'Item não encontrado' })

    if (item.status === 'RASCUNHO' || item.status === 'AGUARDANDO_APROVACAO') {
      await prisma.scopeItem.delete({ where: { id } })
      return res.status(200).json({ message: 'Item excluído com sucesso' })
    }

    const updated = await prisma.scopeItem.update({
      where: { id },
      data: { pending_action: 'EXCLUIR' }
    })

    await _notifyApprovers(item.project_id, requester, 'exclusão de atividade do escopo')

    return res.status(200).json({ ...updated, message: 'Exclusão enviada para aprovação' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao excluir item de escopo' })
  }
}

const requestApproval = async (req, res) => {
  try {
    const { project_id } = req.params
    const requester = req.user

    if (!isFromTI(requester)) {
      return res.status(403).json({ error: 'Sem permissão' })
    }

    await prisma.scopeItem.updateMany({
      where: { project_id, status: 'RASCUNHO' },
      data: { status: 'AGUARDANDO_APROVACAO' }
    })

    const project = await prisma.project.findUnique({ where: { id: project_id } })
    await _notifyApprovers(project_id, requester, `aprovação do escopo do projeto "${project.title}"`)

    return res.status(200).json({ message: 'Aprovação solicitada com sucesso' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao solicitar aprovação' })
  }
}

const approveScope = async (req, res) => {
  try {
    const { project_id } = req.params
    const requester = req.user

    if (!canApprove(requester)) {
      return res.status(403).json({ error: 'Sem permissão para aprovar escopo' })
    }

    const items = await prisma.scopeItem.findMany({
      where: { project_id, status: 'AGUARDANDO_APROVACAO' }
    })

    for (const item of items) {
      await prisma.scopeItem.update({
        where: { id: item.id },
        data: { status: 'APROVADO' }
      })
    }

    const pendingItems = await prisma.scopeItem.findMany({
      where: { project_id, pending_action: { not: null } }
    })

    for (const item of pendingItems) {
      if (item.pending_action === 'EXCLUIR') {
        await prisma.scopeItem.delete({ where: { id: item.id } })
      } else if (item.pending_action === 'EDITAR') {
        await prisma.scopeItem.update({
          where: { id: item.id },
          data: {
            title: item.pending_title ?? item.title,
            description: item.pending_description ?? item.description,
            phase: item.pending_phase ?? item.phase,
            start_date: item.pending_start_date ?? item.start_date,
            end_date: item.pending_end_date ?? item.end_date,
            completion_pct: item.pending_completion_pct ?? item.completion_pct,
            pending_title: null,
            pending_description: null,
            pending_phase: null,
            pending_start_date: null,
            pending_end_date: null,
            pending_completion_pct: null,
            pending_action: null,
          }
        })
      }
    }

    return res.status(200).json({ message: 'Escopo aprovado com sucesso' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao aprovar escopo' })
  }
}

const rejectScope = async (req, res) => {
  try {
    const { project_id } = req.params
    const requester = req.user

    if (!canApprove(requester)) {
      return res.status(403).json({ error: 'Sem permissão para rejeitar escopo' })
    }

    await prisma.scopeItem.updateMany({
      where: { project_id, status: 'AGUARDANDO_APROVACAO' },
      data: { status: 'RASCUNHO' }
    })

    await prisma.scopeItem.updateMany({
      where: { project_id, pending_action: { not: null } },
      data: {
        pending_title: null,
        pending_description: null,
        pending_phase: null,
        pending_start_date: null,
        pending_end_date: null,
        pending_completion_pct: null,
        pending_action: null,
      }
    })

    return res.status(200).json({ message: 'Escopo rejeitado' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao rejeitar escopo' })
  }
}

const _notifyApprovers = async (project_id, requester, context) => {
  const approvers = await prisma.user.findMany({
    where: {
      status: 'ATIVO',
      area: TI_AREA,
      role: { in: APPROVER_ROLES }
    }
  })
  const project = await prisma.project.findUnique({ where: { id: project_id } })
  for (const approver of approvers) {
    if (approver.id === requester.id) continue
    await prisma.notification.create({
      data: {
        user_id: approver.id,
        type: 'APROVACAO_ESCOPO',
        title: 'Escopo aguardando aprovação',
        body: `Solicitação de ${context} no projeto "${project.title}".`,
        link: `/projetos/${project_id}`,
      }
    })
  }
}

module.exports = {
  listScopeItems, createScopeItem, updateScopeItem,
  deleteScopeItem, requestApproval, approveScope, rejectScope
}