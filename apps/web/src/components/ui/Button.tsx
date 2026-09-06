import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'pos';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variantStyles = {
    primary:
      'bg-blue-700 hover:bg-blue-800 text-white shadow-sm hover:shadow focus:ring-blue-600 dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950',
    secondary:
      'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 focus:ring-slate-400',
    ghost:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-slate-400',
    danger:
      'bg-red-700 hover:bg-red-800 text-white shadow-sm focus:ring-red-600 dark:bg-red-500 dark:hover:bg-red-400 dark:text-white',
    success:
      'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm focus:ring-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950',
  };

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2 min-h-[40px]',
    lg: 'h-11 px-5 text-base gap-2.5',
    pos: 'h-12 px-6 text-base font-bold gap-3 min-h-[48px] shadow-md',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'pos';
    icon: React.ReactNode;
    title: string;
  }
> = ({ variant = 'secondary', size = 'md', icon, title, className = '', ...props }) => {
  const sizeStyles = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm min-h-[40px] min-w-[40px]',
    lg: 'h-11 w-11 text-base',
    pos: 'h-12 w-12 text-lg min-h-[48px] min-w-[48px]',
  };

  const variantStyles = {
    primary:
      'bg-blue-700 hover:bg-blue-800 text-white shadow-sm dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950',
    secondary:
      'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80',
    ghost:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
    danger:
      'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300',
  };

  return (
    <button
      title={title}
      aria-label={title}
      className={`inline-flex items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};
