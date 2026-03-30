const express = require('express')
const router = express.Router({ mergeParams: true })
const { getRequirement, createRequirement, updateRequirement } = require('../controllers/requirements.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)

router.get('/', getRequirement)
router.post('/', createRequirement)
router.patch('/', updateRequirement)

module.exports = router