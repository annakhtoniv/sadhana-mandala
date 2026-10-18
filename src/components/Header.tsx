import React from 'react';
import { useAuth } from '../context/AuthContext';
import { allowedRoleViews, canUseCrm, ROLE_LABEL } from '../lib/roles';
import { HelpCircle, CalendarDays, Contact, Home, UserRound, ChevronDown } from 'lucide-react';
import type { UserRole } from '../types/database';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  activeRoleView?: UserRole;
  onRoleSwitch?: (role: UserRole) => void;
  onOpenTour?: () => void;
}

/**
 * App chrome: a floating glass bar at the top (brand, view switcher, help)
 * and a floating tab bar at the bottom for the main screens.
 */
export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  activeRoleView,
  onRoleSwitch,
  onOpenTour,
}) => {
  const { organisation, user, activeRole, profile } = useAuth();
  const roleViews = allowedRoleViews(profile?.role ?? 'student');
  const currentRole = activeRoleView || activeRole;
  // Leads (CRM): volunteers always; teachers and admins outside the Student preview
  const showLeads = canUseCrm(profile?.role) && (profile?.role === 'volunteer' || currentRole !== 'student');

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'events', label: 'Events', icon: CalendarDays },
    ...(showLeads ? [{ id: 'leads', label: 'Leads', icon: Contact }] : []),
    { id: 'profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 w-full px-3 pt-3">
        <div className="ui-glass max-w-md mx-auto h-14 pl-2 pr-1.5 rounded-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 min-w-0 rounded-full pr-2 focus:outline-none cursor-pointer"
          >
            {organisation.logo_url ? (
              <img src={organisation.logo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <BrandMark className="w-9 h-9" />
            )}
            <span className="font-display font-semibold text-[15px] text-stone-900 truncate">{organisation.app_name}</span>
          </button>

          {user && (
            <div className="flex items-center gap-1 shrink-0">
              {onRoleSwitch && (
                <label className="relative">
                  <span className="sr-only">Active Role View</span>
                  <select
                    id="tour-role-switcher"
                    aria-label="Active Role View"
                    value={currentRole}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      onRoleSwitch(newRole);
                      window.dispatchEvent(new CustomEvent('sadhana_action_roleswitch', { detail: { role: newRole } }));
                    }}
                    className="appearance-none h-9 pl-3.5 pr-8 rounded-full bg-stone-900/[0.04] hover:bg-stone-900/[0.07] text-xs font-medium text-stone-700 cursor-pointer focus:outline-none transition-colors"
                  >
                    {roleViews.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]} view
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </label>
              )}
              {onOpenTour && (
                <button type="button" onClick={onOpenTour} className="ui-icon-btn" title="Guided tour" aria-label="Guided tour">
                  <HelpCircle className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {user && (
        <nav
          aria-label="Main"
          className="fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
        >
          <div className="ui-glass pointer-events-auto max-w-md mx-auto rounded-full p-1.5 flex items-center justify-between">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = currentTab === id || (id === 'home' && currentTab === 'lessons');
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  title={label === 'Profile' ? 'Profile & Settings' : label}
                  className={`flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-all cursor-pointer ${
                    active ? 'bg-stone-900 text-white shadow-[0_8px_20px_-10px_rgba(24,24,27,0.7)]' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};
