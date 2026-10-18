import React from 'react';
import { useAuth } from '../context/AuthContext';
import { allowedRoleViews, canUseCrm, ROLE_LABEL } from '../lib/roles';
import { HelpCircle, CalendarDays, Contact, Home, UserRound, ChevronDown } from 'lucide-react';
import type { UserRole } from '../types/database';
import { BrandMark } from './BrandMark';
import { Avatar } from './Avatar';

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
      <header className="sticky top-0 z-30 w-full px-3 pt-3 md:hidden">
        <div className="ui-glass max-w-md mx-auto h-14 ps-2 pe-1.5 rounded-full flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 min-w-0 rounded-full pe-2 focus:outline-none cursor-pointer"
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
              {onRoleSwitch && roleViews.length > 1 && (
                <label className="relative">
                  <span className="sr-only">Which screen to show</span>
                  <select
                    aria-label="Which screen to show"
                    value={currentRole}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      onRoleSwitch(newRole);
                    }}
                    className="appearance-none h-11 ps-3.5 pe-8 rounded-full bg-stone-900/[0.04] hover:bg-stone-900/[0.07] text-sm font-medium text-stone-800 cursor-pointer focus:outline-none transition-colors"
                  >
                    {roleViews.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]} view
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute end-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
          className="md:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
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
                  className={`flex-1 h-12 rounded-full flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-all cursor-pointer ${
                    active ? 'bg-stone-900 text-white shadow-[0_8px_20px_-10px_rgba(24,24,27,0.7)]' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {id === 'profile' && profile?.avatar_url ? (
                    <Avatar url={profile.avatar_url} name={profile.full_name} size={20} />
                  ) : (
                    <Icon className="w-[18px] h-[18px]" />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
      {user && (
        <aside className="hidden md:flex fixed inset-y-0 start-0 z-30 w-64 p-4">
          <div className="ui-glass rounded-[1.75rem] flex-1 flex flex-col p-4 gap-6">
            <button type="button" onClick={() => onNavigate('home')} className="flex items-center gap-3 px-1 text-left cursor-pointer">
              {organisation.logo_url ? (
                <img src={organisation.logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <BrandMark className="w-10 h-10" />
              )}
              <span className="font-display font-semibold text-[15px] text-stone-900 leading-tight">{organisation.app_name}</span>
            </button>

            <nav aria-label="Main (desktop)" className="flex flex-col gap-1">
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = currentTab === id || (id === 'home' && currentTab === 'lessons');
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavigate(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`h-11 px-3.5 rounded-full flex items-center gap-3 text-sm font-medium transition-all cursor-pointer ${
                      active ? 'bg-stone-900 text-white shadow-[0_8px_20px_-10px_rgba(24,24,27,0.7)]' : 'text-stone-600 hover:bg-stone-900/5 hover:text-stone-900'
                    }`}
                  >
                    {id === 'profile' && profile?.avatar_url ? (
                      <Avatar url={profile.avatar_url} name={profile.full_name} size={20} />
                    ) : (
                      <Icon className="w-[18px] h-[18px]" />
                    )}
                    {label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto space-y-2">
              {onRoleSwitch && roleViews.length > 1 && (
                <label className="block">
                  <span className="block px-1 pb-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">View</span>
                  <span className="relative block">
                    <select
                      aria-label="Which screen to show"
                      value={currentRole}
                      onChange={(e) => onRoleSwitch(e.target.value as UserRole)}
                      className="appearance-none w-full h-10 ps-3.5 pe-8 rounded-full bg-stone-900/[0.04] hover:bg-stone-900/[0.07] text-xs font-medium text-stone-700 cursor-pointer focus:outline-none"
                    >
                      {roleViews.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]} view
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500 absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </span>
                </label>
              )}
              {onOpenTour && (
                <button type="button" onClick={onOpenTour} className="w-full h-10 px-3.5 rounded-full flex items-center gap-3 text-xs font-medium text-stone-500 hover:bg-stone-900/5 hover:text-stone-900 cursor-pointer">
                  <HelpCircle className="w-4 h-4" /> Guided tour
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
};
