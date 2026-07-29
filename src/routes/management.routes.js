const express = require('express')
const router = express.Router()
const { getDashboard, getUsers, getPendingApprovals } = require('../controllers/management.controller')
const { getPermissions, updatePermission } = require('../controllers/rolePermissions.controller')
const { getRecentActions, getRecentActionFilters } = require('../controllers/recentActions.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/dashboard', getDashboard)
router.get('/users', getUsers)
router.get('/approvals', getPendingApprovals)
router.get('/permissions', getPermissions)
router.patch('/permissions', updatePermission)
router.get('/recent-actions/filters', getRecentActionFilters)
router.get('/recent-actions', getRecentActions)

module.exports = router