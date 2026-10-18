import React, { useEffect, useState } from 'react';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/installPrompt';
import { Download, Share, Smartphone } from 'lucide-react';
import { useT } from '../i18n';

/** Phase 10: put the app on the home screen (PWA). Hidden once installed. */
export const InstallAppCard: React.FC<{ appName: string }> = ({ appName }) => {
  const t = useT();
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => onInstallChange(() => {
    setCanPrompt(canPromptInstall());
    setInstalled(isStandalone());
  }), []);

  if (installed) return null;

  return (
    <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-emerald-700" />
        <h2 className="font-display text-lg font-semibold text-stone-950">{t('install.title', { app: appName })}</h2>
      </div>
      <p className="text-base text-stone-600">{t('install.help')}</p>
      {canPrompt ? (
        <button
          type="button"
          onClick={async () => {
            await promptInstall();
            setCanPrompt(canPromptInstall());
          }}
          className="ui-btn-primary w-full"
        >
          <Download className="w-4 h-4" /> {t('install.button')}
        </button>
      ) : isIos() ? (
        <p className="text-base text-stone-700 flex items-center gap-1.5 flex-wrap">
          {t('install.iosBefore')} <Share className="w-4 h-4 inline" /> {t('install.iosAfter')}
        </p>
      ) : (
        <p className="text-base text-stone-700">{t('install.android')}</p>
      )}
    </div>
  );
};
