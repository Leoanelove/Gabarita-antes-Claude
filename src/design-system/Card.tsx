import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass';
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  hoverEffect = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-xl border transition-all';
  const variantStyles = {
    default: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm',
    elevated: 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-md dark:shadow-slate-950/40',
    glass: 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-slate-200/60 dark:border-slate-800/60 shadow-sm',
  };
  const hoverStyles = hoverEffect ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5' : '';

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, children, className = '' }) => (
  <div className={`p-5 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 ${className}`}>
    {children ? (
      <div className="w-full">{children}</div>
    ) : (
      <>
        <div>
          {title && (
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base sm:text-lg tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="ml-3 shrink-0">{action}</div>}
      </>
    )}
  </div>
);

export const CardBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`}>
    {children}
  </div>
);

export const CardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`p-4 px-5 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 rounded-b-xl flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 ${className}`}>
    {children}
  </div>
);
