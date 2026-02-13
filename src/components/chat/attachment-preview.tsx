'use client';

import { X, FileText } from 'lucide-react';

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-2">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center gap-2 px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] text-xs group"
        >
          <FileText className="w-3 h-3 text-[var(--primary)]" />
          <span className="text-[var(--text-secondary)] max-w-[150px] truncate">{file.name}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
