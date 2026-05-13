const request = require('supertest')
const app = require('../app')

describe('Health', () => {
  it('GET /health deve retornar 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})