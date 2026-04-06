const express = require('express')
const router = express.Router()
const { listTokens, createToken, revokeToken } = require('../controllers/apitoken.controller')
const authMiddleware = require('../middlewares/auth.middleware')

router.use(authMiddleware)
router.get('/', listTokens)
router.post('/', createToken)
router.delete('/:id', revokeToken)

module.exports = router