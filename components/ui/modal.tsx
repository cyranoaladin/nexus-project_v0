'use client';

/**
 * Accessible Modal Component with Radix UI Dialog
 * Fully accessible modal with animations
 */

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
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
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {open && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </Dialog.Overlay>

                        <Dialog.Content asChild>
                            <motion.div
                                className={cn(
                                    'fixed left-1/2 top-1/2 z-50 w-full',
                                    'bg-surface-card border border-white/10 rounded-card p-6',
                                    'shadow-2xl',
                                    sizeStyles[size]
                                )}
                                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                                transition={{ duration: 0.2 }}
                            >
                                {(title || description) && (
                                    <div className="mb-6">
                                        {title && (
                                            <Dialog.Title className="text-2xl font-bold text-white mb-2">
                                                {title}
                                            </Dialog.Title>
                                        )}
                                        {description && (
                                            <Dialog.Description className="text-neutral-300">
                                                {description}
                                            </Dialog.Description>
                                        )}
                                    </div>
                                )}

                                <div className="text-neutral-200">{children}</div>

                                {showClose && (
                                    <Dialog.Close asChild>
                                        <button
                                            className={cn(
                                                'absolute right-4 top-4 p-2 rounded-full',
                                                'text-neutral-400 hover:text-white hover:bg-white/10',
                                                'transition-colors duration-200',
                                                'focus:outline-none focus:ring-2 focus:ring-brand-accent'
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
