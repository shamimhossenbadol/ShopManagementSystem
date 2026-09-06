'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  ShieldAlert,
  ShoppingCart,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface SwitchToPosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SwitchToPosModal({ isOpen, onClose }: SwitchToPosModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmSwitch = async () => {
    setLoading(true);
    setError(null);

    const res = await apiRequest('/auth/switch-to-pos', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (res.success) {
      // Hard navigation to /pos to reload auth state under sales_executive role
      window.location.href = '/pos';
    } else {
      setLoading(false);
      setError(res.message || 'Failed to switch to POS session. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={
        <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span className="font-black tracking-tight uppercase text-sm sm:text-base">
            Switch to POS Terminal Shift
          </span>
        </div>
      }
      subtitle="Manager Privilege Revocation Notice"
      maxWidth="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            size="md"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={loading}
            onClick={handleConfirmSwitch}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-md shadow-amber-600/20"
            leftIcon={<ShoppingCart className="h-4 w-4" />}
          >
            Confirm & Start POS Shift
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                You are entering POS Sales Executive Mode
              </h4>
              <p className="text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                By proceeding, your active session will be transitioned to a <strong>Sales Executive POS Shift</strong>. Manager facilities and administrative controls will be immediately revoked.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-slate-600 dark:text-slate-300 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>A dedicated cashier shift session will be created in your name.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>All sales, floats, and drawer movements will be audited under your shift.</span>
          </div>
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold">
            <Lock className="h-4 w-4 shrink-0" />
            <span>To return to Manager Dashboard, you must log in again with your manager credentials.</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
