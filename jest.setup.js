import '@testing-library/jest-dom';

// Mock Prisma client
jest.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    // Add SessionBooking for refund flow tests
    sessionBooking: {
      findUnique: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    coachProfile: {
      findFirst: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock Radix Select used in tests to behave like native select
jest.mock('@/components/ui/select', () => {
  const React = require('react');
  const Select = ({ children, value, onValueChange, ...props }) => (
    <select {...props} value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  );
  const SelectTrigger = () => null;
  const SelectValue = () => null;
  const SelectContent = ({ children }) => <>{children}</>;
  const SelectItem = ({ value, children }) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// Mock Radix Checkbox to behave like native checkbox
jest.mock('@/components/ui/checkbox', () => {
  const React = require('react');
  return {
    Checkbox: function Checkbox({ id, checked, onCheckedChange, ...props }) {
      return (
        <input
          type="checkbox"
          id={id}
          checked={!!checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
      );
    },
  };
});

// Silence presence animations in tests
jest.mock('@radix-ui/react-presence', () => ({
  Presence: ({ children }) => children,
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NODE_ENV = 'development';

// Configure React for testing environment (React 18+)
global.IS_REACT_ACT_ENVIRONMENT = true;

// Mock window.alert for jsdom environment (force override, JS-safe)
if (typeof globalThis !== 'undefined') {
  if (!globalThis.window) globalThis.window = {};
  // Always override to avoid jsdom "not implemented" error
  globalThis.alert = jest.fn();
  globalThis.window.alert = globalThis.alert;
}

// jest.setup.js
// Polyfill IntersectionObserver pour Jest/jsdom (Node global)
global.IntersectionObserver = global.IntersectionObserver || class {
  constructor() { }
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Mock GSAP
jest.mock('gsap', () => ({
  gsap: {
    registerPlugin: jest.fn(),
    context: jest.fn(() => ({ revert: jest.fn() })),
    timeline: jest.fn(() => ({
      fromTo: jest.fn().mockReturnThis(),
      to: jest.fn().mockReturnThis(),
      scrollTrigger: jest.fn(),
    })),
    fromTo: jest.fn().mockReturnThis(),
    to: jest.fn().mockReturnThis(),
  },
}));

jest.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: jest.fn(),
    refresh: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
  },
}));

// Mock Framer Motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: new Proxy({}, {
      get: (target, prop) => {
        return React.forwardRef((props, ref) => {
          const { children, initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
          return React.createElement(prop, { ...rest, ref }, children);
        });
      }
    }),
    AnimatePresence: ({ children }) => children,
    useReducedMotion: () => false,
  };
});
