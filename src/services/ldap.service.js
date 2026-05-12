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

async function syncContactsFromAD() {
  const client = new Client({ url: LDAP_URL, timeout: 5000 })
  try {
    await client.bind(BIND_DN, process.env.LDAP_SERVICE_PASS)
    const { searchEntries } = await client.search(BASE_DN, {
      scope: 'sub',
      filter: '(&(objectClass=user)(mail=*)(displayName=*))',
      attributes: ['cn', 'displayName', 'department'],
    })

    const TI = 'Tecnologia da Informação'

    const AREA_MAP = {
      'Administração de Pessoal': 'Administração Pessoal',
      'Administrativo Estacionamento': 'Estacionamento',
      'Escritório de Processos': 'Processos',
      'Fazendas': 'Agropecuária',
      'Flamboyant Agropecuária': 'Agropecuária',
      'Fazenda California': 'Agropecuária',
      'Juridico': 'Jurídico',
      'Pessoas e Cultura Organizacional': 'Pessoas e Cultura',
      'Segurança e Estacionamento': 'Segurança',
      'Segurança Patrimonial': 'Segurança',
      'Engenharia - Flamboyant Urbanismo': 'Engenharia',
      'ObrasEngenharia': 'Engenharia',
      'Manutenção e Operações': 'Manutenção',
      'Operações e Manutenção': 'Manutenção',
      'Superintendente de Operações': 'Operações',
      'Superintendente Relacionamento': 'Relacionamento',
      'Gestão de Residuos': 'Resíduos',
      'Gestão de Resíduos': 'Resíduos',
      'Instituto Flamboyant': 'Instituto Flamboyant',
      'Familly Office': 'Family Office',
    }

    const NAME_AREA_MAP = {
      'Adolfo Rodrigues': 'Projetos Urbanismo',
      'Alessandra Moraes': 'Produtos e Projetos Urbanismo',
      'Alessandra Rezio': 'Produtos e Projetos Urbanismo',
      'Aline Moreira': 'Incorporação',
      'Aline Nascimento': 'Relacionamento',
      'Amanda Araujo': 'Projetos Urbanismo',
      'Amanda de Oliveira': 'Relacionamento',
      'Amanda Santos': 'Produtos e Projetos Urbanismo',
      'Amanda Siqueira': 'Planejamento Financeiro Urbanismo',
      'Ana Gabriela Santos': 'Projetos Urbanismo',
      'Annie Karolinie Botterloff': 'Relacionamento',
      'Carolina Vitti': 'Marketing Urbanismo',
      'Darciso Abrantes': 'Administrativo Urbanismo',
      'Elaine Silva': 'Relacionamento',
      'Eloice Moraes': 'Financeiro',
      'Fabio Guimarães': 'Planejamento Financeiro e Administrativo',
      'Isabela Alves': 'Incorporação',
      'Julia Silva': 'Experiência Urbanismo',
      'Letícia Macedo': 'Projetos Urbanismo',
      'Márcia Viana': 'Marketing Urbanismo',
      'Marina Matos': 'Incorporação',
      'Marina Oliveira': 'Projetos Urbanismo',
      'Pedro Silva': 'Marketing Urbanismo',
      'Rannya Mourão': 'Experiência Urbanismo',
      'Renan Araújo': 'Planejamento Financeiro e Administrativo',
      'Rodrigo Jhun Shimada': 'Engenharia',
      'Sêny Azevedo': 'Marketing Urbanismo',
      'Suellen oliveira': 'Experiência Urbanismo',
      'Taís Passos': 'Relacionamento',
      'Vitorhugo Gonçalves de Oliveira': 'Produtos Urbanismo',
      'Henrique Cerqueira': 'Incorporação',
    }

    const results = []

    for (const entry of searchEntries) {
      const displayName = Array.isArray(entry.displayName) ? entry.displayName[0] : entry.displayName
      const department = Array.isArray(entry.department) ? entry.department[0] : entry.department

      if (!displayName || !department) continue
      if (department === TI) continue

      const name = displayName.includes(' - ') ? displayName.split(' - ')[0].trim() : displayName.trim()
      if (!name) continue

      const mappedArea = NAME_AREA_MAP[name] || AREA_MAP[department] || department
      results.push({ name, area: mappedArea })
    }

    return results
  } finally {
    await client.unbind()
  }
}

module.exports = { findUserByEmail, authenticateUser, syncUsersFromAD, syncContactsFromAD }