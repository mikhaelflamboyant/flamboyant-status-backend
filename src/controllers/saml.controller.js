// SAML desativado — ativar após deploy no servidor

/*
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const samlCallback = async (req, res) => {
  try {
    const profile = req.user

    const email =
      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
      profile.nameID ||
      profile.email

    const name =
      profile['http://schemas.microsoft.com/identity/claims/displayname'] ||
      profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
      profile.displayName ||
      email

    if (!email) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=email_not_found`)
    }

    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email,
          password: '',
          role: 'ANALISTA',
          status: 'PENDENTE',
          area: '',
        }
      })
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=pending_approval`)
    }

    if (user.status === 'PENDENTE') {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=pending_approval`)
    }

    if (user.status === 'RECUSADO') {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=rejected`)
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, area: user.area },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      area: user.area,
      created_at: user.created_at
    }))

    return res.redirect(`${process.env.FRONTEND_URL}/auth/saml/success?token=${token}&user=${userData}`)
  } catch (err) {
    console.error('SAML callback erro:', err)
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=saml_error`)
  }
}

module.exports = { samlCallback }
*/

module.exports = {}