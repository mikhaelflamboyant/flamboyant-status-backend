const TI_AREA = 'Tecnologia da Informação'
const APPROVER_ROLES = ['ANALISTA_MASTER', 'ANALISTA_TESTADOR', 'GERENTE', 'COORDENADOR']

const needsApproval = (requester) => requester.role === 'ESTAGIARIO'

const canApprove = (requester) =>
  APPROVER_ROLES.includes(requester.role) &&
  (requester.area === TI_AREA || ['ANALISTA_MASTER', 'ANALISTA_TESTADOR'].includes(requester.role))

function visibilityWhere(requester, authorField = 'author_id') {
  if (canApprove(requester)) return {}
  return {
    OR: [
      { status: 'APROVADO' },
      { status: 'AGUARDANDO_APROVACAO', [authorField]: requester.id },
    ],
  }
}

module.exports = { needsApproval, canApprove, visibilityWhere, APPROVER_ROLES }