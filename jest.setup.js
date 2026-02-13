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

// Mock next/navigation for components relying on app router hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
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

  const SelectItem = ({ value, children, disabled }) => {
    const context = React.useContext(SelectContext);
    return (
      <button
        role="option"
        aria-disabled={disabled ? 'true' : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            context.onValueChange(value);
          }
        }}
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
    Presence: ({ children, present }) => {
      if (present === false) return null;
      if (typeof children === 'function') {
        return children({ present: true });
      }
      return <>{children}</>;
    },
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

// Mock window.location to avoid jsdom "Not implemented: navigation" errors
delete window.location;
window.location = {
  href: '',
  origin: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  reload: jest.fn(),
  replace: jest.fn(),
  toString: () => 'http://localhost:3000/',
};

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

// Mock next/image to avoid "Invalid base URL" in jsdom
jest.mock('next/image', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => {
      const { fill, priority, quality, placeholder, blurDataURL, loader, ...rest } = props;
      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
      return React.createElement('img', { ...rest, ref });
    }),
  };
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
    config: jest.fn(),
    create: jest.fn(),
    refresh: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
  },
}));

// Mock Framer Motion — strip ALL motion-specific props to prevent React DOM warnings
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
    'dragTransition', 'dragPropagation', 'dragSnapToOrigin',
    'layout', 'layoutId', 'layoutDependency', 'layoutScroll',
    'onAnimationStart', 'onAnimationComplete', 'onDragStart', 'onDragEnd', 'onDrag',
    'custom', 'inherit', 'onLayoutAnimationStart', 'onLayoutAnimationComplete',
  ]);
  return {
    motion: new Proxy({}, {
      get: (target, prop) => {
        const MotionComponent = React.forwardRef((props, ref) => {
          const filteredProps = {};
          const { children, ...rest } = props;
          Object.keys(rest).forEach((key) => {
            if (!motionProps.has(key)) {
              filteredProps[key] = rest[key];
            }
          });
          return React.createElement(prop, { ...filteredProps, ref }, children);
        });
        MotionComponent.displayName = `motion.${String(prop)}`;
        return MotionComponent;
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
    useMotionValue: jest.fn((initial) => ({ get: () => initial, set: jest.fn(), onChange: jest.fn() })),
    useTransform: jest.fn((value) => ({ get: () => 0, set: jest.fn(), onChange: jest.fn() })),
    useSpring: jest.fn((value) => ({ get: () => 0, set: jest.fn(), onChange: jest.fn() })),
  };
});

// Mock Radix UI Tabs - Using manual mock in __mocks__/@radix-ui/react-tabs.js directory
// The inline mock below has been moved to __mocks__ for better compatibility with Next.js jest
