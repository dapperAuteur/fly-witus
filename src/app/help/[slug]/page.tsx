import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_DOCS, getHelpDoc } from "@/content/help/docs";
import { DocBody } from "../_components/doc-body";

// One help article per slug. Statically generated from the doc set.
export function generateStaticParams() {
  return HELP_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getHelpDoc(slug);
  if (!doc) return { title: "Help — Fly WitUS" };
  return { title: `${doc.title} — Help — Fly WitUS`, description: doc.summary };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getHelpDoc(slug);
  if (!doc) notFound();

  return (
    <main className="max-w-3xl mx-auto p-6">
      <Link href="/help" className="text-sm text-sky-700 hover:underline">
        ← All help
      </Link>

      <article className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {doc.category}
        </p>
        <h1 className="text-2xl font-bold mt-1">{doc.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">{doc.summary}</p>

        <div className="mt-6">
          <DocBody body={doc.body} />
        </div>
      </article>

      <div className="mt-10 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          Didn&apos;t find what you needed? Open the help bubble (bottom-right) to
          send a question or bug report — you don&apos;t need to be signed in.
        </p>
      </div>
    </main>
  );
}
