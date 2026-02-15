"use client";

import { useEffect, useRef, useCallback } from 'react';

/**
 * Options for the scroll reveal hook.
 */
interface ScrollRevealOptions {
  /** IntersectionObserver threshold (0-1). Default: 0.15 */
  threshold?: number;
  /** Root margin for early/late triggering. Default: '0px 0px -50px 0px' */
  rootMargin?: string;
  /** Stagger delay between children in ms. Default: 100 */
  staggerDelay?: number;
  /** Whether to only animate once. Default: true */
  once?: boolean;
}

/**
 * Hook that uses IntersectionObserver to add a `.revealed` class
 * to elements with `[data-reveal]` inside the observed container.
 *
 * Usage:
 * ```tsx
 * const ref = useScrollReveal();
 * return (
 *   <section ref={ref}>
 *     <div data-reveal>I fade in on scroll</div>
 *     <div data-reveal>Me too, with stagger</div>
 *   </section>
 * );
 * ```
 *
 * CSS classes applied:
 * - `[data-reveal]` elements start hidden via CSS
 * - `.revealed` class triggers the animation
 * - Stagger is applied via `transition-delay` on each child
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {}
) {
  const {
    threshold = 0.15,
    rootMargin = '0px 0px -50px 0px',
    staggerDelay = 100,
    once = true,
  } = options;

  const ref = useRef<T>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const container = entry.target as HTMLElement;
          const items = container.querySelectorAll('[data-reveal]');

          items.forEach((item, index) => {
            const el = item as HTMLElement;
            el.style.transitionDelay = `${index * staggerDelay}ms`;
            el.classList.add('revealed');
          });

          // Also reveal the container itself if it has data-reveal
          if (container.hasAttribute('data-reveal')) {
            container.classList.add('revealed');
          }

          if (once) {
            observer.unobserve(container);
          }
        } else if (!once) {
          const container = entry.target as HTMLElement;
          const items = container.querySelectorAll('[data-reveal]');
          items.forEach((item) => {
            item.classList.remove('revealed');
          });
          if (container.hasAttribute('data-reveal')) {
            container.classList.remove('revealed');
          }
        }
      });
    },
    [staggerDelay, once]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Immediately reveal everything
      const items = element.querySelectorAll('[data-reveal]');
      items.forEach((item) => item.classList.add('revealed'));
      if (element.hasAttribute('data-reveal')) {
        element.classList.add('revealed');
      }
      return;
    }

    const observer = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin,
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [handleIntersect, threshold, rootMargin]);

  return ref;
}

/**
 * Hook for counting up a number when it becomes visible.
 * Returns a ref to attach to the element containing the number.
 */
export function useCountUp(
  target: number,
  suffix: string = '',
  duration: number = 2000
) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      element.textContent = `${target}${suffix}`;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            observer.unobserve(element);

            const startTime = performance.now();
            const animate = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.ceil(eased * target);
              element.textContent = `${current}${suffix}`;

              if (progress < 1) {
                requestAnimationFrame(animate);
              }
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [target, suffix, duration]);

  return ref;
}
