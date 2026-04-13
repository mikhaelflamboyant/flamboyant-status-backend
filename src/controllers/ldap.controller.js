const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const { authenticateUser, syncUsersFromAD } = require('../services/ldap.service')
const prisma = new PrismaClient()

const ldapLogin = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
    }

    const ldapUser = await authenticateUser(email, password)
    if (!ldapUser) {
      return res.status(401).json({ error: 'Credenciais inválidas no Active Directory.' })
    }

    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      const name = ldapUser.displayName || ldapUser.cn || email
      user = await prisma.user.create({
        data: {
          email,
          name: Array.isArray(name) ? name[0] : name,
          password: '',
          role: 'ANALISTA',
          status: 'ATIVO',
          area: 'Tecnologia da Informação',
        }
      })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, area: user.area },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        area: user.area,
        created_at: user.created_at,
      }
    })
  } catch (err) {
    console.error('LDAP login erro:', err)
    return res.status(500).json({ error: 'Erro ao conectar com o Active Directory.' })
  }
}

const ldapSync = async (req, res) => {
  try {
    const entries = await syncUsersFromAD()
    let created = 0
    let existing = 0

    for (const entry of entries) {
      const email = entry.mail
      const name = entry.displayName || entry.cn || email
      if (!email) continue

      const existing_user = await prisma.user.findUnique({ where: { email: Array.isArray(email) ? email[0] : email } })
      if (existing_user) {
        existing++
        continue
      }

      await prisma.user.create({
        data: {
          email: Array.isArray(email) ? email[0] : email,
          name: Array.isArray(name) ? name[0] : name,
          password: '',
          role: 'ANALISTA',
          status: 'ATIVO',
          area: '',
        }
      })
      created++
    }

    return res.json({ message: `Sincronização concluída. ${created} usuário(s) criado(s), ${existing} já existiam.`, created, existing })
  } catch (err) {
    console.error('LDAP sync erro:', err)
    return res.status(500).json({ error: 'Erro ao sincronizar com o Active Directory.' })
  }
}

module.exports = { ldapLogin, ldapSync }