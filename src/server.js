require('dotenv').config()
const app = require('./app')
const { startWeeklyReminderJob } = require('./jobs/weeklyReminder')

const PORT = process.env.PORT || 3000

const notificationsRoutes = require('./routes/notifications.routes')
app.use('/notifications', notificationsRoutes)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  startWeeklyReminderJob()
})