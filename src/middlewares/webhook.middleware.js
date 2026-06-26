const crypto = require('crypto')
const logger = require('../lib/logger')

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(String(b)).digest()
  return crypto.timingSafeEqual(ha, hb)
}

const webhookAuth = (req, res, next) => {
  const expected = process.env.FRESHSERVICE_WEBHOOK_SECRET

  if (!expected) {
    logger.error('FRESHSERVICE_WEBHOOK_SECRET não configurado; webhook bloqueado')
    return res.status(503).json({ error: 'Webhook não configurado' })
  }

  const received = req.headers['x-webhook-secret']

  if (!received || !safeEqual(received, expected)) {
    logger.warn({ ip: req.ip }, 'Tentativa de webhook com segredo inválido')
    return res.status(401).json({ error: 'Não autorizado' })
  }

  next()
}

module.exports = webhookAuth
