import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

const coachMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-slate-200 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-50">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-slate-200 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-200 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0">{children}</li>,
  hr: () => <hr className="my-4 border-slate-700/80" />,
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-slate-50 first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-semibold text-slate-50 first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-100 first:mt-0">{children}</h3>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-slate-600 pl-3 text-slate-300">{children}</blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className;
    if (inline) {
      return (
        <code
          className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[0.85em] text-emerald-200/95"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200 last:mb-0">
      {children}
    </pre>
  ),
};

/**
 * Renders AI coach copy that often uses Markdown (**bold**, lists, `---` rules).
 * No raw HTML — `react-markdown` escapes by default.
 */
export function CoachMessageMarkdown(props: Readonly<{ text: string }>) {
  const { text } = props;
  return (
    <ReactMarkdown remarkPlugins={[remarkBreaks]} components={coachMarkdownComponents}>
      {text}
    </ReactMarkdown>
  );
}
