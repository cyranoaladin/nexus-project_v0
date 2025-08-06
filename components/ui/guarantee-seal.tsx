'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface GuaranteeSealProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GuaranteeSeal({ size = 'md', className = "" }: GuaranteeSealProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      <Image
        src="/images/sceau_garantie_reussite.png"
        alt="Sceau de Garantie de Réussite"
        width={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
        height={size === 'sm' ? 32 : size === 'md' ? 48 : 64}
        className="w-full h-full object-contain"
      />
    </motion.div>
  );
}
