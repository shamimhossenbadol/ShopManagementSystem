'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  centerHeader?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  bodyClassName?: string;
  className?: string;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  icon,
  title,
  subtitle,
  centerHeader = false,
  children,
  footer,
  maxWidth = 'lg',
  showCloseButton = true,
  bodyClassName,
  className = '',
  zIndex = 50,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} ${className} rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] transition-all transform animate-scaleIn`}
      >
        {/* Header */}
        {(title || icon || showCloseButton) && (
          <div className="relative border-b border-slate-100 dark:border-slate-800 px-6 py-4">
            {centerHeader ? (
              <div className="flex flex-col items-center justify-center text-center px-6">
                {icon && (
                  <div className="mb-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 border border-blue-100 dark:border-blue-900/40 shadow-sm">
                    {icon}
                  </div>
                )}
                {typeof title === 'string' ? (
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                ) : (
                  title
                )}
                {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{subtitle}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {icon && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-sky-400 border border-blue-100 dark:border-blue-900/40">
                    {icon}
                  </div>
                )}
                <div>
                  {typeof title === 'string' ? (
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                  ) : (
                    title
                  )}
                  {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
              </div>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className={`flex-1 overflow-y-auto ${bodyClassName !== undefined ? bodyClassName : 'p-6'}`}>{children}</div>

        {/* Footer Actions */}
        {footer && (
          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-3.5 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
