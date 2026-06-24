"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, Phone, ChevronDown, LogIn, UserPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import { PREPARATION_LINKS } from '@/content/marketing/preparation-links';
import { LEGAL } from '@/lib/legal';

export function CorporateNavbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const [isConnexionOpen, setIsConnexionOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const connexionRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connexionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openConnexion = useCallback(() => {
    if (connexionTimerRef.current) {
      clearTimeout(connexionTimerRef.current);
      connexionTimerRef.current = null;
    }
    setIsConnexionOpen(true);
  }, []);

  const scheduleConnexionClose = useCallback(() => {
    connexionTimerRef.current = setTimeout(() => {
      setIsConnexionOpen(false);
      connexionTimerRef.current = null;
    }, 300);
  }, []);

  const cancelConnexionClose = useCallback(() => {
    if (connexionTimerRef.current) {
      clearTimeout(connexionTimerRef.current);
      connexionTimerRef.current = null;
    }
  }, []);

  const openGroup = useCallback((group: string) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenDesktopGroup(group);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setOpenDesktopGroup(null);
      closeTimerRef.current = null;
    }, 300);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (connexionTimerRef.current) clearTimeout(connexionTimerRef.current);
    };
  }, []);

  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuOverlayRef = useRef<HTMLDivElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the close button on open (after transition starts)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById('close-menu')?.focus();
      });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }

      // Focus trap — wrap Tab within the overlay
      if (event.key === 'Tab' && menuOverlayRef.current) {
        const focusable = menuOverlayRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      // Restore focus to trigger
      menuTriggerRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    setOpenDesktopGroup(null);
    setIsConnexionOpen(false);
  }, [pathname]);

  const chromePillBase =
    'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-mono uppercase tracking-[0.12em] transition-colors text-neutral-300 hover:border-lux-gold/40 hover:bg-white/10 hover:text-white';
  const chromePillActive = 'border-lux-gold/40 bg-white/10 text-white';
  const chromeMenuItem = 'group/item flex items-start gap-3 rounded-xl px-4 py-3.5 transition-colors text-neutral-300 hover:bg-white/10 hover:text-white';
  const chromeMenuItemActive = 'bg-white/10 text-white';
  const chromeHeader = 'fixed top-0 left-0 right-0 z-50 bg-surface-darker/88 backdrop-blur-md border-b border-white/10 shadow-[0_12px_40px_rgba(7,26,58,0.18)] transition-all duration-500';
  const chromeCta = 'hidden md:flex items-center gap-2 rounded-full bg-lux-gold px-5 py-2.5 text-xs font-semibold text-lux-ink transition-all hover:bg-lux-gold-bright shadow-[0_12px_30px_rgba(191,160,106,0.18)]';
  const chromeMobileCta = 'md:hidden inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:border-lux-gold/40 hover:bg-white/10 min-h-[44px]';
  const chromeMenuButton = 'md:hidden flex items-center gap-2 text-white transition-colors duration-300 hover:text-lux-gold-wash group';

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(event.target as Node)) {
        setOpenDesktopGroup(null);
      }
      if (connexionRef.current && !connexionRef.current.contains(event.target as Node)) {
        setIsConnexionOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDesktopGroup(null);
        setIsConnexionOpen(false);
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
      title: 'Offres & tarifs',
      items: [
        { label: 'Offres & tarifs', href: '/offres', desc: 'Catalogue 2026/2027', isPage: true },
        { label: 'Trouver ma formule', href: '/recommandation', desc: 'Diagnostic en 3 questions', isPage: true },
        { label: 'Bilan gratuit', href: '/bilan-gratuit', desc: 'Évaluation personnalisée', isPage: true },
      ]
    },
    {
      title: 'Programmes',
      items: [
        { label: 'Stages intensifs', href: '/stages', desc: 'Toutes les vacances', isPage: true },
        { label: 'Plateforme ARIA', href: '/plateforme-aria', desc: 'Ressources & parcours en ligne', isPage: true },
        { label: 'Accompagnement scolaire', href: '/accompagnement-scolaire', desc: 'Suivi personnalisé', isPage: true },
        { label: 'Ressources', href: '/ressources', desc: 'Hub de contenus utiles', isPage: true },
      ]
    },
    {
      title: 'Préparations',
      items: PREPARATION_LINKS.map((item) => ({
        label: item.label,
        href: item.href,
        desc: item.description,
        isPage: true,
      })),
    },
    {
      title: 'Contact',
      items: [
        { label: 'Contact', href: '/contact', desc: 'Nous joindre', isPage: true },
        { label: 'Notre Centre', href: '/notre-centre', desc: 'Mutuelleville, Tunis', isPage: true },
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
        className={chromeHeader}
      >
        <div className="flex items-center justify-between px-6 lg:px-12 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo_slogan_nexus.webp"
              alt="Nexus Réussite"
              width={180}
              height={65}
              className="h-10 w-auto md:h-12"
              priority
              fetchPriority="high"
              unoptimized
            />
          </Link>

          {/* Desktop Rubriques + Sous-rubriques */}
          <div ref={desktopMenuRef} className="hidden md:flex items-center gap-1">
            {menuGroups.map((group) => {
              const isGroupActive = group.items.some((item) => item.href === pathname);
              const isOpenGroup = openDesktopGroup === group.title;

              return (
                <div
                  key={group.title}
                  className="relative"
                  onMouseEnter={() => openGroup(group.title)}
                  onMouseLeave={scheduleClose}
                >
                <button
                  type="button"
                  onClick={() => {
                    if (isOpenGroup) {
                      setOpenDesktopGroup(null);
                      } else {
                        openGroup(group.title);
                    }
                  }}
                  className={`${chromePillBase} ${isGroupActive || isOpenGroup ? chromePillActive : ''}`}
                    aria-expanded={isOpenGroup}
                    aria-haspopup="menu"
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${isOpenGroup ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Invisible bridge — prevents gap between trigger and panel from closing the menu */}
                  {isOpenGroup && (
                    <div className="absolute left-0 top-full w-full h-3" aria-hidden="true" />
                  )}

                  {isOpenGroup && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-72 rounded-2xl border border-white/10 bg-surface-darker/95 backdrop-blur-xl shadow-2xl p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200"
                      role="menu"
                      onMouseEnter={cancelClose}
                      onMouseLeave={scheduleClose}
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenDesktopGroup(null)}
                          className={`${chromeMenuItem} ${pathname === item.href ? chromeMenuItemActive : ''}`}
                          role="menuitem"
                        >
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-xs text-neutral-500 group-hover/item:text-neutral-400 mt-0.5 transition-colors">
                            {item.desc}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Connexion Dropdown - Desktop */}
            <div
              ref={connexionRef}
              className="relative hidden md:block"
              onMouseEnter={openConnexion}
              onMouseLeave={scheduleConnexionClose}
            >
              <button
                type="button"
                onClick={() => setIsConnexionOpen((prev) => !prev)}
                className={`${chromePillBase} ${isConnexionOpen ? chromePillActive : ''}`}
                aria-expanded={isConnexionOpen}
                aria-haspopup="menu"
              >
                <LogIn className="w-4 h-4" aria-hidden="true" />
                <span>Connexion</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isConnexionOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {/* Invisible bridge */}
              {isConnexionOpen && (
                <div className="absolute left-0 top-full w-full h-3" aria-hidden="true" />
              )}

              {isConnexionOpen && (
                <div
                  className="absolute right-0 top-full mt-3 w-72 rounded-2xl border border-white/10 bg-surface-darker/95 backdrop-blur-xl shadow-2xl p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200"
                  role="menu"
                  onMouseEnter={cancelConnexionClose}
                  onMouseLeave={scheduleConnexionClose}
                >
                  <Link
                    href="/auth/signin"
                    onClick={() => setIsConnexionOpen(false)}
                    className={chromeMenuItem}
                    role="menuitem"
                  >
                    <LogIn className="w-5 h-5 mt-0.5 text-lux-gold-wash flex-shrink-0" aria-hidden="true" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Se connecter</span>
                      <span className="text-xs text-neutral-500 group-hover/item:text-neutral-400 mt-0.5 transition-colors">
                        Admin, coach, parent, élève…
                      </span>
                    </div>
                  </Link>
                  <Link
                    href="/bilan-gratuit"
                    onClick={() => setIsConnexionOpen(false)}
                    className={chromeMenuItem}
                    role="menuitem"
                  >
                    <UserPlus className="w-5 h-5 mt-0.5 text-lux-evergreen flex-shrink-0" aria-hidden="true" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Demander un bilan</span>
                      <span className="text-xs text-neutral-500 group-hover/item:text-neutral-400 mt-0.5 transition-colors">
                        Nouveau parent ou élève
                      </span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* CTA Button - Desktop */}
            <Link
              href="/bilan-gratuit"
              className={chromeCta}
              aria-label="Démarrer un bilan gratuit"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span>Bilan gratuit</span>
            </Link>

            {/* Sign-in Button - Mobile */}
            <Link
              href="/auth/signin"
              className={chromeMobileCta}
              aria-label="Se connecter"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Connexion</span>
            </Link>

            {/* Menu Button - Mobile */}
            <button
              ref={menuTriggerRef}
              onClick={() => setIsOpen(true)}
              className={chromeMenuButton}
              aria-label="Ouvrir le menu"
              aria-expanded={isOpen}
              aria-controls="primary-menu"
            >
              <span className="font-mono text-xs uppercase tracking-[0.14em] group-hover:tracking-[0.2em] transition-all text-neutral-300">Menu</span>
              <Menu className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Full Screen Menu Overlay */}
      <div
        ref={menuOverlayRef}
        id="primary-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className={`fixed inset-0 z-[100] transition-all duration-500 motion-reduce:transition-none ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-lux-ink/95 backdrop-blur-xl"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
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
                className="text-white hover:text-lux-gold-wash transition-colors duration-300"
                aria-label="Fermer le menu"
              >
                <X className="w-8 h-8" aria-hidden="true" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex items-center justify-center flex-1">
              {(isOpen || !reducedMotion) && (
                <nav className="w-full max-w-5xl px-6 md:px-10" aria-label="Menu principal">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                    {menuGroups.map((group, groupIndex) => (
                      <div key={group.title} className="space-y-6">
                        <div className="text-xs uppercase tracking-[0.24em] text-lux-gold-wash font-mono">
                          {group.title}
                        </div>
                        <div className="lux-filet-gold w-10" />
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
                                            hover:to-lux-gold-wash transition-all duration-300
                                            relative group"
                                style={{
                                  transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                                  opacity: isOpen ? 1 : 0,
                                  transition: reducedMotion ? 'none' : `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s`
                                }}
                              >
                                {item.label}
                                <span
                                  className={`absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-lux-gold transition-opacity ${pathname === item.href ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                  aria-hidden="true"
                                />
                              </Link>
                            ) : (
                              <button
                                key={item.href}
                                onClick={() => scrollToSection(item.href.replace('/', ''))}
                                className="font-display text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400
                                            hover:to-lux-gold-wash transition-all duration-300
                                            relative group text-left"
                                style={{
                                  transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                                  opacity: isOpen ? 1 : 0,
                                  transition: reducedMotion ? 'none' : `all 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.08}s`
                                }}
                              >
                                {item.label}
                                <span className="absolute -left-8 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-lux-gold opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
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
                    <p className="text-xs uppercase tracking-[0.2em] text-lux-gold-wash font-mono">
                      Prochaine étape
                    </p>
                    <p className="mt-2 text-2xl md:text-3xl font-bold text-white" role="presentation">
                      Démarrer en moins de 2 minutes
                    </p>
                    <p className="mt-2 text-sm text-neutral-300">
                      Lancez un bilan gratuit ou échangez avec un expert.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="/auth/signin"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 rounded-lg lux-cta-reserve px-5 py-3 text-sm font-semibold transition-all"
                    >
                      <LogIn className="w-4 h-4" aria-hidden="true" />
                      Se connecter
                    </Link>
                    <Link
                      href="/bilan-gratuit"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-all hover:border-lux-gold/40 hover:bg-white/10"
                    >
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                      Demander un bilan
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4
                                text-neutral-500 text-sm font-mono border-t border-white/5">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-lux-gold-wash" aria-hidden="true" />
                <span>{LEGAL.contact.phone}</span>
              </div>
              <div>{LEGAL.contact.email}</div>
              <div>Centre Urbain Nord, {LEGAL.addresses.siege.city}</div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
