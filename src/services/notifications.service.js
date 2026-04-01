const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const createNotification = async ({ user_id, type, title, body, link }) => {
  return prisma.notification.create({
    data: { user_id, type, title, body, link: link || null }
  })
}

const notifyUserLinkedToProject = async (project, user_id) => {
  await createNotification({
    user_id,
    type: 'VINCULADO_PROJETO',
    title: 'Você foi vinculado a um projeto',
    body: `Você foi adicionado ao projeto "${project.title}"`,
    link: `/projetos/${project.id}`
  })
}

const notifyNewProject = async (project, users) => {
  for (const user of users) {
    await createNotification({
      user_id: user.id,
      type: 'NOVO_PROJETO',
      title: 'Novo projeto criado',
      body: `O projeto "${project.title}" foi criado na área ${project.area}`,
      link: `/projetos/${project.id}`
    })
  }
}

const notifyNewStatus = async (project, statusUpdate, users) => {
  for (const user of users) {
    await createNotification({
      user_id: user.id,
      type: 'NOVO_STATUS',
      title: 'Novo status report',
      body: `O projeto "${project.title}" recebeu uma nova atualização de status`,
      link: `/projetos/${project.id}`
    })
  }
}

const notifyPendingUser = async (pendingUser, approvers) => {
  for (const approver of approvers) {
    await createNotification({
      user_id: approver.id,
      type: 'USUARIO_PENDENTE',
      title: 'Novo usuário aguardando aprovação',
      body: `${pendingUser.name} (${pendingUser.email}) está aguardando aprovação`,
      link: '/usuarios'
    })
  }
}

const notifyProjectDelayed = async (project, users) => {
  for (const user of users) {
    await createNotification({
      user_id: user.id,
      type: 'PROJETO_ATRASADO',
      title: 'Projeto atrasado',
      body: `O projeto "${project.title}" está com o farol vermelho`,
      link: `/projetos/${project.id}`
    })
  }
}

const notifyProjectNearDeadline = async (project, users) => {
  for (const user of users) {
    await createNotification({
      user_id: user.id,
      type: 'PROXIMO_GO_LIVE',
      title: 'Projeto próximo do go-live',
      body: `O projeto "${project.title}" tem go-live em 7 dias ou menos`,
      link: `/projetos/${project.id}`
    })
  }
}

module.exports = {
  createNotification,
  notifyUserLinkedToProject,
  notifyNewProject,
  notifyNewStatus,
  notifyPendingUser,
  notifyProjectDelayed,
  notifyProjectNearDeadline,
}