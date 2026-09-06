import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'default';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
  trend,
  onClick,
  className = '',
}) => {
  const variantStyles = {
    default:
      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
    primary:
      'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-950 dark:text-blue-200',
    success:
      'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200',
    danger:
      'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-950 dark:text-red-200',
    warning:
      'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-950 dark:text-amber-200',
    info: 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/40 text-cyan-950 dark:text-cyan-200',
  };

  const iconStyles = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    primary: 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-sky-300',
    success: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
    danger: 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300',
    warning: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
    info: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-5 shadow-sm transition-all duration-200 ${variantStyles[variant]} ${
        onClick ? 'cursor-pointer hover-lift hover:border-blue-500' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && <div className={`rounded-xl p-2.5 shadow-sm ${iconStyles[variant]}`}>{icon}</div>}
      </div>

      <div className="mt-3 font-mono text-2xl font-black tracking-tight">{value}</div>

      <div className="mt-2 flex items-center justify-between text-xs">
        {subValue && (
          <div className="text-slate-500 dark:text-slate-400 font-medium truncate">{subValue}</div>
        )}
        {trend && (
          <span
            className={`font-bold font-mono text-xs px-2 py-0.5 rounded-md ${
              trend.isPositive
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
