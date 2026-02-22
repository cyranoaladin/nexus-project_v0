'use client';

/**
 * Enhanced Button Component with Loading and Disabled States
 * Uses Framer Motion for animations and Tailwind v4 design tokens
 */

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    children: React.ReactNode;
}

const variantStyles = {
    primary: 'bg-brand-primary text-white hover:bg-brand-primary/90',
    secondary: 'bg-brand-secondary text-white hover:bg-brand-secondary/90',
    outline: 'border-2 border-white/20 text-neutral-100 hover:border-white/35 hover:bg-white/10',
    ghost: 'text-neutral-100 hover:bg-white/10',
    danger: 'bg-error text-white hover:bg-error/90',
};

const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            loading = false,
            disabled = false,
            fullWidth = false,
            className,
            children,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || loading;

        return (
            <motion.button
                ref={ref}
                className={cn(
                    'relative font-semibold rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-dark',
                    variantStyles[variant],
                    sizeStyles[size],
                    fullWidth && 'w-full',
                    isDisabled && 'opacity-50 cursor-not-allowed',
                    className
                )}
                disabled={isDisabled}
                whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                aria-busy={loading}
                aria-disabled={isDisabled}
                {...props}
            >
                {loading && (
                    <motion.span
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Loader2 className="w-5 h-5 animate-spin" aria-label="Chargement" />
                    </motion.span>
                )}
                <span className={cn(loading && 'invisible')}>{children}</span>
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

export default Button;
