const request = require('supertest')
const app = require('../app')
const prisma = require('../lib/prisma')
const { makeToken } = require('./helpers')

const token = makeToken()
const analista = makeToken({ role: 'ANALISTA', area: 'Financeiro' })

describe('Users', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /users', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/users')
      expect(res.status).toBe(401)
    })

    it('deve retornar 200 com token válido', async () => {
      prisma.user.findMany.mockResolvedValue([])
      const res = await request(app).get('/users').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  describe('PATCH /users/:id/role', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).patch('/users/algum-id/role').send({ role: 'GERENTE' })
      expect(res.status).toBe(401)
    })
  })
})