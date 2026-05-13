const { ZodError } = require('zod')

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body)
    next()
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues || err.errors || []
      return res.status(400).json({
        error: 'Dados inválidos',
        details: issues.map(e => ({ field: e.path.join('.'), message: e.message }))
      })
    }
    next(err)
  }
}

module.exports = { validate }