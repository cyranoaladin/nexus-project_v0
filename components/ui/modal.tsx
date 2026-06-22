'use client';

/**
 * Accessible Modal Component with Radix UI Dialog
 * Lux design system — dark dashboard theme (lux-ink surface).
 * A11y: Radix handles focus-trap, ESC, aria-modal, focus return.
 * Animations respect prefers-reduced-motion via useReducedMotion().
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showClose?: boolean;
}

const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
    open,
    onOpenChange,
    title,
    description,
    children,
    size = 'md',
    showClose = true,
}) => {
    const prefersReducedMotion = useReducedMotion();
    const noMotion = { opacity: 1, scale: 1, x: '-50%', y: '-50%' };
    const initial = prefersReducedMotion
        ? noMotion
        : { opacity: 0, scale: 0.97, x: '-50%', y: '-50%' };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                className="fixed inset-0 bg-lux-ink/80 backdrop-blur-sm z-50"
                                initial={prefersReducedMotion ? { opacity: 0.8 } : { opacity: 0 }}
                                animate={{ opacity: 0.8 }}
                                exit={prefersReducedMotion ? { opacity: 0.8 } : { opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </Dialog.Overlay>

                        <Dialog.Content asChild>
                            <motion.div
                                className={cn(
                                    'fixed left-1/2 top-1/2 z-50 w-full',
                                    'bg-lux-ink border border-lux-line/20 rounded-2xl p-6',
                                    'shadow-2xl',
                                    sizeStyles[size]
                                )}
                                initial={initial}
                                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                                exit={initial}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {(title || description) && (
                                    <div className="mb-6">
                                        {title && (
                                            <Dialog.Title className="text-xl font-fraunces font-semibold text-lux-ivory">
                                                {title}
                                            </Dialog.Title>
                                        )}
                                        <div className="lux-filet-gold w-10 mt-2" />
                                        {description && (
                                            <Dialog.Description className="text-lux-slate mt-2">
                                                {description}
                                            </Dialog.Description>
                                        )}
                                    </div>
                                )}

                                <div className="text-lux-on-dark-muted">{children}</div>

                                {showClose && (
                                    <Dialog.Close asChild>
                                        <button
                                            className={cn(
                                                'absolute right-4 top-4 p-2 rounded-full',
                                                'text-lux-slate hover:text-lux-ivory hover:bg-lux-ivory/10',
                                                'transition-colors duration-200',
                                                'focus:outline-none focus:ring-2 focus:ring-lux-gold focus:ring-offset-2 focus:ring-offset-lux-ink'
                                            )}
                                            aria-label="Fermer"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </Dialog.Close>
                                )}
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
};

export default Modal;
