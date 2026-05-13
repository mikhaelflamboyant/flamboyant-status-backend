const express = require('express')
const router = express.Router()
const { register, login, forgotPassword } = require('../controllers/auth.controller')
const { validate } = require('../middlewares/validate.middleware')
const { loginSchema, registerSchema } = require('../validators/auth.validator')

router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.post('/forgot-password', forgotPassword)

module.exports = router