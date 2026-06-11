const prisma = require('../lib/prisma')

const ACTION_TYPES = {
  PROJECT_EDITED: 'PROJECT_EDITED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  SCOPE_CREATED: 'SCOPE_CREATED',
  SCOPE_UPDATED: 'SCOPE_UPDATED',
  REQUIREMENT_UPDATED: 'REQUIREMENT_UPDATED',
}

async function logActivity({ project_id, user_id, action_type, description }) {
  try {
    await prisma.activityLog.create({
      data: { project_id, user_id, action_type, description }
    })
  } catch (err) {
    console.error('ActivityLog error:', err)
  }
}

module.exports = { logActivity, ACTION_TYPES }