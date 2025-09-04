export default function Footer() {
  return (
    <footer className="border-t mt-12 py-8 text-sm text-slate-600">
      <div className="container mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="underline" href="/confidentialite">Politique de confidentialité</a>
          <a className="underline" href="/cgu">CGU</a>
          <a className="underline" href="/cgv">CGV</a>
          <a className="underline" href="/mentions-legales">Mentions légales</a>
          <a className="underline" href="/a-propos">À propos</a>
        </nav>
        <div className="text-right">
          <div>Contact: <a className="underline" href="tel:+21699192829">(+216) 99 19 28 29</a></div>
          <div>© {new Date().getFullYear()} Nexus Réussite</div>
        </div>
      </div>
    </footer>
  );
}
