'use client';

import { X, FileText, Image, FileCode, FileSpreadsheet, Archive, Check, AlertCircle } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

interface PendingFile {
  file: File;
  progress: number;
  uploaded: boolean;
  fileId?: string;
  error?: string;
}

interface AttachmentPreviewProps {
  files: PendingFile[];
  onRemove: (index: number) => void;
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return <Image className="w-3 h-3 text-emerald-500" />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'swift', 'kt', 'sh', 'bash', 'zsh', 'html', 'css', 'scss', 'less', 'vue', 'svelte'].includes(ext)) {
    return <FileCode className="w-3 h-3 text-blue-500" />;
  }
  if (['csv', 'xlsx', 'xls', 'json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) {
    return <FileSpreadsheet className="w-3 h-3 text-green-600" />;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return <Archive className="w-3 h-3 text-amber-500" />;
  }
  return <FileText className="w-3 h-3 text-[var(--primary)]" />;
}

export function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-2 max-w-3xl mx-auto">
      {files.map((pf, index) => (
        <div
          key={`${pf.file.name}-${index}`}
          className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] text-xs group relative overflow-hidden"
        >
          {/* Progress bar background */}
          {!pf.uploaded && pf.progress > 0 && (
            <div
              className="absolute inset-0 bg-[var(--primary)]/5 transition-all duration-300"
              style={{ width: `${pf.progress}%` }}
            />
          )}

          <div className="flex items-center gap-2 relative z-10">
            {pf.error ? (
              <AlertCircle className="w-3 h-3 text-[var(--error)]" />
            ) : pf.uploaded ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              getFileIcon(pf.file.name)
            )}

            <span className="text-[var(--text-secondary)] max-w-[120px] truncate">
              {pf.file.name}
            </span>

            <span className="text-[var(--text-muted)]">
              {formatFileSize(pf.file.size)}
            </span>

            <button
              onClick={() => onRemove(index)}
              className="text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
