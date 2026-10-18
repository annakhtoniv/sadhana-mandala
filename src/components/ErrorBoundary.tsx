import React from 'react';
import { reportError } from '../lib/errorReporting';
import { translate } from '../i18n';

interface State {
  failed: boolean;
}

/**
 * If a screen crashes, show a calm message with a reload button instead of a
 * blank page, and report the error so it can be fixed.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, info.componentStack || undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="min-h-[100dvh] flex items-center justify-center p-6 bg-stone-50">
        <div className="ui-card max-w-sm text-center space-y-3">
          <h1 className="font-display text-xl font-semibold text-stone-950">{translate('crash.title')}</h1>
          <p className="text-base text-stone-600">{translate('crash.body')}</p>
          <button type="button" onClick={() => window.location.reload()} className="ui-btn-primary w-full justify-center">
            {translate('crash.reload')}
          </button>
        </div>
      </div>
    );
  }
}
