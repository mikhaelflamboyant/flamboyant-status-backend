const express = require('express')
const router = express.Router({ mergeParams: true })
const { getRequirement, createRequirement, updateRequirement, approveRequirement, rejectRequirement } = require('../controllers/requirements.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', getRequirement)
router.post('/', createRequirement)
router.patch('/', updateRequirement)
router.post('/approve', approveRequirement)
router.post('/reject', rejectRequirement)

module.exports = router