import Image from "next/image";
import Link from "next/link";

// WitUS ecosystem footer for fly.witus.online. Mirrors witus.online's
// footer structure (sibling products, partner attribution, legal links)
// but uses fly-witus's existing light-theme palette (gray-50 surface,
// sky/lime/fuchsia accents) so it sits naturally below the existing
// page chrome instead of clashing.
//
// Sibling product list is duplicated here rather than imported from a
// shared package because each WitUS app is a separate repo. When the
// ecosystem changes, update both this file and gemini/witus's
// lib/products.ts.

interface SiblingProduct {
  name: string;
  href: string;
}

const SIBLING_PRODUCTS: SiblingProduct[] = [
  { name: "WitUS.online", href: "https://witus.online" },
  { name: "CentenarianOS", href: "https://centenarianos.com" },
  { name: "Work.WitUS", href: "https://work.witus.online" },
  { name: "Tour Manager OS", href: "https://tour.witus.online" },
  { name: "Wanderlearn", href: "https://wanderlearn.witus.online" },
  { name: "FlashLearnAI", href: "https://flashlearnai.witus.online" },
  { name: "Learn.WitUS", href: "https://centenarianos.com/academy" },
  { name: "AwesomeWebStore", href: "https://awesomewebstore.com" },
];

const linkClasses =
  "inline-flex items-center min-h-[28px] text-gray-600 hover:text-sky-700 hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/flywitus-platypus-logo.png"
            alt="Fly WitUS"
            width={56}
            height={56}
            className="h-12 w-auto mb-2"
          />
          <p className="font-extrabold text-gray-900">FLY WIT US</p>
          <p className="text-xs text-gray-500">UAS pre-flight + flight log</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="text-gray-900 font-semibold mb-2">Ecosystem</p>
            <ul className="space-y-1">
              {SIBLING_PRODUCTS.map((p) => (
                <li key={p.href}>
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClasses}
                  >
                    {p.name}
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-gray-900 font-semibold mb-2">Fly.WitUS</p>
            <ul className="space-y-1">
              <li>
                <Link href="/" className={linkClasses}>
                  Checklist
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={linkClasses}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className={linkClasses}>
                  Roadmap
                </Link>
              </li>
              <li>
                <Link href="/login" className={linkClasses}>
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-gray-900 font-semibold mb-2">Partners &amp; Legal</p>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.centenarianos.com/safety#rise-wellness"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  Rise Wellness
                  <span className="sr-only"> (wellness partner — opens in new tab)</span>
                </a>
                <p className="text-xs text-gray-400 leading-tight">Wellness partner</p>
              </li>
              <li className="pt-2">
                <a
                  href="https://witus.online/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  href="https://witus.online/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClasses}
                >
                  Privacy
                </a>
              </li>
              <li>
                <a href="mailto:bam@awews.com" className={linkClasses}>
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500 text-center">
          <p>
            © {year} B4C LLC — A{" "}
            <a
              href="https://awesomewebstore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-sky-700 hover:underline"
            >
              AwesomeWebStore.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>{" "}
            brand
          </p>
        </div>
      </div>
    </footer>
  );
}
