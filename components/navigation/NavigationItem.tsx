"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { NavigationItem } from './navigation-config';
import { Badge } from '@/components/ui/badge';

const navigationItemVariants = cva(
  "flex items-center gap-3 px-4 py-3 rounded-micro text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card",
  {
    variants: {
      active: {
        true: "bg-brand-primary text-white shadow-sm",
        false: "text-neutral-400 hover:bg-surface-hover hover:text-neutral-50",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export interface NavigationItemProps extends VariantProps<typeof navigationItemVariants> {
  item: NavigationItem;
  className?: string;
}

export function NavigationItem({ item, className }: NavigationItemProps) {
  const pathname = usePathname();
  const isActive = pathname === item.href;
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(navigationItemVariants({ active: isActive }), className)}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && (
        <Badge variant="default" className="ml-auto">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}
