// Set NODE_ENV before any imports
process.env.NODE_ENV = 'development';

// Polyfill setImmediate for pino logger (required in jsdom)
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

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
  const SelectContext = React.createContext({ value: null, onValueChange: () => {} });
  
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
  const TabsContext = React.createContext({ selectedValue: null, onValueChange: () => {} });
  
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
          const { 
            children, 
            initial, 
            animate, 
            exit, 
            transition, 
            whileHover, 
            whileTap, 
            whileInView,
            viewport,
            ...rest 
          } = props;
          return React.createElement(prop, { ...rest, ref }, children);
        });
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

// Mock Radix UI Tabs
jest.mock('@radix-ui/react-tabs', () => {
  const React = require('react');
  
  // Create context outside of components
  const TabsContext = React.createContext({ value: '', onValueChange: () => {}, triggers: [] });
  
  const Root = React.forwardRef(({ children, defaultValue, value, onValueChange, ...props }, ref) => {
    const [activeTab, setActiveTab] = React.useState(value || defaultValue);
    const triggersRef = React.useRef([]);
    
    React.useEffect(() => {
      if (value !== undefined) {
        setActiveTab(value);
      }
    }, [value]);
    
    const handleValueChange = React.useCallback((newValue) => {
      setActiveTab(newValue);
      if (onValueChange) onValueChange(newValue);
    }, [onValueChange]);
    
    const contextValue = React.useMemo(() => ({
      value: activeTab,
      onValueChange: handleValueChange,
      triggers: triggersRef.current
    }), [activeTab, handleValueChange]);
    
    return React.createElement('div', { 
      ...props, 
      ref,
      'data-orientation': 'horizontal',
      'data-radix-tabs-root': '',
      'data-testid': 'tabs'
    }, 
      React.createElement(TabsContext.Provider, { value: contextValue }, children)
    );
  });
  
  const List = React.forwardRef(({ children, className, ...props }, ref) => {
    return React.createElement('div', { 
      ...props, 
      ref, 
      role: 'tablist',
      className: className || 'inline-flex h-10 items-center justify-center rounded-lg bg-neutral-100 p-1 text-neutral-500'
    }, children);
  });
  
  const Trigger = React.forwardRef(({ children, value, disabled, className, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;
    const buttonRef = React.useRef(null);
    
    // Combine both refs
    const combinedRef = React.useCallback((node) => {
      buttonRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      
      // Add to triggers list
      if (node && !context.triggers.includes(node)) {
        context.triggers.push(node);
      }
    }, [ref, context.triggers]);
    
    const handleClick = React.useCallback(() => {
      if (!disabled && context.onValueChange) {
        context.onValueChange(value);
      }
    }, [disabled, context, value]);
    
    const handleKeyDown = React.useCallback((e) => {
      const triggers = context.triggers;
      const currentIndex = triggers.indexOf(buttonRef.current);
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % triggers.length;
        triggers[nextIndex]?.focus();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + triggers.length) % triggers.length;
        triggers[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        triggers[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        triggers[triggers.length - 1]?.focus();
      }
    }, [context.triggers]);
    
    const attrs = {
      role: 'tab',
      type: 'button',
      'aria-label': value,
      'aria-selected': String(isActive),
      'aria-controls': `panel-${value}`,
      'data-state': isActive ? 'active' : 'inactive',
      'data-testid': `trigger-${value}`,
      disabled: disabled || undefined,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      className: className || 'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm'
    };
    
    if (disabled) {
      attrs['data-disabled'] = '';
    }
    
    return React.createElement('button', { ...props, ref: combinedRef, ...attrs }, children);
  });
  
  const Content = React.forwardRef(({ children, value, className, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;
    
    if (!isActive) return null;
    
    return React.createElement('div', {
      ...props,
      ref,
      role: 'tabpanel',
      id: `panel-${value}`,
      'data-state': isActive ? 'active' : 'inactive',
      'aria-labelledby': `tab-${value}`,
      className: className || 'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2'
    }, children);
  });
  
  Root.displayName = 'Tabs';
  List.displayName = 'TabsList';
  Trigger.displayName = 'TabsTrigger';
  Content.displayName = 'TabsContent';
  
  return {
    Root,
    List,
    Trigger,
    Content,
  };
});
