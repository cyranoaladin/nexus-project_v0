/**
 * F52: BilanTabs — Navigation entre audiences de bilan
 * Onglets pour switcher entre les versions élève, parents, Nexus
 */

'use client';

import React from 'react';
import { User, Users, Building2 } from 'lucide-react';

type Audience = 'student' | 'parents' | 'nexus';

interface BilanTabsProps {
  activeAudience: Audience;
  onAudienceChange: (audience: Audience) => void;
  showStudent?: boolean;
  showParents?: boolean;
  showNexus?: boolean;
  disabled?: boolean;
}

const audienceConfig = {
  student: {
    label: 'Élève',
    icon: User,
    color: 'blue',
  },
  parents: {
    label: 'Parents',
    icon: Users,
    color: 'green',
  },
  nexus: {
    label: 'Nexus',
    icon: Building2,
    color: 'purple',
  },
};

export default function BilanTabs({
  activeAudience,
  onAudienceChange,
  showStudent = true,
  showParents = true,
  showNexus = true,
  disabled = false,
}: BilanTabsProps) {
  const audiences: Audience[] = ['student', 'parents', 'nexus'];
  const visibleAudiences = audiences.filter(a => {
    if (a === 'student') return showStudent;
    if (a === 'parents') return showParents;
    if (a === 'nexus') return showNexus;
    return false;
  });

  if (visibleAudiences.length <= 1) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-1 mb-6 shadow-sm">
      <div className="flex gap-1">
        {visibleAudiences.map((audience) => {
          const config = audienceConfig[audience];
          const Icon = config.icon;
          const isActive = activeAudience === audience;
          const colorClasses = {
            blue: isActive ? 'bg-blue-100 text-blue-700 border-blue-200' : 'text-slate-600 hover:bg-slate-50',
            green: isActive ? 'bg-green-100 text-green-700 border-green-200' : 'text-slate-600 hover:bg-slate-50',
            purple: isActive ? 'bg-purple-100 text-purple-700 border-purple-200' : 'text-slate-600 hover:bg-slate-50',
          };

          return (
            <button
              key={audience}
              onClick={() => !disabled && onAudienceChange(audience)}
              disabled={disabled}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                text-sm font-medium transition-all duration-200
                border border-transparent
                ${colorClasses[config.color as 'blue' | 'green' | 'purple']}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sm:hidden">{config.label.charAt(0)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Hook for managing audience state
export function useBilanTabs(defaultAudience: Audience = 'student') {
  const [activeAudience, setActiveAudience] = React.useState<Audience>(defaultAudience);

  return {
    activeAudience,
    setActiveAudience,
    BilanTabsComponent: (props: Omit<BilanTabsProps, 'activeAudience' | 'onAudienceChange'>) => (
      <BilanTabs
        activeAudience={activeAudience}
        onAudienceChange={setActiveAudience}
        {...props}
      />
    ),
  };
}
