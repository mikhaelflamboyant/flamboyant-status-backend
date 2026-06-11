const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth.middleware')
const {
  getPersonalDashboard,
  getGoLive,
  getStatusReports,
  getScopeItems,
  getTasks,
  getFeed,
} = require('../controllers/personal.controller')

router.use(authMiddleware)

router.get('/dashboard', getPersonalDashboard)
router.get('/go-live', getGoLive)
router.get('/status-reports', getStatusReports)
router.get('/scope-items', getScopeItems)
router.get('/tasks', getTasks)
router.get('/feed', getFeed)

module.exports = router