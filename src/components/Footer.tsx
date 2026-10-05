import React from 'react';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC = () => {
  const { organisation } = useAuth();

  return (
    <footer className="w-full border-t border-stone-200 dark:border-stone-800 py-4 bg-white/50 dark:bg-stone-900/50 mt-auto">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-2">
        {organisation.footer_text && (
          <p className="text-center text-[11px] text-stone-400 dark:text-stone-500">
            {organisation.footer_text}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
          <span>{organisation.show_powered_by ? 'Powered by ZYXENAI' : ''}</span>
          <span className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] rounded font-medium tracking-wide uppercase">
            Concept
          </span>
        </div>
      </div>
    </footer>
  );
};
