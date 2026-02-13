'use client';

import { useMemo } from 'react';
import AnsiToHtml from 'ansi-to-html';

const converter = new AnsiToHtml({
  fg: '#111827',
  bg: 'transparent',
  newline: true,
  escapeXML: true,
});

interface AnsiRendererProps {
  text: string;
}

export function AnsiRenderer({ text }: AnsiRendererProps) {
  const html = useMemo(() => converter.toHtml(text), [text]);

  return (
    <span
      className="font-mono text-[13px] leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
