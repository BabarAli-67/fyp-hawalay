import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isAppInstalled, isIosSafari } from '../utils/pwaPlatform.js';

const PwaInstallContext = createContext(null);

export function PwaInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isAppInstalled());
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    function handleDisplayModeChange() {
      setInstalled(isAppInstalled());
    }
    standaloneQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (installed) return { outcome: 'already_installed' };

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setInstalled(true);
      }
      return { outcome };
    }

    setShowInstructions(true);
    return { outcome: 'instructions' };
  }, [deferredPrompt, installed]);

  const value = useMemo(
    () => ({
      canInstall: !installed,
      hasNativePrompt: Boolean(deferredPrompt),
      installed,
      install,
      showInstructions,
      setShowInstructions,
      isIosSafari: isIosSafari(),
    }),
    [deferredPrompt, install, installed, showInstructions],
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error('usePwaInstall must be used within PwaInstallProvider');
  }
  return ctx;
}
