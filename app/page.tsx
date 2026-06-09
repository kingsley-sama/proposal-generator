import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'ExposéProfi – Angebotsgenerator',
  description:
    'Professionelle Angebote für 3D-Visualisierungen in Minuten – automatisch berechnet, sauber als Word-Dokument exportiert.',
};

const features = [
  {
    title: 'Automatische Preisberechnung',
    desc: 'Mengenstaffeln, Gebäudetypen und 19 % MwSt werden automatisch berechnet – ohne Tabellen-Chaos.',
    icon: (
      <path d="M3 3v18h18M7 14l4-4 3 3 5-5" />
    ),
  },
  {
    title: '21 Leistungstypen',
    desc: 'Von Innen- und Außenvisualisierung bis Grundriss und Video – alle Leistungen vordefiniert und sofort wählbar.',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  },
  {
    title: 'Word-Export mit einem Klick',
    desc: 'Jedes Angebot wird sauber formatiert als .docx erzeugt – direkt versandfertig im ExposéProfi-Layout.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13l1.5 4 1.5-3 1.5 3L15 13" />
      </>
    ),
  },
  {
    title: 'Kundendaten aus Supabase',
    desc: 'Kundennummer eingeben, Stammdaten ziehen, Angebotsnummer automatisch hochzählen – alles verbunden.',
    icon: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </>
    ),
  },
];

const steps = [
  {
    n: '01',
    title: 'Kundendaten eingeben',
    desc: 'Kundennummer eingeben oder Stammdaten erfassen. Die Angebotsnummer wird automatisch vergeben.',
  },
  {
    n: '02',
    title: 'Leistungen auswählen',
    desc: 'Leistungen anklicken, Mengen festlegen, Preise bei Bedarf anpassen. Summen und MwSt rechnen sich live.',
  },
  {
    n: '03',
    title: 'Angebot generieren',
    desc: 'Vorschau prüfen und das fertige Angebot als formatiertes Word-Dokument exportieren.',
  },
];

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-white text-[#16181D]"
      style={{ fontFamily: 'var(--font-manrope)' }}
    >
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo_2.png" alt="ExposéProfi" width={150} height={23} className="h-6 w-auto" priority />
          </Link>
          <div className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#features" className="hover:text-[#16181D] transition-colors">Funktionen</a>
            <a href="#ablauf" className="hover:text-[#16181D] transition-colors">Ablauf</a>
          </div>
          <Link
            href="/sign-in"
            className="rounded-full bg-[#AF2C32] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#962228]"
          >
            Anmelden
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[#AF2C32]" />
          — ExposéProfi
        </div>
        <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-[#00214D] sm:text-6xl">
          Professionelle Angebote.
          <br />
          <span className="text-[#00214D]">In Minuten erstellt.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-500">
          Erstellen Sie maßgeschneiderte Angebote für 3D-Visualisierungen –
          automatisch berechnet und sauber als Word-Dokument exportiert.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="group inline-flex items-center gap-2 rounded-full bg-[#00214D] px-7 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#01183a]"
          >
            Jetzt anmelden
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#features"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-7 py-3.5 text-[15px] font-semibold text-[#16181D] transition-colors hover:bg-gray-50"
          >
            Mehr erfahren
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Alles für schnelle Angebote
            </h2>
            <p className="mt-4 text-gray-500">
              Was das Team braucht, um Angebote zu erstellen – an einem Ort.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#AF2C32]/10 text-[#AF2C32]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="ablauf" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">So funktioniert&apos;s</h2>
            <p className="mt-4 text-gray-500">Drei Schritte zum fertigen Angebot.</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="text-4xl font-bold text-[#00214D]/15">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <Image src="/logo_2.png" alt="ExposéProfi" width={130} height={20} className="h-5 w-auto" />
          <p className="text-sm text-gray-400">© 2026 ExposéProfi. Nur für interne Nutzung.</p>
        </div>
      </footer>
    </div>
  );
}
