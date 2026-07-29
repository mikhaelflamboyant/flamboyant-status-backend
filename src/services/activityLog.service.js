const prisma = require('../lib/prisma')

const ACTION_TYPES = {
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_EDITED: 'PROJECT_EDITED',
  PROJECT_DELETED: 'PROJECT_DELETED',
  PROJECT_CANCELLED: 'PROJECT_CANCELLED',
  PROJECT_PHASE_CHANGED: 'PROJECT_PHASE_CHANGED',
  PROJECT_PROGRESS_CHANGED: 'PROJECT_PROGRESS_CHANGED',
  STATUS_CREATED: 'STATUS_CREATED',
  STATUS_UPDATED: 'STATUS_UPDATED',
  STATUS_DELETED: 'STATUS_DELETED',
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_DELETED: 'TASK_DELETED',
  REQUIREMENT_CREATED: 'REQUIREMENT_CREATED',
  REQUIREMENT_UPDATED: 'REQUIREMENT_UPDATED',
  SCOPE_CREATED: 'SCOPE_CREATED',
  SCOPE_UPDATED: 'SCOPE_UPDATED',
}

async function logActivity({ project_id, project_name, user_id, action_type, description, previous_value, new_value }) {
  try {
    await prisma.activityLog.create({
      data: {
        project_id: project_id || null,
        project_name: project_name || '',
        user_id,
        action_type,
        description,
        previous_value: previous_value ?? null,
        new_value: new_value ?? null,
      }
    })
  } catch (err) {
    console.error('ActivityLog error:', err)
  }
}

module.exports = { logActivity, ACTION_TYPES }