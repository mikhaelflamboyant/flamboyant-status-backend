const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')
const logger = require('./lib/logger')

const app = express()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(compression())

app.use(cors({
  origin: [
    'https://statusreport.flamboyant.com.br:4443',
    'http://10.0.0.96:4443',
    'http://localhost:5173',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ strict: false }))
app.use((req, res, next) => {
  req.setEncoding('utf8')
  next()
})

app.get('/health', (req, res) => res.json({ status: 'ok', message: 'Servidor no ar' }))

app.use('/auth', authLimiter, require('./routes/auth.routes'))
app.use('/auth/ldap', authLimiter, require('./routes/ldap.routes'))
app.use('/auth/saml', require('./routes/saml.routes'))
app.use('/users', require('./routes/users.routes'))
app.use('/projects', require('./routes/projects.routes'))
app.use('/projects/:project_id/status', require('./routes/status.routes'))
app.use('/projects/:project_id/requirements', require('./routes/requirements.routes'))
app.use('/projects/:project_id/tasks', require('./routes/tasks.routes'))
app.use('/projects/:project_id/scope', require('./routes/scope.routes'))
app.use('/management', require('./routes/management.routes'))
app.use('/personal', require('./routes/personal.routes'))
app.use('/status/:status_update_id/risks', require('./routes/risks.routes'))
app.use('/notifications', require('./routes/notifications.routes'))
app.use('/webhook', require('./routes/webhook.routes'))
app.use('/api-tokens', require('./routes/apitoken.routes'))
app.use('/public', require('./routes/public.routes'))
app.use('/contacts', require('./routes/contacts.routes'))
app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Erro não tratado')
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor' })
})

module.exports = app