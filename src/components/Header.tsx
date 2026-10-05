import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, User } from 'lucide-react';
import type { UserRole } from '../types/database';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  activeRoleView?: UserRole;
  onRoleSwitch?: (role: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  activeRoleView,
  onRoleSwitch,
}) => {
  const { organisation, user, activeRole } = useAuth();
  const currentRole = activeRoleView || activeRole;

  return (
    <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
        >
          {organisation.logo_url ? (
            <img
              src={organisation.logo_url}
              alt={organisation.app_name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-colors text-white"
              style={{ backgroundColor: organisation.primary_colour || '#1c1917' }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
          )}
          <span className="font-semibold text-base tracking-tight text-stone-900 dark:text-stone-100">
            {organisation.app_name}
          </span>
        </button>

        {/* User Role Switcher & Profile button */}
        {user && (
          <div className="flex items-center gap-2">
            {/* Always available Role Switcher for instant testing */}
            {onRoleSwitch && (
              <select
                aria-label="Active Role View"
                value={currentRole}
                onChange={(e) => onRoleSwitch(e.target.value as UserRole)}
                className="text-xs px-2.5 py-1 rounded-full border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold cursor-pointer shadow-sm focus:outline-none"
              >
                <option value="student">Role: Student</option>
                <option value="teacher">Role: Teacher</option>
                <option value="admin">Role: Admin</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              title="Profile & Settings"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
