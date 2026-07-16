import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { LegalDoc } from "@/lib/legal";

// react-markdown passes a `node` prop we don't want on DOM elements.
type MDProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & { node?: unknown };

const components = {
  h2: ({ node, ...p }: MDProps<"h2">) => (
    <h2 className="mt-10 mb-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100" {...p} />
  ),
  h3: ({ node, ...p }: MDProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100" {...p} />
  ),
  p: ({ node, ...p }: MDProps<"p">) => (
    <p className="mb-4 text-[15px] leading-7 text-zinc-600 dark:text-zinc-300" {...p} />
  ),
  ul: ({ node, ...p }: MDProps<"ul">) => (
    <ul className="mb-4 ml-5 list-disc space-y-1.5 text-[15px] leading-7 text-zinc-600 marker:text-zinc-400 dark:text-zinc-300" {...p} />
  ),
  ol: ({ node, ...p }: MDProps<"ol">) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1.5 text-[15px] leading-7 text-zinc-600 marker:text-zinc-400 dark:text-zinc-300" {...p} />
  ),
  li: ({ node, ...p }: MDProps<"li">) => <li className="pl-1" {...p} />,
  strong: ({ node, ...p }: MDProps<"strong">) => (
    <strong className="font-semibold text-zinc-900 dark:text-zinc-100" {...p} />
  ),
  a: ({ node, href, ...p }: MDProps<"a">) => {
    const external = !!href && /^https?:/i.test(href);
    return (
      <a
        href={href}
        className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        {...p}
      />
    );
  },
};

export function LegalArticle({ title, lastUpdated, body }: LegalDoc) {
  return (
    <main className="mx-auto max-w-[820px] px-6 py-16 lg:py-20">
      <div className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">Legal</p>
        <h1 className="text-[34px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        {lastUpdated && <p className="mt-2 text-sm text-zinc-500">Last updated: {lastUpdated}</p>}
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </main>
  );
}
