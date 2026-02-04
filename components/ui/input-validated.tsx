'use client';

/**
 * Enhanced Input Component with Zod Validation
 * Accessible input with error states and validation
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-4 text-lg',
};

export const InputWithValidation = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            error,
            helperText,
            fullWidth = false,
            size = 'md',
            className,
            id,
            ...props
        },
        ref
    ) => {
        const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
        const hasError = Boolean(error);

        return (
            <div className={cn('space-y-2', fullWidth && 'w-full')}>
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-neutral-200"
                    >
                        {label}
                        {props.required && <span className="text-error ml-1" aria-label="requis">*</span>}
                    </label>
                )}

                <div className="relative">
                    <input
                        ref={ref}
                        id={inputId}
                        className={cn(
                            'w-full rounded-lg border bg-surface-card text-white transition-all duration-200',
                            'focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent',
                            'placeholder:text-neutral-500',
                            sizeStyles[size],
                            hasError
                                ? 'border-error focus:ring-error'
                                : 'border-white/10 hover:border-white/20',
                            props.disabled && 'opacity-50 cursor-not-allowed',
                            className
                        )}
                        aria-invalid={hasError}
                        aria-describedby={
                            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
                        }
                        {...props}
                    />

                    {hasError && (
                        <motion.div
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <AlertCircle className="w-5 h-5 text-error" aria-hidden="true" />
                        </motion.div>
                    )}
                </div>

                {error && (
                    <motion.p
                        id={`${inputId}-error`}
                        className="text-sm text-error flex items-center gap-1"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        role="alert"
                    >
                        {error}
                    </motion.p>
                )}

                {helperText && !error && (
                    <p
                        id={`${inputId}-helper`}
                        className="text-sm text-neutral-400"
                    >
                        {helperText}
                    </p>
                )}
            </div>
        );
    }
);

InputWithValidation.displayName = 'InputWithValidation';

export default InputWithValidation;
