import React, { useEffect, useState } from 'react';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../lib/installPrompt';
import { Download, Share, Smartphone } from 'lucide-react';

/** Phase 10: put the app on the home screen (PWA). Hidden once installed. */
export const InstallAppCard: React.FC<{ appName: string }> = ({ appName }) => {
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
        <Smartphone className="w-4 h-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-stone-900">Install {appName}</h2>
      </div>
      <p className="text-xs text-stone-500">
        Put the app on your home screen. It opens full screen like any other app, with no app store needed.
      </p>
      {canPrompt ? (
        <button
          type="button"
          onClick={async () => {
            await promptInstall();
            setCanPrompt(canPromptInstall());
          }}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Install the app
        </button>
      ) : isIos() ? (
        <p className="text-xs text-stone-700 flex items-center gap-1.5 flex-wrap">
          In Safari, tap <Share className="w-3.5 h-3.5 inline" /> Share, then "Add to Home Screen".
        </p>
      ) : (
        <p className="text-xs text-stone-700">
          In Chrome, open the menu (three dots) and tap "Install app" or "Add to Home screen".
        </p>
      )}
    </div>
  );
};
