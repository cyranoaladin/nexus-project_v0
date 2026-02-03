// Manual mock for @radix-ui/react-tabs
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

module.exports = {
  Root,
  List,
  Trigger,
  Content,
};
