// Mock @prisma/client for Jest unit tests (jsdom environment)
// Re-exports enums from @/types/enums which mirrors Prisma schema enums

const { UserRole, SubscriptionStatus, ServiceType, Subject, SessionStatus, PaymentType, PaymentStatus } = require('../../types/enums');

module.exports = {
  UserRole,
  SubscriptionStatus,
  ServiceType,
  Subject,
  SessionStatus,
  PaymentType,
  PaymentStatus,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      constructor(message, { code, clientVersion } = {}) {
        super(message);
        this.code = code;
        this.clientVersion = clientVersion;
        this.name = 'PrismaClientKnownRequestError';
      }
    },
    PrismaClientValidationError: class PrismaClientValidationError extends Error {
      constructor(message) {
        super(message);
        this.name = 'PrismaClientValidationError';
      }
    },
  },
};
