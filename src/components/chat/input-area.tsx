'use client';

import { useState, useRef, useCallback, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { Paperclip, Send, Square, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttachmentPreview } from './attachment-preview';
import { useSelfAgent } from '@/hooks/use-self-agent';
import { cn, formatFileSize } from '@/lib/utils';
import type { Attachment } from '@/lib/types';

const UPLOAD_MAX_FILE_SIZE = 50 * 1024 * 1024;   // 50MB
const UPLOAD_MAX_TOTAL_SIZE = 200 * 1024 * 1024;  // 200MB
const UPLOAD_MAX_FILE_COUNT = 10;

interface PendingFile {
  file: File;
  progress: number;    // 0-100
  uploaded: boolean;
  fileId?: string;
  error?: string;
}

export function InputArea() {
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const { sendMessage, abort, isLoading } = useSelfAgent();

  // --- Validation ---

  const validateFiles = useCallback((newFiles: File[]): { valid: File[]; error?: string } => {
    const existing = pendingFiles.map(pf => pf.file);
    const all = [...existing, ...newFiles];

    if (all.length > UPLOAD_MAX_FILE_COUNT) {
      return { valid: [], error: `Maximum ${UPLOAD_MAX_FILE_COUNT} files allowed` };
    }

    const oversized = newFiles.filter(f => f.size > UPLOAD_MAX_FILE_SIZE);
    if (oversized.length > 0) {
      return { valid: [], error: `File "${oversized[0].name}" exceeds ${formatFileSize(UPLOAD_MAX_FILE_SIZE)} limit` };
    }

    const totalSize = all.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > UPLOAD_MAX_TOTAL_SIZE) {
      return { valid: [], error: `Total size exceeds ${formatFileSize(UPLOAD_MAX_TOTAL_SIZE)} limit` };
    }

    return { valid: newFiles };
  }, [pendingFiles]);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    const { valid, error } = validateFiles(files);
    if (error) {
      alert(error);
      return;
    }

    setPendingFiles(prev => [
      ...prev,
      ...valid.map(file => ({ file, progress: 0, uploaded: false })),
    ]);
  }, [validateFiles]);

  // --- Upload ---

  const uploadFiles = useCallback(async (filesToUpload: PendingFile[]): Promise<Attachment[]> => {
    const unuploaded = filesToUpload.filter(pf => !pf.uploaded);
    if (unuploaded.length === 0) {
      return filesToUpload
        .filter(pf => pf.fileId)
        .map(pf => ({ fileId: pf.fileId!, filename: pf.file.name }));
    }

    setIsUploading(true);
    const results: Attachment[] = [];

    // Collect already-uploaded
    for (const pf of filesToUpload) {
      if (pf.uploaded && pf.fileId) {
        results.push({ fileId: pf.fileId, filename: pf.file.name });
      }
    }

    // Upload remaining files via XHR for progress tracking
    const formData = new FormData();
    for (const pf of unuploaded) {
      formData.append('files', pf.file);
    }

    try {
      const uploadResult = await new Promise<{ files: Array<{ fileId: string; filename: string; size: number }> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setPendingFiles(prev => prev.map(pf =>
              pf.uploaded ? pf : { ...pf, progress: percent }
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.error || `Upload failed: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed: network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      // Map results back
      for (const uploaded of uploadResult.files) {
        results.push({ fileId: uploaded.fileId, filename: uploaded.filename });
      }

      // Mark all as uploaded
      setPendingFiles(prev => prev.map((pf) => {
        const uploadedInfo = uploadResult.files.find(f => f.filename === pf.file.name);
        if (uploadedInfo) {
          return { ...pf, progress: 100, uploaded: true, fileId: uploadedInfo.fileId };
        }
        return pf;
      }));

    } catch (err: any) {
      setPendingFiles(prev => prev.map(pf =>
        pf.uploaded ? pf : { ...pf, error: err.message }
      ));
      throw err;
    } finally {
      setIsUploading(false);
    }

    return results;
  }, []);

  // --- Send ---

  const handleSend = useCallback(async () => {
    if ((!text.trim() && pendingFiles.length === 0) || isLoading || isUploading) return;

    try {
      let attachments: Attachment[] | undefined;

      if (pendingFiles.length > 0) {
        attachments = await uploadFiles(pendingFiles);
      }

      if (text.trim() || (attachments && attachments.length > 0)) {
        sendMessage(text.trim() || '(attached files)', attachments);
      }

      setText('');
      setPendingFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      textareaRef.current?.focus();
    } catch (err: any) {
      // Upload failed — don't clear files so user can retry
      console.error('Send failed:', err);
    }
  }, [text, pendingFiles, isLoading, isUploading, sendMessage, uploadFiles]);

  // --- Keyboard ---

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- File Input ---

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // --- Drag & Drop ---

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  };

  // --- Paste ---

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Create a named file for pasted images
          const ext = item.type.split('/')[1] || 'png';
          const namedFile = new File([file], `paste-${Date.now()}.${ext}`, { type: item.type });
          imageFiles.push(namedFile);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  };

  // --- Auto-resize ---

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  // --- Upload progress ---

  const totalProgress = pendingFiles.length > 0
    ? Math.round(pendingFiles.reduce((sum, pf) => sum + pf.progress, 0) / pendingFiles.length)
    : 0;

  return (
    <div
      className="border-t border-[var(--border)] bg-white relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[var(--primary)]/5 border-2 border-dashed border-[var(--primary)] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-[var(--primary)]">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Drop files here</span>
          </div>
        </div>
      )}

      {/* Attachment preview with progress */}
      <AttachmentPreview
        files={pendingFiles}
        onRemove={handleRemoveFile}
      />

      {/* Upload progress bar */}
      {isUploading && (
        <div className="px-4 pb-1">
          <div className="max-w-3xl mx-auto">
            <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Uploading... {totalProgress}%</span>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-3">
        <div
          className={cn(
            'flex items-end gap-2 border border-[var(--border)] rounded-[var(--radius)] px-3 py-2 bg-white',
            'focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]',
            'transition-all duration-150',
            isDragOver && 'border-[var(--primary)] ring-1 ring-[var(--primary)]',
          )}
        >
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleFileSelect}
            disabled={isUploading}
          >
            <Paperclip className="w-4 h-4 text-[var(--text-muted)]" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none outline-none text-sm bg-transparent min-h-[24px] max-h-[200px] py-1"
          />

          {/* Send / Stop button */}
          {isLoading ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={abort}
            >
              <Square className="w-4 h-4 text-[var(--error)]" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="shrink-0 h-8 w-8"
              disabled={(!text.trim() && pendingFiles.length === 0) || isUploading}
              onClick={handleSend}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
