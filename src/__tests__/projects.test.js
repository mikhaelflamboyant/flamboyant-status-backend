const request = require('supertest')
const app = require('../app')
const prisma = require('../lib/prisma')
const { makeToken } = require('./helpers')

const token = makeToken()

describe('Projects', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /projects', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/projects')
      expect(res.status).toBe(401)
    })

    it('deve retornar 200 com token válido', async () => {
      prisma.project.findMany.mockResolvedValue([])
      prisma.user.findUnique.mockResolvedValue({ id: 'user-test-id', area: 'Tecnologia da Informação', role: 'ANALISTA_MASTER' })
      const res = await request(app).get('/projects').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })
  })

  describe('POST /projects', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).post('/projects').send({})
      expect(res.status).toBe(401)
    })

    it('deve retornar 400 sem título e descrição', async () => {
      const res = await request(app)
        .post('/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ area: 'TI' })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /projects/:id', () => {
    it('deve retornar 404 para projeto inexistente', async () => {
      prisma.project.findUnique.mockResolvedValue(null)
      const res = await request(app)
        .get('/projects/id-inexistente')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })
})