const express = require('express')
const router = express.Router({ mergeParams: true })
const { createRisk, updateRisk, deleteRisk } = require('../controllers/risks.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.post('/', createRisk)
router.patch('/:id', updateRisk)
router.delete('/:id', deleteRisk)

module.exports = router