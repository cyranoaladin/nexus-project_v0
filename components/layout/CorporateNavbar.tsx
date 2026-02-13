"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";

export function CorporateNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    setOpenDesktopGroup(null);
  }, [pathname]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!desktopMenuRef.current) return;
      if (!desktopMenuRef.current.contains(event.target as Node)) {
        setOpenDesktopGroup(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDesktopGroup(null);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const menuGroups = [
    {
      title: 'Essentiel',
      items: [
        { label: 'Accueil', href: '/', isPage: true },
        { label: 'Offres', href: '/offres', isPage: true },
        { label: 'Bilan Gratuit', href: '/bilan-gratuit', isPage: true },
        { label: 'Contact', href: '/contact', isPage: true },
      ]
    },
    {
      title: 'Programmes',
      items: [
        { label: 'Accompagnement Scolaire', href: '/accompagnement-scolaire', isPage: true },
        { label: 'Stages', href: '/stages', isPage: true },
        { label: 'Plateforme ARIA', href: '/plateforme-aria', isPage: true },
      ]
    },
    {
      title: 'À propos',
      items: [
        { label: 'Notre Équipe', href: '/equipe', isPage: true },
        { label: 'Notre Centre', href: '/notre-centre', isPage: true },
      ]
    },
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
          : 'bg-surface-darker/80 backdrop-blur-sm'
          }`}
      >
        <div className="flex items-center justify-between px-6 lg:px-12 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo_slogan_nexus_x3.png"
              alt="Nexus Réussite"
              width={180}
              height={65}
              className="h-10 w-auto md:h-12 brightness-0 invert"
              priority
            />
          </Link>

          {/* Desktop Rubriques + Sous-rubriques */}
          <div ref={desktopMenuRef} className="hidden md:flex items-center gap-3">
            {menuGroups.map((group) => {
              const isGroupActive = group.items.some((item) => item.href === pathname);
              const isOpenGroup = openDesktopGroup === group.title;

              return (
                <div
                  key={group.title}
                  className="relative"
                  onMouseEnter={() => setOpenDesktopGroup(group.title)}
                  onMouseLeave={() => setOpenDesktopGroup((current) => (current === group.title ? null : current))}
                >
                  <button
                    type="button"
                    onClick={() => setOpenDesktopGroup(isOpenGroup ? null : group.title)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-mono uppercase tracking-[0.12em] transition-colors border ${
                      isGroupActive
                        ? "text-white border-brand-accent/50 bg-white/10"
                        : "text-neutral-300 border-white/10 hover:text-white hover:border-white/30"
                    }`}
                    aria-expanded={isOpenGroup}
                    aria-haspopup="menu"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isOpenGroup ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpenGroup && (
                    <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-surface-darker/95 backdrop-blur-xl shadow-2xl p-2 z-[60]">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenDesktopGroup(null)}
                          className={`block rounded-xl px-4 py-3 text-sm transition-colors ${
                            pathname === item.href
                              ? "bg-white/10 text-white"
                              : "text-neutral-300 hover:bg-white/10 hover:text-white"
                          }`}
                          role="menuitem"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
          {/* CTA Button - Desktop */}
            <Link
              href="/bilan-gratuit"
              className="hidden md:flex items-center gap-2 btn-primary shadow-[0_12px_30px_rgba(79,209,233,0.2)] hover:shadow-[0_16px_40px_rgba(79,209,233,0.25)]"
              aria-label="Démarrer un bilan gratuit"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span>Bilan gratuit</span>
            </Link>

            {/* Menu Button */}
            <button
              onClick={() => setIsOpen(true)}
              className="md:hidden flex items-center gap-2 text-white hover:text-brand-accent
                         transition-colors duration-300 group"
              aria-label="Ouvrir le menu"
              aria-expanded={isOpen}
              aria-controls="primary-menu"
            >
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-neutral-300 group-hover:tracking-[0.2em] transition-all">Menu</span>
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Full Screen Menu Overlay */}
      <div
        id="primary-menu"
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
                <nav className="w-full max-w-5xl px-6 md:px-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {menuGroups.map((group, groupIndex) => (
                      <div key={group.title} className="space-y-6">
                        <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-mono">
                          {group.title}
                        </div>
                        <div className="flex flex-col gap-6">
                          {group.items.map((item, itemIndex) => {
                            const index = groupIndex * 10 + itemIndex;
                            return item.isPage ? (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsOpen(false)}
                                aria-current={pathname === item.href ? "page" : undefined}
                                className="font-display text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400
                                            hover:to-brand-accent transition-all duration-300
                                            relative group"
                                style={{
                                  transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                                  opacity: isOpen ? 1 : 0,
                                  transition: reducedMotion ? 'none' : `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s`
                                }}
                              >
                                {item.label}
                                <span
                                  className={`absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand-accent transition-opacity ${pathname === item.href ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  aria-hidden="true"
                                />
                              </Link>
                            ) : (
                              <button
                                key={item.href}
                                onClick={() => scrollToSection(item.href.replace('/', ''))}
                                className="font-display text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400
                                            hover:to-brand-accent transition-all duration-300
                                            relative group text-left"
                                style={{
                                  transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                                  opacity: isOpen ? 1 : 0,
                                  transition: reducedMotion ? 'none' : `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s`
                                }}
                              >
                                {item.label}
                                <span className="absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </nav>
              )}
            </div>

            <div className="px-6 lg:px-12 pb-8">
              <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-mono">
                      Prochaine étape
                    </p>
                    <h3 className="mt-2 text-2xl md:text-3xl font-bold text-white">
                      Démarrer en moins de 2 minutes
                    </h3>
                    <p className="mt-2 text-sm text-neutral-300">
                      Lancez un bilan gratuit ou échangez avec un expert.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/bilan-gratuit"
                      onClick={() => setIsOpen(false)}
                      className="btn-primary"
                    >
                      Bilan gratuit
                    </Link>
                    <Link
                      href="/contact"
                      onClick={() => setIsOpen(false)}
                      className="btn-outline"
                    >
                      Parler à un expert
                    </Link>
                  </div>
                </div>
              </div>
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
