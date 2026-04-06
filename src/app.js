const express = require('express')
const cors = require('cors')
const authRoutes = require('./routes/auth.routes')
const usersRoutes = require('./routes/users.routes')
const projectsRoutes = require('./routes/projects.routes')
const statusRoutes = require('./routes/status.routes')
const risksRoutes = require('./routes/risks.routes')
const requirementsRoutes = require('./routes/requirements.routes')

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor no ar' })
})

app.use('/auth', authRoutes)
app.use('/users', usersRoutes)
app.use('/projects', projectsRoutes)
app.use('/projects/:project_id/status', statusRoutes)
app.use('/projects/:project_id/requirements', requirementsRoutes)
app.use('/status/:status_update_id/risks', risksRoutes)

module.exports = app