import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo et Description */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Image
                src="/images/logo.png"
                alt="Nexus Réussite"
                width={40}
                height={40}
                className="h-10"
                style={{ width: 'auto' }}
              />
              <div className="font-bold text-xl">
                <span className="text-blue-300">Nexus</span>
                <span className="text-red-400"> Réussite</span>
              </div>
            </Link>
            <p className="text-blue-300 mb-6 max-w-md">
              La plateforme de <span className="text-blue-300 font-semibold">pédagogie augmentée</span> de référence pour la <span className="text-blue-300 font-semibold">réussite au Baccalauréat</span> et l'<span className="text-blue-300 font-semibold">excellence à Parcoursup</span>.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-blue-300 hover:text-white transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li><Link href="/equipe" className="text-blue-300 hover:text-white transition-colors">Notre Équipe</Link></li>
              <li><Link href="/offres" className="text-blue-300 hover:text-white transition-colors">Offres & Tarifs</Link></li>
              <li><Link href="/notre-centre" className="text-blue-300 hover:text-white transition-colors">Notre Centre</Link></li>
              <li><Link href="/contact" className="text-blue-300 hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-red-500" />
                <span className="text-blue-300">+216 XX XXX XXX</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-red-500" />
                <span className="text-blue-300">contact@nexusreussite.academy</span>
              </li>
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-red-500 mt-1" />
                <span className="text-blue-300">Centre Urbain Nord<br />Immeuble VENUS, Apt. C13<br />1082 – Tunis</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-8 pt-8 text-center">
          <p className="text-blue-300">
            © 2025 Nexus Réussite. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
