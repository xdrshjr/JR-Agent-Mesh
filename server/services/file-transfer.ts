import { existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { FileTransferRepository } from '../db/repositories/index.js';
import { broadcastToAllClients } from '../websocket/server.js';
import { logger } from '../utils/logger.js';
import type { ChatFileReadyPayload } from '../../shared/types.js';

export class FileTransferService {
  private fileTransferRepo: FileTransferRepository;
  private downloadDir: string;
  private uploadDir: string;

  constructor(private dataDir: string) {
    this.fileTransferRepo = new FileTransferRepository();
    this.downloadDir = join(dataDir, 'downloads');
    this.uploadDir = join(dataDir, 'uploads');
    mkdirSync(this.downloadDir, { recursive: true });
    mkdirSync(this.uploadDir, { recursive: true });
    logger.info('FileTransferService', 'Initialized');
  }

  /**
   * Prepare a file for download by the user.
   * Called by the self-agent's file_transfer tool.
   */
  prepareDownload(options: {
    sourcePath: string;
    filename?: string;
    conversationId?: string;
    messageId?: string;
  }): { fileId: string; filename: string; size: number; downloadUrl: string } | { error: string } {
    const { sourcePath, conversationId, messageId } = options;

    if (!existsSync(sourcePath)) {
      return { error: `File not found: ${sourcePath}` };
    }

    const stat = statSync(sourcePath);
    if (stat.isDirectory()) {
      return { error: `Path is a directory: ${sourcePath}` };
    }

    const filename = options.filename || basename(sourcePath);
    const fileId = uuidv4();
    const fileDir = join(this.downloadDir, fileId);
    mkdirSync(fileDir, { recursive: true });

    const destPath = join(fileDir, filename);
    copyFileSync(sourcePath, destPath);

    // Record in database
    this.fileTransferRepo.create({
      id: fileId,
      conversationId,
      filename,
      filePath: destPath,
      fileSize: stat.size,
      direction: 'download',
      status: 'pending',
    });

    const downloadUrl = `/api/download/${fileId}`;

    // Notify frontend via WebSocket
    if (conversationId && messageId) {
      broadcastToAllClients('chat.file_ready', {
        conversationId,
        messageId,
        fileId,
        filename,
        size: stat.size,
        downloadUrl,
      } satisfies ChatFileReadyPayload);
    }

    logger.info('FileTransfer', `Prepared download: ${filename} (${stat.size} bytes) → ${fileId}`);

    return { fileId, filename, size: stat.size, downloadUrl };
  }

  /**
   * Get file info for an uploaded file by its ID.
   */
  getUploadInfo(fileId: string) {
    return this.fileTransferRepo.getById(fileId);
  }

}

