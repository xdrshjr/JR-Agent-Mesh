'use client';

import { FileText, Download } from 'lucide-react';
import type { Attachment } from '@/lib/types';

interface FileAttachmentProps {
  attachment: Attachment;
  downloadUrl?: string;
}

export function FileAttachment({ attachment, downloadUrl }: FileAttachmentProps) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] hover:bg-[var(--border)]/30 transition-colors group">
      <FileText className="w-4 h-4 text-[var(--primary)] shrink-0" />
      <span className="text-xs font-medium text-[var(--foreground)] truncate max-w-[200px]">
        {attachment.filename}
      </span>
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={attachment.filename}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-3.5 h-3.5 text-[var(--text-secondary)] hover:text-[var(--primary)]" />
        </a>
      )}
    </div>
  );
}
