jest.mock('../lib/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  apiToken: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  contact: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  projectRequester: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  projectMember: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  projectCost: { findMany: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  statusUpdate: { findMany: jest.fn(), findFirst: jest.fn() },
  $disconnect: jest.fn(),
}))