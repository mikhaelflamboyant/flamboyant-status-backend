const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/auth.middleware')
const { requireRole } = require('../middlewares/role.middleware')
const { listTokens, createToken, revokeToken, listAllTokens } = require('../controllers/apitoken.controller')

router.use(authMiddleware)
router.use(requireRole('ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'SUPERINTENDENTE', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'SUPERVISOR', 'ANALISTA'))
router.get('/', listTokens)
router.get('/history', listAllTokens)
router.post('/', createToken)
router.delete('/:id', revokeToken)

module.exports = router