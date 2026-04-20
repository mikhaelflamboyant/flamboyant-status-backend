const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ strict: false }))
app.use((req, res, next) => {
  req.setEncoding('utf8')
  next()
})

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Servidor no ar' }))

app.use('/auth', require('./routes/auth.routes'))
app.use('/auth/ldap', require('./routes/ldap.routes'))
app.use('/auth/saml', require('./routes/saml.routes'))
app.use('/users', require('./routes/users.routes'))
app.use('/projects', require('./routes/projects.routes'))
app.use('/projects/:project_id/status', require('./routes/status.routes'))
app.use('/projects/:project_id/requirements', require('./routes/requirements.routes'))
app.use('/projects/:project_id/tasks', require('./routes/tasks.routes'))
app.use('/projects/:project_id/scope', require('./routes/scope.routes'))
app.use('/management', require('./routes/management.routes'))
app.use('/status/:status_update_id/risks', require('./routes/risks.routes'))
app.use('/notifications', require('./routes/notifications.routes'))
app.use('/webhook', require('./routes/webhook.routes'))
app.use('/api-tokens', require('./routes/apitoken.routes'))
app.use('/public', require('./routes/public.routes'))

module.exports = app