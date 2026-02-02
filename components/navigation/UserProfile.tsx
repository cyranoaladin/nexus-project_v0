"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserRole } from '@/types/enums';
import type { Session } from 'next-auth';

interface UserProfileProps {
  user: Session['user'];
}

const roleLabels: Record<UserRole, string> = {
  [UserRole.ELEVE]: 'Élève',
  [UserRole.PARENT]: 'Parent',
  [UserRole.COACH]: 'Coach',
  [UserRole.ASSISTANTE]: 'Assistante',
  [UserRole.ADMIN]: 'Admin'
};

export default function UserProfile({ user }: UserProfileProps) {
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U';
  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.email;
  const roleLabel = roleLabels[user.role];

  return (
    <div className="mx-4 mb-6 rounded-card bg-surface-elevated p-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={undefined} alt={fullName} />
          <AvatarFallback className="bg-brand-primary text-white font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-50 truncate">
            {fullName}
          </p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-micro text-xs font-medium bg-brand-accent/10 text-brand-accent">
            {roleLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
