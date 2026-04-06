require('dotenv').config()
const app = require('./app')
const { startWeeklyReminderJob } = require('./jobs/weeklyReminder')

const PORT = process.env.PORT || 3000

const notificationsRoutes = require('./routes/notifications.routes')
app.use('/notifications', notificationsRoutes)

const tasksRoutes = require('./routes/tasks.routes')
app.use('/projects/:project_id/tasks', tasksRoutes)

const webhookRoutes = require('./routes/webhook.routes')
app.use('/webhook', webhookRoutes)

const apitokenRoutes = require('./routes/apitoken.routes')
const publicRoutes = require('./routes/public.routes')

app.use('/api-tokens', apitokenRoutes)
app.use('/public', publicRoutes)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  startWeeklyReminderJob()
})