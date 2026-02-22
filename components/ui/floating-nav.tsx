'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Brain, Crown, Rocket } from 'lucide-react';
import { Button } from './button';

interface FloatingNavProps {
  className?: string;
}

const navItems = [
  { href: '#cortex', icon: Brain, label: 'Cortex', color: 'from-blue-600 to-cyan-500' },
  { href: '#academies', icon: Rocket, label: 'Académies', color: 'from-green-600 to-emerald-500' },
  { href: '#odyssee', icon: Crown, label: 'Odyssée', color: 'from-blue-700 to-slate-700' },
];

export function FloatingNav({ className = "" }: FloatingNavProps) {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.1], [20, 0]);

  const handleClick = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 ${className}`}
      style={{ opacity, y }}
      initial={{ opacity: 0, y: 20 }}
    >
      <div className="bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-gray-200 p-2">
        <div className="flex gap-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              onClick={() => handleClick(item.href)}
              className="rounded-full px-4 py-2 hover:bg-gradient-to-r hover:from-white hover:to-gray-50 transition-all duration-200"
            >
              <item.icon className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
