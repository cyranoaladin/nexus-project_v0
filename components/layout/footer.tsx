import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Logo et Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-3 md:mb-4">
              <Image
                src="/images/logo.png"
                alt="Nexus Réussite"
                width={40}
                height={40}
                className="h-8 md:h-10"
                style={{ width: 'auto' }}
              />
              <div className="font-bold text-lg md:text-xl">
                <span className="text-blue-300">Nexus</span>
                <span className="text-red-400"> Réussite</span>
              </div>
            </Link>
            <p className="text-blue-300 mb-4 md:mb-6 max-w-md text-sm md:text-base">
              La plateforme de <span className="text-blue-300 font-semibold">pédagogie augmentée</span> de référence pour la <span className="text-blue-300 font-semibold">réussite au Baccalauréat</span> et l'<span className="text-blue-300 font-semibold">excellence à Parcoursup</span>.
            </p>
            <div className="flex space-x-3 md:space-x-4">
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Facebook className="h-4 w-4 md:h-5 md:w-5" />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Instagram className="h-4 w-4 md:h-5 md:w-5" />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Linkedin className="h-4 w-4 md:h-5 md:w-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-base md:text-lg mb-3 md:mb-4">Navigation</h3>
            <ul className="space-y-1 md:space-y-2">
              <li><Link href="/equipe" className="text-blue-300 hover:text-white transition-colors text-sm md:text-base">Notre Équipe</Link></li>
              <li><Link href="/offres" className="text-blue-300 hover:text-white transition-colors text-sm md:text-base">Offres & Tarifs</Link></li>
              <li><Link href="/notre-centre" className="text-blue-300 hover:text-white transition-colors text-sm md:text-base">Notre Centre</Link></li>
              <li><Link href="/contact" className="text-blue-300 hover:text-white transition-colors text-sm md:text-base">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-base md:text-lg mb-3 md:mb-4">Contact</h3>
            <ul className="space-y-2 md:space-y-3">
              <li className="flex items-center space-x-2">
                <Phone className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                <span className="text-blue-300 text-sm md:text-base">+216 XX XXX XXX</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
                <span className="text-blue-300 text-sm md:text-base">contact@nexus-reussite.tn</span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="h-3 w-3 md:h-4 md:w-4 text-red-500 mt-1" />
                <span className="text-blue-300 text-sm md:text-base">Centre de Tunis<br />Tunisie</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-6 md:mt-8 pt-6 md:pt-8 text-center">
          <p className="text-blue-300 text-sm md:text-base">
            © 2025 Nexus Réussite. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
