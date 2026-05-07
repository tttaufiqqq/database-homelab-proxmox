import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center uppercase tracking-widest font-bold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-brand-primary text-white hover:bg-brand-secondary active:scale-[0.98]',
    secondary: 'bg-white text-brand-primary border border-brand-border hover:bg-brand-light/10 active:scale-[0.98]',
    outline: 'border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white active:scale-[0.98]',
    ghost: 'text-brand-primary/50 hover:text-brand-primary hover:bg-brand-light/10',
  };

  const sizes = {
    sm: 'px-6 py-2 text-[10px]',
    md: 'px-10 py-4 text-[11px]',
    lg: 'px-12 py-5 text-xs',
  };

  const width = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${width} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
