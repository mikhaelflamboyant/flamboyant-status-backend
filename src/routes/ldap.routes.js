const express = require('express')
const router = express.Router()
const { ldapLogin } = require('../controllers/ldap.controller')

router.post('/login', ldapLogin)

module.exports = router