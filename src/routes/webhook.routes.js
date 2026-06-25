const express = require('express')
const router = express.Router()
const { freshserviceWebhook } = require('../controllers/webhook.controller')
const webhookAuth = require('../middlewares/webhook.middleware')

router.post('/freshservice', webhookAuth, freshserviceWebhook)

module.exports = router