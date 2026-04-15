const express = require('express')
const router = express.Router({ mergeParams: true })
const {
  listStatusUpdates,
  getStatusUpdateById,
  createStatusUpdate,
  updateStatusUpdate,
  deleteStatusUpdate
} = require('../controllers/status.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', listStatusUpdates)
router.get('/:id', getStatusUpdateById)
router.post('/', createStatusUpdate)
router.patch('/:id', updateStatusUpdate)
router.delete('/:id', deleteStatusUpdate)

module.exports = router