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
  "inline-flex items-center min-h-[28px] text-muted-foreground hover:text-sky-700 hover:underline transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-card text-card-foreground border-t border-border mt-12">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-col items-center text-center mb-8">
          <Image
            src="/flywitus-platypus-logo.png"
            alt="Fly WitUS"
            width={56}
            height={56}
            className="h-12 w-auto mb-2"
          />
          <p className="font-extrabold text-card-foreground">FLY WIT US</p>
          <p className="text-xs text-muted-foreground">UAS pre-flight + flight log</p>
        </div>

        <RiseWellnessCallout />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="text-card-foreground font-semibold mb-2">Ecosystem</p>
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
            <p className="text-card-foreground font-semibold mb-2">Fly.WitUS</p>
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
            <p className="text-card-foreground font-semibold mb-2">Partners &amp; Legal</p>
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
                <p className="text-xs text-muted-foreground leading-tight">Wellness partner</p>
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

        <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          <p>
            © {year} B4C LLC — A{" "}
            <a
              href="https://awesomewebstore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-sky-700 hover:underline"
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

/**
 * Mental health support callout — mirrors the Rise Wellness section at
 * https://www.centenarianos.com/safety#rise-wellness so the same partner
 * surface appears across the WitUS ecosystem. Independent provider; the
 * non-affiliation disclaimer is mandatory and stays verbatim.
 *
 * Placed above the three-column grid (rather than buried inside Partners
 * & Legal) because mental-health resources warrant prominence per the
 * pattern centenarianos uses on its dedicated /safety page.
 */
function RiseWellnessCallout() {
  return (
    <section
      aria-labelledby="rise-wellness-heading"
      className="mb-8 rounded-lg border border-sky-100 dark:border-sky-900 bg-sky-50/60 dark:bg-sky-950/30 p-5 text-sm"
    >
      <header className="mb-3">
        <p className="text-[11px] uppercase tracking-wide text-sky-700 font-semibold">
          Mental health support
        </p>
        <h2
          id="rise-wellness-heading"
          className="text-base font-semibold text-card-foreground"
        >
          Rise Wellness of Indiana
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Independent mental health provider · Not affiliated with Fly.WitUS
        </p>
      </header>

      <p className="text-muted-foreground leading-relaxed">
        Rise Wellness of Indiana provides compassionate, personalized,
        holistic mental health care — evidence-based medicine, trauma-informed
        care, and a whole-person approach to help you heal, grow, and thrive
        in mind, body, and spirit.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Services
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>ADHD testing &amp; management (in-person and from home)</li>
            <li>Anxiety &amp; depression</li>
            <li>Maternal mental health</li>
            <li>Medication management</li>
            <li>GeneSight® genetic testing</li>
            <li>Behavioral therapy &amp; coaching</li>
            <li>Routine lab testing</li>
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            Visit or call
          </p>
          <address className="not-italic text-xs text-muted-foreground leading-relaxed">
            320 North Meridian Street
            <br />
            Indianapolis, IN 46204
            <br />
            Mon–Sat by appointment · Sun closed
          </address>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs">
            <a
              href="tel:+13179650299"
              className="inline-flex items-center min-h-[28px] font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              317-965-0299
            </a>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <a
              href="https://risewellnessofindiana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[28px] font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              risewellnessofindiana.com
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <a
              href="https://www.centenarianos.com/safety#rise-wellness"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-[28px] font-medium text-sky-700 hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded"
            >
              Full safety page
              <span className="sr-only"> on centenarianos.com (opens in new tab)</span>
            </a>
          </div>
        </div>
      </div>

      <blockquote className="mt-4 border-l-2 border-sky-300 pl-3 text-xs italic text-muted-foreground">
        &ldquo;At Rise Wellness, we believe everyone has the capacity to rise
        above challenges and live a fulfilling, healthy life. Our care is
        guided by the belief that healing is personal, holistic, and rooted
        in compassion.&rdquo;
        <span className="block not-italic mt-1 text-muted-foreground">
          — Rise Wellness of Indiana
        </span>
      </blockquote>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Rise Wellness of Indiana is an independent organization. They are
        not affiliated with, employed by, or endorsed by Fly.WitUS,
        CentenarianOS, B4C LLC, AwesomeWebStore.com, or Anthony McDonald.
        We are grateful for their collaboration on mental health safety
        resources for our community.
      </p>
    </section>
  );
}
