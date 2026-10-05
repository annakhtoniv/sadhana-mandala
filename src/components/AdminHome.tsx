import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile, RoleGrant, UserRole } from '../types/database';
import { Shield, UserPlus, Settings, Check, Trash2, RefreshCw } from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { organisation, profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    if (!organisation.id) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      // 1. Fetch profiles in org
      const { data: profs, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('org_id', organisation.id);

      if (profError) {
        console.warn('Could not load profiles:', profError.message);
      } else if (profs) {
        setProfiles(profs as Profile[]);
      }

      // 2. Fetch role grants in org
      const { data: grants, error: grantError } = await supabase
        .from('role_grants')
        .select('*')
        .eq('org_id', organisation.id);

      if (grantError) {
        console.warn('Could not load role grants:', grantError.message);
      } else if (grants) {
        setRoleGrants(grants as RoleGrant[]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation.id]);

  const handleAddRoleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !organisation.id) return;

    setStatusMessage(null);
    const normalizedEmail = newEmail.trim().toLowerCase();

    try {
      // Upsert into role_grants
      const { error: grantErr } = await supabase
        .from('role_grants')
        .upsert({
          org_id: organisation.id,
          email: normalizedEmail,
          role: newRole,
        }, { onConflict: 'org_id,email' });

      if (grantErr) throw grantErr;

      // Also update profile if user already exists
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('org_id', organisation.id)
        .ilike('email', normalizedEmail);

      if (profErr) {
        console.warn('Profile role update notice:', profErr.message);
      }

      setStatusMessage(`Granted role "${newRole}" to ${normalizedEmail}`);
      setNewEmail('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role grant';
      setStatusMessage(`Error: ${msg}`);
    }
  };

  const handleDeleteRoleGrant = async (grantId: string) => {
    try {
      await supabase.from('role_grants').delete().eq('id', grantId);
      await loadData();
    } catch (err) {
      console.error('Failed to remove role grant:', err);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Shield className="w-4 h-4" />
            <span>Admin Console &bull; {organisation.name}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Refresh Users"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Users & Role Grants
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Pre-assign roles by email before first sign-in, or update existing roles inside this organisation.
        </p>
      </div>

      {/* Grant Role Form */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Assign / Pre-grant Role</span>
        </div>

        <form onSubmit={handleAddRoleGrant} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none cursor-pointer"
            >
              <option value="student">Student (Default)</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Role Assignment</span>
          </button>

          {statusMessage && (
            <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300">
              {statusMessage}
            </div>
          )}
        </form>
      </div>

      {/* Role Grants List */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Pre-Granted Roles ({roleGrants.length})
        </div>

        {roleGrants.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No pre-assigned role grants yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {roleGrants.map((grant) => (
              <div key={grant.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-stone-800 dark:text-stone-200">{grant.email}</div>
                  <div className="text-[10px] text-stone-400 uppercase tracking-wide">{grant.role}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteRoleGrant(grant.id)}
                  className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                  title="Remove grant"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing Profiles List */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Active Profiles ({profiles.length})
        </div>

        {profiles.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No users have signed in yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {profiles.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-stone-800 dark:text-stone-200">
                    {p.full_name || 'No Name'}
                    {p.id === currentProfile?.id && (
                      <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">(You)</span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500">{p.email}</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Organisation Settings Overview */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <Settings className="w-4 h-4 text-stone-500" />
          <span>Organisation Parameters</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">App Name</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.app_name}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Slug</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.slug}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Timezone</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.timezone}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Powered by ZYXENAI</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.show_powered_by ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
