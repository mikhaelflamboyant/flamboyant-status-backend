const request = require('supertest')
const app = require('../app')

describe('Auth', () => {
  describe('POST /auth/login', () => {
    it('deve retornar 400 sem body', async () => {
      const res = await request(app).post('/auth/login').send({})
      expect(res.status).toBe(400)
    })

    it('deve retornar 401 com credenciais inválidas', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'naoexiste@flamboyant.com.br',
        password: 'senhaerrada'
      })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /auth/register', () => {
    it('deve retornar 400 sem campos obrigatórios', async () => {
      const res = await request(app).post('/auth/register').send({})
      expect(res.status).toBe(400)
    })

    it('deve retornar 400 com domínio inválido', async () => {
      const res = await request(app).post('/auth/register').send({
        name: 'Teste',
        email: 'teste@gmail.com',
        password: 'Senha@123',
        area: 'TI'
      })
      expect(res.status).toBe(400)
    })
  })
})