import { useEffect, useRef } from 'react';

interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enableAudioBeep?: boolean;
}

/**
 * High-speed hardware barcode scanner listener with Web Audio API instant beep feedback
 * Optimized for both physical keyboard/mouse and touch-based POS terminals.
 */
export function useBarcodeScanner({
  onScan,
  minChars = 3,
  maxIntervalMs = 85,
  enableAudioBeep = true,
}: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(Date.now());

  const playBeep = () => {
    if (!enableAudioBeep || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, ctx.currentTime); // Crisp scanner frequency
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio autoplay may require user interaction
    }
  };

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length > 1 && e.key !== 'Enter' && e.key !== 'Tab') return;

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Handle barcode termination keys (Enter or Tab from scanner suffix)
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minChars) {
          const barcode = bufferRef.current.trim();
          bufferRef.current = '';
          e.preventDefault();
          playBeep();
          onScanRef.current(barcode);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // If typed manually with long delay (>maxIntervalMs), reset buffer
      if (interval > maxIntervalMs) {
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [minChars, maxIntervalMs, enableAudioBeep]);

  return { playBeep };
}
