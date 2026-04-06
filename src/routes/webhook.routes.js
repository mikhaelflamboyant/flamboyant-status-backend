const express = require('express')
const router = express.Router()
const { freshserviceWebhook } = require('../controllers/webhook.controller')

router.post('/freshservice', freshserviceWebhook)

module.exports = router