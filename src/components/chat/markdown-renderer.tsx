'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-sm list-disc pl-5 mb-2 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[13px] font-mono">
                  {children}
                </code>
              );
            }
            const lang = codeClassName?.replace('language-', '') || '';
            return (
              <div className="relative my-2">
                {lang && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 text-[10px] text-[var(--text-muted)] bg-[var(--surface)] rounded-bl border-b border-l border-[var(--border)]">
                    {lang}
                  </div>
                )}
                <pre className="!bg-[var(--surface)] !border !border-[var(--border)] !rounded-[var(--radius)] overflow-x-auto">
                  <code className={cn('text-[13px] font-mono', codeClassName)} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-sm border-collapse border border-[var(--border)]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--surface)]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--border)] px-3 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--border)] px-3 py-1.5 text-sm">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--primary)] pl-4 my-2 text-sm text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-[var(--border)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
