const request = require('supertest')
const app = require('../app')
const prisma = require('../lib/prisma')
const { makeToken } = require('./helpers')

const token = makeToken()
const analista = makeToken({ role: 'ANALISTA', area: 'Financeiro' })

describe('API Tokens', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /api-tokens', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/api-tokens')
      expect(res.status).toBe(401)
    })

    it('deve retornar 403 para usuário fora de TI', async () => {
      const res = await request(app)
        .get('/api-tokens')
        .set('Authorization', `Bearer ${analista}`)
      expect(res.status).toBe(403)
    })

    it('deve retornar 200 para ANALISTA_MASTER de TI', async () => {
      prisma.apiToken.findMany.mockResolvedValue([])
      const res = await request(app)
        .get('/api-tokens')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  describe('POST /api-tokens', () => {
    it('deve retornar 400 sem nome', async () => {
      const res = await request(app)
        .post('/api-tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({})
      expect(res.status).toBe(400)
    })
  })
})