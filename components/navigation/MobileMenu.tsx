"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Session } from 'next-auth';
import { NavigationItem as NavigationItemComponent } from './NavigationItem';
import UserProfile from './UserProfile';
import { LogoutButton } from './LogoutButton';
import type { NavigationItem } from './navigation-config';
import { cn } from '@/lib/utils';

const FOCUSABLE_ELEMENTS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface MobileMenuContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileMenuContext = createContext<MobileMenuContextValue | null>(null);

export function useMobileMenu() {
  const context = useContext(MobileMenuContext);
  if (!context) {
    throw new Error('useMobileMenu must be used within MobileMenuProvider');
  }
  return context;
}

interface MobileMenuProviderProps {
  children: ReactNode;
}

export function MobileMenuProvider({ children }: MobileMenuProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(prev => !prev);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const value: MobileMenuContextValue = {
    isOpen,
    open,
    close,
    toggle
  };

  return (
    <MobileMenuContext.Provider value={value}>
      {children}
    </MobileMenuContext.Provider>
  );
}

export interface MobileMenuProps {
  items: NavigationItem[];
  user: Session['user'];
}

export function MobileMenu({ items, user }: MobileMenuProps) {
  const { isOpen, close } = useMobileMenu();
  const menuRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && isOpen) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
      
      const focusableElements = menuRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (firstElement) {
        firstElement.focus();
      }

      const handleTabKey = (event: KeyboardEvent) => {
        if (event.key !== 'Tab') return;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);

      return () => {
        document.removeEventListener('keydown', handleTabKey);
        previouslyFocusedElement.current?.focus();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        aria-hidden="true"
      />
      
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation mobile"
        className={cn(
          "fixed top-0 right-0 h-full w-80 bg-surface-card z-40 lg:hidden",
          "transform transition-transform duration-300 ease-in-out",
          "shadow-2xl border-l border-neutral-800",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-50">Menu</h2>
            <button
              onClick={close}
              className="p-2 rounded-micro text-neutral-400 hover:text-neutral-50 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="py-4">
              <UserProfile user={user} />
            </div>

            <nav className="px-4 pb-4" aria-label="Navigation mobile">
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <NavigationItemComponent item={item} />
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="p-4 border-t border-neutral-800">
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  );
}
