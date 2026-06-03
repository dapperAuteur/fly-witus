"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HELP_CATEGORIES, HELP_DOCS, type HelpDoc } from "@/content/help/docs";
import { searchHelpDocs } from "@/lib/help-search";

// Help centre: fuzzy-searchable index of the self-serve docs. With no
// query, docs are grouped by category; while searching, they're ranked by
// relevance. Search is client-side over the static doc set.
export default function HelpIndexPage() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchHelpDocs(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Help</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search the docs, or browse by topic. Still stuck? Use the help bubble
          (bottom-right) to send a question or bug report.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help… (e.g. change email, invite code, export)"
        aria-label="Search help docs"
        className="w-full px-4 py-2.5 border border-border rounded-lg text-sm"
      />

      {searching ? (
        <section className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No matches. Try different words, or send us a question via the help
              bubble.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map(({ doc }) => (
                <DocCard key={doc.slug} doc={doc} />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {HELP_CATEGORIES.map((category) => {
            const docs = HELP_DOCS.filter((d) => d.category === category);
            if (docs.length === 0) return null;
            return (
              <section key={category}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {category}
                </h2>
                <ul className="space-y-2">
                  {docs.map((doc) => (
                    <DocCard key={doc.slug} doc={doc} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function DocCard({ doc }: { doc: HelpDoc }) {
  return (
    <li>
      <Link
        href={`/help/${doc.slug}`}
        className="block bg-card text-card-foreground border border-border rounded-lg p-4 hover:border-sky-300 hover:shadow-sm transition"
      >
        <div className="font-semibold">{doc.title}</div>
        <p className="text-sm text-muted-foreground mt-1">{doc.summary}</p>
      </Link>
    </li>
  );
}
