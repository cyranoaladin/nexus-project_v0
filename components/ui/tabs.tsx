import React from 'react';

export function Tabs({ value, children, className = '' }: { value: string; children: React.ReactNode; className?: string; }) {
  return <div className={className} data-value={value}>{children}</div>;
}

export function TabsList({ children, className = '' }: { children: React.ReactNode; className?: string; }) {
  return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, disabled, children, className = '' }: { value: string; disabled?: boolean; children: React.ReactNode; className?: string; }) {
  return <button disabled={disabled} className={className} data-value={value}>{children}</button>;
}

export function TabsContent({ value, children, className = '' }: { value: string; children: React.ReactNode; className?: string; }) {
  return <div className={className} data-value={value}>{children}</div>;
}

export default Tabs;
