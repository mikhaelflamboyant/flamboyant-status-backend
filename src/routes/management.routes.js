const express = require('express')
const router = express.Router()
const { getDashboard, getUsers, getPendingApprovals } = require('../controllers/management.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/dashboard', getDashboard)
router.get('/users', getUsers)
router.get('/approvals', getPendingApprovals)

module.exports = router