const jwt = require('jsonwebtoken')

const makeToken = (overrides = {}) => {
  return jwt.sign(
    {
      id: 'user-test-id',
      email: 'mikhael@flamboyant.com.br',
      role: 'ANALISTA_MASTER',
      name: 'Mikhael Maia',
      area: 'Tecnologia da Informação',
      ...overrides,
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  )
}

module.exports = { makeToken }