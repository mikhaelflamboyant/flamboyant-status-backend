const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const listNotifications = async (req, res) => {
  const user = req.user

  const notifications = await prisma.notification.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: 'desc' },
    take: 50
  })

  return res.status(200).json(notifications)
}

const markAsRead = async (req, res) => {
  const { id } = req.params
  const user = req.user

  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification || notification.user_id !== user.id) {
    return res.status(404).json({ error: 'Notificação não encontrada' })
  }

  await prisma.notification.update({
    where: { id },
    data: { read: true }
  })

  return res.status(200).json({ message: 'Notificação marcada como lida' })
}

const markAllAsRead = async (req, res) => {
  const user = req.user

  await prisma.notification.updateMany({
    where: { user_id: user.id, read: false },
    data: { read: true }
  })

  return res.status(200).json({ message: 'Todas as notificações marcadas como lidas' })
}

module.exports = { listNotifications, markAsRead, markAllAsRead }