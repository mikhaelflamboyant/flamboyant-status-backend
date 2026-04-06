const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const apiTokenMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  const apiToken = await prisma.apiToken.findUnique({
    where: { token }
  })

  if (!apiToken || !apiToken.active) {
    return res.status(401).json({ error: 'Token inválido ou revogado' })
  }

  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { last_used: new Date() }
  })

  next()
}

module.exports = apiTokenMiddleware