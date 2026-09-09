'use client';

import React, { useState, useEffect } from 'react';
import { Download, Monitor, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPwaButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as installed standalone app
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Register Service Worker if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // If already running in standalone desktop app mode, don't show prompt
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Fallback instruction if browser doesn't support or already prompted
      alert(
        'To install Al-Noor POS as a Windows Desktop App:\n\n' +
        '1. In Microsoft Edge or Chrome, click the App icon in the address bar (or Menu -> Apps).\n' +
        '2. Click "Install Al-Noor Supermarket & Retail POS".\n' +
        '3. The app will install to your Start Menu & Taskbar and run in its own window!'
      );
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('PWA install error:', err);
    }
  };

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl ${className}`}>
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        <span>App Installed on Windows</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 border bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700/80 shadow-md hover:border-blue-500/50 hover:shadow-blue-500/10 ${className}`}
      title="Install Al-Noor POS as a Windows Desktop Application"
    >
      <Monitor className="h-4 w-4 text-sky-400 group-hover:scale-110 transition-transform" />
      <span>Install Windows App</span>
      <Download className="h-3.5 w-3.5 text-slate-400 group-hover:text-white ml-0.5" />
    </button>
  );
}
