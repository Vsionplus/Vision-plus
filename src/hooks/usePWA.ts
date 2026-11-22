import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Shared module-level store so early beforeinstallprompt events are captured
// before Profile or Footer components mount/re-mount.
let capturedPrompt: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

if (typeof window !== 'undefined') {
  installedFlag = checkStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    installedFlag = true;
    capturedPrompt = null;
    notifyListeners();
  });

  const mediaQuery = window.matchMedia('(display-mode: standalone)');
  mediaQuery.addEventListener?.('change', (ev) => {
    installedFlag = ev.matches || checkStandalone();
    if (installedFlag) capturedPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    listeners.add(sync);

    if (typeof window !== 'undefined') {
      installedFlag = checkStandalone();
      const ua = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(ua));
    }

    return () => {
      listeners.delete(sync);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!capturedPrompt) return false;
    await capturedPrompt.prompt();
    const { outcome } = await capturedPrompt.userChoice;
    if (outcome === 'accepted') {
      installedFlag = true;
      capturedPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  };

  return {
    isInstallable: !installedFlag && Boolean(capturedPrompt),
    isInstalled: installedFlag,
    isIOS: !installedFlag && isIOS,
    install,
  };
}

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSwFn, setUpdateSwFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(
    null
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !import.meta.env.PROD
    ) {
      return;
    }

    const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);
    let swUpdateInterval: number | undefined;

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        swUpdateInterval = window.setInterval(() => {
          registration.update().catch(() => {
            // Ignore background update check errors while offline
          });
        }, 60 * 60 * 1000);
      },
    });

    setUpdateSwFn(() => updateSW);

    const handleControllerChange = () => {
      if (hadControllerAtBoot) {
        setNeedRefresh(true);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (swUpdateInterval !== undefined) {
        window.clearInterval(swUpdateInterval);
      }
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const reloadApp = async () => {
    setNeedRefresh(false);
    if (updateSwFn) {
      await updateSwFn(true);
    }
    window.location.reload();
  };

  const dismissUpdate = () => setNeedRefresh(false);

  return {
    needRefresh,
    reloadApp,
    dismissUpdate,
  };
}
