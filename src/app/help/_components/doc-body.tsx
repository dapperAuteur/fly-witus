import type { HelpBlock } from "@/content/help/docs";

// Renders a help doc's structured blocks. Kept dependency-free (no
// markdown parser) — the content is authored as typed blocks.
export function DocBody({ body }: { body: HelpBlock[] }) {
  return (
    <div className="space-y-4">
      {body.map((block, i) => {
        switch (block.kind) {
          case "heading":
            return (
              <h2 key={i} className="text-lg font-bold mt-6">
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="text-sm leading-relaxed text-card-foreground">
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1 text-sm text-card-foreground">
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1 text-sm text-card-foreground">
                {block.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ol>
            );
        }
      })}
    </div>
  );
}
