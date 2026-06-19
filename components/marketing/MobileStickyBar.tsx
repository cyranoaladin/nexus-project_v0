'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

/**
 * Mobile-only sticky CTA bar.
 *
 * - Appears after the hero section exits the viewport.
 * - Disappears when the footer enters the viewport.
 * - Respects env(safe-area-inset-bottom) for iOS notch.
 * - Never covers a focused form field (hides on focus).
 * - Only renders on mobile (hidden md:hidden).
 */
export function MobileStickyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let heroOut = false;
    let footerIn = false;
    let formFocused = false;

    function update() {
      setVisible(heroOut && !footerIn && !formFocused);
    }

    // Observe the hero section (first <section> or [data-hero])
    const hero =
      document.querySelector('[data-hero]') ??
      document.querySelector('main > section:first-of-type');
    const footer = document.querySelector('footer');

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === hero) {
            heroOut = !entry.isIntersecting;
          }
          if (entry.target === footer) {
            footerIn = entry.isIntersecting;
          }
        }
        update();
      },
      { threshold: 0 },
    );

    if (hero) io.observe(hero);
    if (footer) io.observe(footer);

    // Hide when a form input is focused (prevent covering fields)
    function handleFocusIn(e: Event) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        formFocused = true;
        update();
      }
    }
    function handleFocusOut() {
      formFocused = false;
      update();
    }

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      io.disconnect();
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <nav
      aria-label="Actions rapides"
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      {...(!visible ? { inert: true } : {})}
    >
      <div className="flex items-center gap-3 border-t border-lux-line bg-lux-white px-4 py-3 lux-shadow">
        <Link
          href="/bilan-gratuit"
          className="lux-cta-reserve flex-1 rounded-lg px-4 py-3 text-center text-sm font-semibold"
          tabIndex={visible ? 0 : -1}
        >
          Bilan gratuit
        </Link>
        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-lux-line text-lux-evergreen transition hover:border-lux-evergreen/50"
          aria-label="Contacter sur WhatsApp"
          tabIndex={visible ? 0 : -1}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </a>
      </div>
    </nav>
  );
}
