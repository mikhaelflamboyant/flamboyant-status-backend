// SAML desativado — ativar após deploy no servidor
// Para ativar: descomentar tudo e registrar a rota no server.js

/*
const { Strategy: SamlStrategy } = require('@node-saml/passport-saml')
const passport = require('passport')

const samlStrategy = new SamlStrategy(
  {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER,
    callbackUrl: process.env.SAML_CALLBACK_URL,
    idpCert: process.env.SAML_CERT,
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
  },
  async (profile, done) => done(null, profile),
  async (profile, done) => done(null, profile)
)

passport.use('saml', samlStrategy)
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

module.exports = { passport, samlStrategy }
*/

module.exports = {}