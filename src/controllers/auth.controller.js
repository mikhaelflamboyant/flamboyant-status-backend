const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const ALLOWED_DOMAIN = 'flamboyant.com.br'

const validatePassword = (password) => {
  if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'A senha deve ter pelo menos uma letra maiúscula'
  if (!/[a-z]/.test(password)) return 'A senha deve ter pelo menos uma letra minúscula'
  if (!/[0-9]/.test(password)) return 'A senha deve ter pelo menos um número'
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'A senha deve ter pelo menos um caractere especial'
  return null
}

const register = async (req, res) => {
  const { email, password, name, area } = req.body

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' })
  }

  const domain = email.split('@')[1]
  if (domain !== ALLOWED_DOMAIN) {
    return res.status(400).json({ error: `Somente e-mails @${ALLOWED_DOMAIN} são permitidos` })
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    return res.status(400).json({ error: passwordError })
  }

  const userExists = await prisma.user.findUnique({ where: { email } })
  if (userExists) {
    return res.status(400).json({ error: 'E-mail já cadastrado' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword, area: area || '' }
  })

  const { notifyPendingUser } = require('../services/notifications.service')

  const approvers = await prisma.user.findMany({
    where: {
      status: 'ATIVO',
      role: { in: ['SUPERINTENDENTE', 'GERENTE', 'COORDENADOR', 'ANALISTA_MASTER'] }
    }
  })
  await notifyPendingUser(user, approvers)

  return res.status(201).json({
    message: 'Cadastro realizado com sucesso. Aguarde a liberação do seu perfil pelo gerente ou coordenador.',
    user: { id: user.id, email: user.email }
  })
}

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' })
  }

  if (user.status === 'PENDENTE' && user.email !== 'joao@flamboyant.com.br') {
    return res.status(403).json({ error: 'Seu cadastro está aguardando aprovação.' })
  }

  if (user.status === 'RECUSADO') {
    return res.status(403).json({ error: 'Seu cadastro foi recusado. Entre em contato com o administrador.' })
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' })
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, area: user.area },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  return res.status(200).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, area: user.area, created_at: user.created_at }
  })
}

const forgotPassword = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(200).json({ message: 'Se o e-mail existir, você receberá as instruções em breve.' })
  }

  return res.status(200).json({ message: 'Se o e-mail existir, você receberá as instruções em breve.' })
}

module.exports = { register, login, forgotPassword }