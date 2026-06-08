const prisma = require('../lib/prisma')
const logger = require('../lib/logger')
const touchProject = (project_id) =>
  prisma.project.update({ where: { id: project_id }, data: { updated_at: new Date() } })

const TI_AREA = 'Tecnologia da Informação'

const { syncMentions } = require('../services/mentions.service')

const canMention = (requester, project) => {
  const isFromTI = requester.area === TI_AREA ||
    ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
  const isResponsible = project.requesters?.some(
    r => r.user_id === requester.id && r.type === 'RESPONSAVEL'
  )
  return isFromTI && isResponsible
}

const canManageTasks = async (requester, projectId) => {
  const isFromTI = requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
  if (!isFromTI) return false
  if (['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR'].includes(requester.role)) return true
  if (requester.role === 'ANALISTA') {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { requesters: true, members: true }
    })
    if (!project) return false
    const isRequester = project.requesters.some(r => r.user_id === requester.id)
    const isMember = project.members.some(m => m.user_id === requester.id)
    return isRequester || isMember
  }
  return false
}

const listTasks = async (req, res) => {
  try {
    const { project_id } = req.params
    const requester = req.user

    const isFromTI = requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role)
    if (!isFromTI) {
      return res.status(403).json({ error: 'Sem permissão para visualizar tarefas' })
    }

    const tasks = await prisma.task.findMany({
      where: { project_id },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
        date_history: {
          orderBy: { changed_at: 'desc' },
          include: { changed_by_user: { select: { id: true, name: true } } }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    return res.status(200).json(tasks)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao listar tarefas' })
  }
}

const createTask = async (req, res) => {
  try {
    const { project_id } = req.params
    const { title, description, assignee_id, assignee_ids, phase, due_date, start_date, end_date, scope_item_id } = req.body
    const requester = req.user

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' })
    }

    const allowed = await canManageTasks(requester, project_id)
    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissão para criar tarefas' })
    }

    const task = await prisma.task.create({
      data: {
        project_id,
        author_id: requester.id,
        title,
        description: description || null,
        assignee_id: assignee_id || null,
        phase: phase || null,
        due_date: due_date ? new Date(due_date) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        scope_item_id: scope_item_id || null,
      },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      }
    })
    await touchProject(project_id)

    const allAssigneeIds = assignee_ids?.length > 0
      ? assignee_ids
      : assignee_id ? [assignee_id] : []

    for (const uid of allAssigneeIds) {
      await prisma.taskAssignee.create({
        data: { task_id: task.id, user_id: uid }
      })
    }

    const taskWithAssignees = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true } } } },
      }
    })

    await touchProject(project_id)

    let mentionResult = { invalidUserIds: [] }
    const projectForMention = await prisma.project.findUnique({
      where: { id: project_id }, include: { requesters: true }
    })
    if (canMention(requester, projectForMention)) {
      mentionResult = await syncMentions({
        source_type: 'TASK',
        source_id: task.id,
        project_id,
        text: [title, description].filter(Boolean).join('\n'),
        requester,
      })
    }

    return res.status(201).json({ ...taskWithAssignees, _mention_warning: mentionResult.invalidUserIds })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao criar tarefa' })
  }
}

const updateTask = async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, assignee_id, assignee_ids, phase, due_date, start_date, end_date } = req.body
    const requester = req.user

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: { include: { requesters: true, members: true } },
        assignees: true,
      }
    })

    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' })

    const isPrivileged = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR'].includes(requester.role)
    const isResponsible = task.project.requesters.some(r => r.user_id === requester.id && r.type === 'RESPONSAVEL')
    const isAssignee = task.assignee_id === requester.id ||
      task.assignees?.some(a => a.user_id === requester.id)

    if (!isPrivileged && !(isResponsible && isAssignee)) {
      return res.status(403).json({ error: 'Apenas o responsável pelo projeto que também é responsável pela tarefa pode editá-la' })
    }

    const originalTask = await prisma.task.findUnique({ where: { id } })

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(assignee_id !== undefined && { assignee_id }),
        ...(phase !== undefined && { phase }),
        ...(due_date !== undefined && { due_date: due_date ? new Date(due_date) : null }),
        ...(start_date !== undefined && { start_date: start_date ? new Date(start_date) : null }),
        ...(end_date !== undefined && { end_date: end_date ? new Date(end_date) : null }),
      },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      }
    })
    await touchProject(task.project_id)

    if (assignee_ids !== undefined) {
      await prisma.taskAssignee.deleteMany({ where: { task_id: id } })
      for (const uid of assignee_ids) {
        await prisma.taskAssignee.create({ data: { task_id: id, user_id: uid } })
      }
    }

    if (end_date !== undefined && String(end_date) !== String(originalTask.end_date)) {
      await prisma.taskDateHistory.create({
        data: {
          task_id: id,
          changed_by: requester.id,
          previous_date: originalTask.end_date || null,
          new_date: end_date ? new Date(end_date) : null,
        }
      })
    }

    let mentionResult = { invalidUserIds: [] }
    if (canMention(requester, task.project)) {
      mentionResult = await syncMentions({
        source_type: 'TASK',
        source_id: id,
        project_id: task.project_id,
        text: [title ?? task.title, description ?? task.description].filter(Boolean).join('\n'),
        requester,
      })
    }

    return res.status(200).json({ ...updated, _mention_warning: mentionResult.invalidUserIds })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao atualizar tarefa' })
  }
}

const completeTask = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' })

    const taskWithAssignees = await prisma.task.findUnique({
      where: { id },
      include: { assignees: true }
    })
    const isAuthor = task.author_id === requester.id
    const isAssignee = task.assignee_id === requester.id ||
      taskWithAssignees.assignees?.some(a => a.user_id === requester.id)

    if (!isAuthor && !isAssignee) {
      return res.status(403).json({ error: 'Apenas o autor ou um responsável pela tarefa pode concluí-la' })
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { completed: !task.completed },
      include: {
        author: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      }
    })
    await touchProject(task.project_id)

    return res.status(200).json(updated)
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao concluir tarefa' })
  }
}

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params
    const requester = req.user

    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' })

    const allowed = await canManageTasks(requester, task.project_id)
    if (!allowed) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta tarefa' })
    }

    await prisma.task.delete({ where: { id } })
    await touchProject(task.project_id)
    return res.status(200).json({ message: 'Tarefa excluída com sucesso' })
  } catch (err) {
    logger.error(err)
    return res.status(500).json({ error: 'Erro ao excluir tarefa' })
  }
}

module.exports = { listTasks, createTask, updateTask, completeTask, deleteTask }