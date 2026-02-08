// Set NODE_ENV before any imports
process.env.NODE_ENV = 'development';

// Load test environment variables
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Polyfill setImmediate for pino logger (required in jsdom)
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill Web APIs for Next.js server components
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill setImmediate for winston logger
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));

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
  const SelectContext = React.createContext({ value: null, onValueChange: () => { } });

  const Select = ({ children, value, onValueChange, defaultValue, ...props }) => {
    const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || '');

    React.useEffect(() => {
      if (value !== undefined) {
        setSelectedValue(value);
      }
    }, [value]);

    const handleChange = React.useCallback((newValue) => {
      if (value === undefined) {
        setSelectedValue(newValue);
      }
      onValueChange?.(newValue);
    }, [value, onValueChange]);

    return (
      <SelectContext.Provider value={{ value: selectedValue, onValueChange: handleChange }}>
        <div {...props}>{children}</div>
      </SelectContext.Provider>
    );
  };

  const SelectTrigger = ({ children }) => {
    const { value } = React.useContext(SelectContext);
    return <button type="button">{value || children}</button>;
  };

  const SelectValue = ({ placeholder }) => {
    const { value } = React.useContext(SelectContext);
    return <>{value || placeholder}</>;
  };

  const SelectContent = ({ children }) => {
    return <div role="listbox">{children}</div>;
  };

  const SelectItem = ({ value, children }) => {
    const context = React.useContext(SelectContext);
    return (
      <button
        role="option"
        onClick={() => context.onValueChange(value)}
      >
        {children}
      </button>
    );
  };

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

// Mock Radix Tabs to render all content in tests
jest.mock('@/components/ui/tabs', () => {
  const React = require('react');
  const TabsContext = React.createContext({ selectedValue: null, onValueChange: () => { } });

  return {
    Tabs: function Tabs({ children, value: controlledValue, defaultValue, onValueChange, ...props }) {
      const [selectedValue, setSelectedValue] = React.useState(controlledValue || defaultValue || 'all');

      React.useEffect(() => {
        if (controlledValue !== undefined) {
          setSelectedValue(controlledValue);
        }
      }, [controlledValue]);

      const handleValueChange = React.useCallback((newValue) => {
        if (controlledValue === undefined) {
          setSelectedValue(newValue);
        }
        onValueChange?.(newValue);
      }, [controlledValue, onValueChange]);

      return (
        <TabsContext.Provider value={{ selectedValue, onValueChange: handleValueChange }}>
          <div data-testid="tabs" {...props}>{children}</div>
        </TabsContext.Provider>
      );
    },
    TabsList: function TabsList({ children, ...props }) {
      return <div role="tablist" {...props}>{children}</div>;
    },
    TabsTrigger: function TabsTrigger({ value, children, ...props }) {
      const context = React.useContext(TabsContext);
      return (
        <button
          role="tab"
          aria-label={value}
          onClick={() => context.onValueChange(value)}
          {...props}
        >
          {children}
        </button>
      );
    },
    TabsContent: function TabsContent({ children, value, ...props }) {
      const context = React.useContext(TabsContext);
      if (context.selectedValue !== value) return null;
      return <div role="tabpanel" data-value={value} {...props}>{children}</div>;
    },
  };
});

// Silence presence animations in tests
jest.mock('@radix-ui/react-presence', () => {
  const React = require('react');
  return {
    Presence: ({ children, present }) => present !== false ? <>{children}</> : null,
  };
});

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';

// Mock window.alert for jsdom environment (force override, JS-safe)
if (typeof globalThis !== 'undefined') {
  if (!globalThis.window) globalThis.window = {};
  // Always override to avoid jsdom "not implemented" error
  globalThis.alert = jest.fn();
  globalThis.window.alert = globalThis.alert;
}

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = jest.fn();

// jest.setup.js
// Polyfill IntersectionObserver pour Jest/jsdom (Node global)
global.IntersectionObserver = global.IntersectionObserver || class {
  constructor() { }
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Polyfill matchMedia for Jest/jsdom (used by CorporateNavbar for reduced-motion)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

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
        const Component = React.forwardRef((props, ref) => {
          const {
            children,
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            whileHover: _whileHover,
            whileTap: _whileTap,
            whileInView: _whileInView,
            viewport: _viewport,
            ...rest
          } = props;
          return React.createElement(prop, { ...rest, ref }, children);
        });
        Component.displayName = `Motion${String(prop)}`;
        return Component;
      }
    }),
    AnimatePresence: ({ children }) => children,
    useReducedMotion: jest.fn(() => false),
    useAnimation: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      set: jest.fn(),
    })),
    useInView: jest.fn(() => true),
  };
});

// Mock Radix UI Tabs - Using manual mock in __mocks__/@radix-ui/react-tabs.js directory
// The inline mock below has been moved to __mocks__ for better compatibility with Next.js jest
