const request = require('supertest')
const app = require('../app')
const prisma = require('../lib/prisma')
const { makeToken } = require('./helpers')

const token = makeToken()

describe('Contacts', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /contacts', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/contacts')
      expect(res.status).toBe(401)
    })

    it('deve retornar 200 com token válido', async () => {
      prisma.contact.findMany.mockResolvedValue([])
      const res = await request(app).get('/contacts').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
    })
  })

  describe('POST /contacts', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).post('/contacts').send({ name: 'Teste', area: 'TI' })
      expect(res.status).toBe(401)
    })

    it('deve retornar 400 sem nome', async () => {
      const res = await request(app)
        .post('/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ area: 'TI' })
      expect(res.status).toBe(400)
    })
  })
})