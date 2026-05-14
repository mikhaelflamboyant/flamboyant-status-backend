const request = require('supertest')
const app = require('../app')
const prisma = require('../lib/prisma')

describe('Public API', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('GET /public/projects', () => {
    it('deve retornar 401 sem token', async () => {
      const res = await request(app).get('/public/projects')
      expect(res.status).toBe(401)
    })

    it('deve retornar 401 com token inválido', async () => {
      prisma.apiToken.findUnique.mockResolvedValue(null)
      const res = await request(app)
        .get('/public/projects')
        .set('Authorization', 'Bearer token-invalido')
      expect(res.status).toBe(401)
    })

    it('deve retornar 200 com token válido', async () => {
      prisma.apiToken.findUnique.mockResolvedValue({ id: 'token-id', active: true })
      prisma.apiToken.update.mockResolvedValue({})
      prisma.project.findMany.mockResolvedValue([])
      const res = await request(app)
        .get('/public/projects')
        .set('Authorization', 'Bearer flb_teste_valido')
      expect(res.status).toBe(200)
    })
  })
})