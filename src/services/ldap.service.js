const { Client } = require('ldapts')

const LDAP_URL = `ldap://${process.env.LDAP_HOST}:${process.env.LDAP_PORT}`
const BIND_DN = `${process.env.LDAP_SERVICE_USER}@grupoflamboyant.com.br`
const BASE_DN = process.env.LDAP_BASE_DN
const EMAIL_ATTR = process.env.LDAP_EMAIL_ATTR || 'mail'

async function findUserByEmail(email) {
  const client = new Client({ url: LDAP_URL, timeout: 5000 })
  try {
    await client.bind(BIND_DN, process.env.LDAP_SERVICE_PASS)
    const { searchEntries } = await client.search(BASE_DN, {
      scope: 'sub',
      filter: `(${EMAIL_ATTR}=${email})`,
      attributes: ['cn', 'mail', 'displayName', 'sAMAccountName'],
    })
    return searchEntries[0] || null
  } finally {
    await client.unbind()
  }
}

async function authenticateUser(email, password) {
  const client = new Client({ url: LDAP_URL, timeout: 5000 })
  try {
    await client.bind(BIND_DN, process.env.LDAP_SERVICE_PASS)
    const { searchEntries } = await client.search(BASE_DN, {
      scope: 'sub',
      filter: `(${EMAIL_ATTR}=${email})`,
      attributes: ['dn', 'cn', 'mail', 'displayName'],
    })
    if (!searchEntries.length) return null
    const userDN = searchEntries[0].dn
    const userClient = new Client({ url: LDAP_URL, timeout: 5000 })
    try {
      await userClient.bind(userDN, password)
      return searchEntries[0]
    } catch {
      return null
    } finally {
      await userClient.unbind()
    }
  } finally {
    await client.unbind()
  }
}

async function syncUsersFromAD() {
  const client = new Client({ url: LDAP_URL, timeout: 5000 })
  try {
    await client.bind(`${process.env.LDAP_SERVICE_USER}@grupoflamboyant.com.br`, process.env.LDAP_SERVICE_PASS)
    
    const { searchEntries } = await client.search(BASE_DN, {
      scope: 'sub',
      filter: `(&(objectClass=user)(memberOf=CN=projetos,${BASE_DN})(mail=*))`,
      attributes: ['cn', 'mail', 'displayName', 'sAMAccountName'],
    })

    return searchEntries
  } finally {
    await client.unbind()
  }
}

module.exports = { findUserByEmail, authenticateUser, syncUsersFromAD }