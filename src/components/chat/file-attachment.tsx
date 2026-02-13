'use client';

import { useState } from 'react';
import { FileText, Download, Image, FileCode, FileSpreadsheet, Archive, File, ChevronDown, ChevronUp } from 'lucide-react';
import type { Attachment } from '@/lib/types';
import { formatFileSize } from '@/lib/utils';

interface FileAttachmentProps {
  attachment: Attachment;
  downloadUrl?: string;
  size?: number;
}

function getFileCategory(filename: string): 'image' | 'code' | 'data' | 'document' | 'archive' | 'other' {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'swift', 'kt', 'sh', 'bash', 'zsh', 'html', 'css', 'scss', 'less', 'vue', 'svelte', 'sql', 'md', 'txt', 'log'].includes(ext)) return 'code';
  if (['csv', 'xlsx', 'xls', 'json', 'xml', 'yaml', 'yml', 'toml'].includes(ext)) return 'data';
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext)) return 'archive';
  return 'other';
}

function getFileIcon(filename: string) {
  const category = getFileCategory(filename);

  switch (category) {
    case 'image':
      return <Image className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'code':
      return <FileCode className="w-4 h-4 text-blue-500 shrink-0" />;
    case 'data':
      return <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />;
    case 'document':
      return <FileText className="w-4 h-4 text-orange-500 shrink-0" />;
    case 'archive':
      return <Archive className="w-4 h-4 text-amber-500 shrink-0" />;
    default:
      return <File className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />;
  }
}

export function FileAttachment({ attachment, downloadUrl, size }: FileAttachmentProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  const category = getFileCategory(attachment.filename);
  const isImage = category === 'image';
  const isCode = category === 'code';
  const url = downloadUrl || `/api/download/${attachment.fileId}`;

  const handleCodePreview = async () => {
    if (previewOpen) {
      setPreviewOpen(false);
      return;
    }

    if (codeContent !== null) {
      setPreviewOpen(true);
      return;
    }

    setCodeLoading(true);
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const text = await resp.text();
        // Limit preview to 200 lines / 10KB
        const limited = text.length > 10240 ? text.slice(0, 10240) + '\n...(truncated)' : text;
        const lines = limited.split('\n');
        setCodeContent(lines.length > 200 ? lines.slice(0, 200).join('\n') + '\n...(truncated)' : limited);
      } else {
        setCodeContent('Failed to load preview');
      }
    } catch {
      setCodeContent('Failed to load preview');
    } finally {
      setCodeLoading(false);
      setPreviewOpen(true);
    }
  };

  return (
    <div className="max-w-sm">
      <div className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--surface)] hover:bg-[var(--border)]/30 transition-colors group">
        {getFileIcon(attachment.filename)}

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-[var(--foreground)] truncate max-w-[200px]">
            {attachment.filename}
          </span>
          {size != null && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {formatFileSize(size)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-1">
          {/* Code preview toggle */}
          {isCode && (
            <button
              onClick={handleCodePreview}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-0.5"
              title={previewOpen ? 'Close preview' : 'Preview code'}
            >
              {previewOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Download button */}
          <a
            href={url}
            download={attachment.filename}
            className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-0.5"
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Image inline preview */}
      {isImage && (
        <div className="mt-1">
          <img
            src={url}
            alt={attachment.filename}
            className="max-w-full max-h-[300px] rounded-[var(--radius)] border border-[var(--border)] object-contain bg-[var(--surface)]"
            loading="lazy"
          />
        </div>
      )}

      {/* Code preview */}
      {isCode && previewOpen && (
        <div className="mt-1 border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
          {codeLoading ? (
            <div className="p-3 text-xs text-[var(--text-muted)]">Loading preview...</div>
          ) : (
            <pre className="p-3 text-xs bg-[#f8f9fa] overflow-x-auto max-h-[300px] overflow-y-auto">
              <code>{codeContent}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
