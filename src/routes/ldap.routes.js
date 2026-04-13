const express = require('express')
const router = express.Router()
const { ldapLogin, ldapSync } = require('../controllers/ldap.controller')
const { authMiddleware } = require('../middlewares/auth.middleware')
const { requireRole } = require('../middlewares/role.middleware')

router.post('/login', ldapLogin)
router.post('/sync', authMiddleware, requireRole('ANALISTA_MASTER', 'ANALISTA_TESTADOR'), ldapSync)

module.exports = router