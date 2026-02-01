"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Phone } from "lucide-react";

export function CorporateNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { label: 'Expertise', href: '/#adn' },
    { label: 'Accompagnement', href: '/#paths' },
    { label: 'Solutions', href: '/#offer' },
    { label: 'Korrigo', href: '/#korrigo' },
    { label: 'Témoignages', href: '/#testimonials' },
  ];

  const scrollToSection = (id: string) => {
    setIsOpen(false);
    const element = document.querySelector(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Fixed Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
          ? 'bg-surface-darker/90 backdrop-blur-md border-b border-white/5'
          : 'bg-transparent'
          }`}
      >
        <div className="flex items-center justify-between px-6 lg:px-12 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-accent rounded-lg flex items-center justify-center">
              <span className="font-display font-bold text-white text-xl">N</span>
            </div>
            <div className="hidden md:block">
              <span className="block font-display font-bold text-white text-lg leading-none">NEXUS</span>
              <span className="block font-mono text-[10px] text-brand-accent tracking-widest leading-none">RÉUSSITE</span>
            </div>
          </Link>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            {/* CTA Button - Desktop */}
            <button
              onClick={() => scrollToSection('#contact')}
              className="hidden md:flex items-center gap-2 bg-brand-accent/10 text-brand-accent
                         px-4 py-2 rounded-full text-sm font-medium border border-brand-accent/20
                         hover:bg-brand-accent/20 transition-all duration-300"
              aria-label="Parler à un expert"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span>Parler à un expert</span>
            </button>

            {/* Menu Button */}
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 text-white hover:text-brand-accent
                         transition-colors duration-300 group"
              aria-label="Ouvrir le menu"
            >
              <span className="font-mono text-xs uppercase tracking-[0.14em] group-hover:tracking-[0.2em] transition-all">Menu</span>
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Full Screen Menu Overlay */}
      <div
        className={`fixed inset-0 z-[100] transition-all duration-500 motion-reduce:transition-none ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-surface-darker/95 backdrop-blur-xl"
          onClick={() => setIsOpen(false)}
        />

        {/* Content */}
        <div className="relative h-full flex flex-col pointer-events-none">
          <div className="pointer-events-auto h-full flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 lg:px-12 py-4">
              <div className="w-10 h-10 opacity-0" /> {/* Spacer */}
              <button
                id="close-menu"
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-brand-accent transition-colors duration-300"
                aria-label="Fermer le menu"
              >
                <X className="w-8 h-8" aria-hidden="true" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex items-center justify-center flex-1">
              {(isOpen || !reducedMotion) && (
                <nav className="flex flex-col items-center gap-8">
                  {menuItems.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => scrollToSection(item.href.replace('/', ''))}
                      className="font-display text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400
                                  hover:to-brand-accent transition-all duration-300
                                  relative group"
                      style={{
                        transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                        opacity: isOpen ? 1 : 0,
                        transition: reducedMotion ? 'none' : `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`
                      }}
                    >
                      {item.label}
                      <span className="absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                    </button>
                  ))}
                </nav>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4
                                text-neutral-500 text-sm font-mono border-t border-white/5">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-brand-accent" aria-hidden="true" />
                <span>+216 99 19 28 29</span>
              </div>
              <div>contact@nexusreussite.academy</div>
              <div>Centre Urbain Nord, Tunis</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
