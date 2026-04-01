const express = require('express')
const router = express.Router()
const { listNotifications, markAsRead, markAllAsRead } = require('../controllers/notifications.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listNotifications)
router.patch('/:id/read', markAsRead)
router.patch('/read-all', markAllAsRead)

module.exports = router