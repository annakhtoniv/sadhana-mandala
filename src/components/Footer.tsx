import React from 'react';
import { useAuth } from '../context/AuthContext';

/** Quiet footer. `withNav` leaves room for the floating tab bar. */
export const Footer: React.FC<{ withNav?: boolean }> = ({ withNav = false }) => {
  const { organisation } = useAuth();

  return (
    <footer className={`w-full mt-auto pt-6 ${withNav ? 'pb-28' : 'pb-6'}`}>
      <div className="max-w-md mx-auto px-6 flex items-center justify-between gap-3 text-[11px] text-stone-400">
        <span className="truncate">{organisation.footer_text || organisation.name}</span>
        {organisation.show_powered_by && <span className="shrink-0">Powered by ZYXENAI</span>}
      </div>
    </footer>
  );
};
