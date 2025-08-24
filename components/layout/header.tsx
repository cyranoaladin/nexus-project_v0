"use client";

import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Close menu when clicking outside or on a link
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && !(event.target as Element).closest('.mobile-menu-container')) {
        setIsMenuOpen(false);
      }
    };

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMenuOpen]);

  const navigation = [
    { name: "Accueil", href: "/" },
    { name: "Assistant IA", href: "/aria" },
    { name: "Notre Équipe", href: "/equipe" },
    { name: "Offres & Tarifs", href: "/offres" },
    { name: "Notre Centre", href: "/notre-centre" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-200 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-sm' : 'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 md:h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 md:space-x-3">
            <Image
              src="/images/logo.png"
              alt="Nexus Réussite"
              width={48}
              height={48}
              className="h-10 md:h-12"
              style={{ width: 'auto' }}
              priority
            />
            <div className="font-bold text-xl md:text-2xl">
              <span className="text-blue-600">Nexus</span>
              <span className="text-red-500"> Réussite</span>
            </div>
          </Link>

          {/* Navigation Desktop */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors duration-200 py-2 px-1 relative group"
              >
                {item.name}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>

          {/* CTA Buttons Desktop */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            <Button asChild variant="secondary" size="sm" className="px-4">
              <Link href="/auth/signin">
                Se Connecter
              </Link>
            </Button>
            <Button asChild size="sm" className="px-4">
              <Link href="/bilan-gratuit">
                Bilan Gratuit
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div className={`mobile-menu-container md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-4 space-y-2 border-t border-slate-200 mt-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-4 py-3 text-base font-medium text-slate-900 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
            <div className="px-2 space-y-2 mt-2">
              <Button asChild variant="secondary" className="w-full">
                <Link href="/auth/signin" onClick={() => setIsMenuOpen(false)}>
                  Se Connecter
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/bilan-gratuit" onClick={() => setIsMenuOpen(false)}>
                  Bilan Gratuit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
