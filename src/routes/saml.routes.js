// SAML desativado — ativar após deploy no servidor
// Para ativar:
// 1. Descomentar este arquivo
// 2. No server.js, descomentar as linhas marcadas com [SAML]

/*
const express = require('express')
const router = express.Router()
const { passport } = require('../config/saml.config')
const { samlCallback } = require('../controllers/saml.controller')
const session = require('express-session')

router.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}))

router.use(passport.initialize())
router.use(passport.session())

router.get('/login',
  passport.authenticate('saml', { failureRedirect: '/login', session: false })
)

router.post('/callback',
  passport.authenticate('saml', { failureRedirect: '/login', session: false }),
  samlCallback
)

module.exports = router
*/

module.exports = require('express').Router()