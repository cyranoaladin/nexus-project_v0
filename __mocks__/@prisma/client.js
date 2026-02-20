// Mock @prisma/client for Jest tests (unit + integration)
//
// Strategy:
// 1. Try to load the REAL generated Prisma client (.prisma/client)
//    → If available, re-export everything from it (integration tests, CI)
// 2. Fall back to manual stubs with enums from @/types/enums (unit tests, jsdom)

let realExports;
try {
  realExports = require('.prisma/client');
} catch {
  realExports = null;
}

if (realExports) {
  // ── Integration path: re-export the real generated client as-is ──
  module.exports = realExports;
} else {
  // ── Unit test path: provide stubs for enums and Prisma namespace ──
  const { UserRole, SubscriptionStatus, ServiceType, Subject, SessionStatus, PaymentType, PaymentStatus } = require('../../types/enums');

  const NotificationType = {
    SESSION_BOOKED: 'SESSION_BOOKED',
    SESSION_CONFIRMED: 'SESSION_CONFIRMED',
    SESSION_REMINDER: 'SESSION_REMINDER',
    SESSION_CANCELLED: 'SESSION_CANCELLED',
    SESSION_RESCHEDULED: 'SESSION_RESCHEDULED',
    SESSION_COMPLETED: 'SESSION_COMPLETED',
    COACH_ASSIGNED: 'COACH_ASSIGNED',
    PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  };

  const EntitlementStatus = {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    EXPIRED: 'EXPIRED',
    REVOKED: 'REVOKED',
  };

  class StubPrismaClient {
    constructor() {
      return new Proxy(this, {
        get(target, prop) {
          if (prop === '$connect') return async () => {};
          if (prop === '$disconnect') return async () => {};
          if (prop === '$queryRaw') return async () => [];
          if (prop === '$executeRaw') return async () => 0;
          if (prop === '$executeRawUnsafe') return async () => 0;
          if (prop === '$transaction') return async (fn) => fn(target);
          return {};
        },
      });
    }
  }

  module.exports = {
    PrismaClient: StubPrismaClient,
    UserRole,
    SubscriptionStatus,
    ServiceType,
    Subject,
    SessionStatus,
    PaymentType,
    PaymentStatus,
    NotificationType,
    EntitlementStatus,
    Prisma: {
      TransactionIsolationLevel: {
        ReadUncommitted: 'ReadUncommitted',
        ReadCommitted: 'ReadCommitted',
        RepeatableRead: 'RepeatableRead',
        Serializable: 'Serializable',
      },
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
}
