# 08 — 文件传输系统

## 1. 概述

文件传输通过对话进行，支持两个方向：
- **上传**：用户在对话输入区附加文件 → 文件上传到服务器 → Agent 可以读取使用
- **下载**：Agent 通过 `file_transfer` 工具将服务器文件发送给用户 → 用户在对话中点击下载

## 2. 上传流程

### 2.1 用户交互

```
1. 用户点击输入框旁的 📎 按钮，或拖拽文件到输入区域
2. 文件选择后，显示在输入框上方的附件预览区
3. 用户输入消息文本（可选），点击发送
4. 文件通过 HTTP 上传到服务器
5. 上传完成后，消息连同文件引用一起发送给 Agent
```

### 2.2 上传流程详细

```
前端                          服务端
  │                              │
  │  POST /api/upload            │
  │  (multipart/form-data)       │
  ├─────────────────────────────►│
  │                              │  存储文件到 data/uploads/{fileId}/{filename}
  │                              │  记录到 file_transfers 表
  │  { fileId, filename, size }  │
  │◄─────────────────────────────┤
  │                              │
  │  WS: chat.send               │
  │  { content, attachments:     │
  │    [{ fileId, filename }] }  │
  ├─────────────────────────────►│
  │                              │  将文件路径注入消息上下文
  │                              │  Agent 可通过 read 工具读取
  │                              │
```

### 2.3 文件存储

```pseudo
上传目录结构:
data/uploads/
├── {fileId}/
│   └── {originalFilename}      // 保留原始文件名

function handleUpload(file):
    fileId = generateId()
    uploadDir = path.join(DATA_DIR, "uploads", fileId)
    ensureDirectory(uploadDir)

    filePath = path.join(uploadDir, file.originalName)
    moveFile(file.tempPath, filePath)

    db.insertFileTransfer({
        id: fileId,
        filename: file.originalName,
        filePath: filePath,
        fileSize: file.size,
        direction: "upload",
        status: "completed",
        createdAt: now(),
        expiresAt: now() + 24 * 60 * 60 * 1000   // 24 小时后过期
    })

    return { fileId, filename: file.originalName, size: file.size }
```

### 2.4 文件注入 Agent 上下文

当用户消息包含附件时，将文件信息注入到发送给 LLM 的消息中：

```pseudo
function buildAgentMessage(userMessage, attachments):
    contextParts = [userMessage.content]

    for attachment in attachments:
        fileInfo = db.getFileTransfer(attachment.fileId)
        contextParts.push(
            "\n\n[附件] {attachment.filename} " +
            "(路径: {fileInfo.filePath}, 大小: {formatSize(fileInfo.fileSize)})"
        )

    return contextParts.join("")
```

Agent 可以通过 `read` 工具读取文件路径来访问文件内容。

## 3. 下载流程

### 3.1 Agent 端触发

```pseudo
// Agent 使用 file_transfer 工具
// 例：用户说 "把生成的报告发给我"
// Agent 调用: file_transfer({ path: "/home/user/report.pdf" })

function executeFileTransfer(params):
    sourcePath = params.path
    filename = params.filename || path.basename(sourcePath)

    // 验证文件存在
    if not fileExists(sourcePath):
        return { error: "文件不存在: " + sourcePath }

    // 复制到下载目录
    fileId = generateId()
    downloadDir = path.join(DATA_DIR, "downloads", fileId)
    ensureDirectory(downloadDir)
    copyFile(sourcePath, path.join(downloadDir, filename))

    fileSize = getFileSize(sourcePath)

    // 记录
    db.insertFileTransfer({
        id: fileId,
        conversationId: currentConversationId,
        filename: filename,
        filePath: path.join(downloadDir, filename),
        fileSize: fileSize,
        direction: "download",
        status: "pending",
        createdAt: now(),
        expiresAt: now() + 24 * 60 * 60 * 1000
    })

    // 通知前端
    wsEmit("chat.file_ready", {
        conversationId: currentConversationId,
        messageId: currentMessageId,
        fileId: fileId,
        filename: filename,
        size: fileSize,
        downloadUrl: "/api/download/" + fileId
    })

    return {
        result: "文件 '{filename}' ({formatSize(fileSize)}) 已准备好供用户下载。",
        uiData: { fileId, filename, size: fileSize }
    }
```

### 3.2 前端下载

```pseudo
// 下载 API
GET /api/download/:fileId

function handleDownload(fileId):
    record = db.getFileTransfer(fileId)

    if not record:
        return 404, "文件不存在"

    if record.status == "expired":
        return 410, "文件已过期"

    if not fileExists(record.filePath):
        return 404, "文件已被删除"

    // 更新状态
    db.updateFileTransferStatus(fileId, "completed")

    // 返回文件流
    return sendFile(record.filePath, {
        headers: {
            "Content-Disposition": "attachment; filename=\"{record.filename}\"",
            "Content-Type": getMimeType(record.filename),
            "Content-Length": record.fileSize
        }
    })
```

### 3.3 前端展示

文件在对话消息中显示为可点击的卡片：

```
┌─────────────────────────────────┐
│  📄 report.pdf                  │
│  256 KB  •  点击下载             │
│  ━━━━━━━━━━━━━━━━ (进度条，如需) │
└─────────────────────────────────┘
```

不同文件类型显示不同图标：
- 📄 文档（.pdf, .doc, .txt）
- 📊 数据（.csv, .xlsx, .json）
- 🖼️ 图片（.png, .jpg, .svg）— 可内联预览
- 📦 压缩包（.zip, .tar.gz）
- 📝 代码（.js, .py, .ts）— 可展开预览代码
- 📁 其他

## 4. 上传限制

```pseudo
UPLOAD_LIMITS = {
    maxFileSize: 50 * 1024 * 1024,    // 单个文件最大 50MB
    maxTotalSize: 200 * 1024 * 1024,  // 单次上传总大小最大 200MB
    maxFileCount: 10,                  // 单次最多 10 个文件
    allowedTypes: "*",                 // 不限制文件类型
}
```

超出限制时前端直接拦截并显示提示。

## 5. 文件清理

```pseudo
// 清理过期文件（每小时运行）
function cleanupExpiredFiles():
    expired = db.getFileTransfers(status: "pending", olderThan: 24h)
    for record in expired:
        // 删除文件
        deleteDirectory(path.dirname(record.filePath))
        // 更新状态
        db.updateFileTransferStatus(record.id, "expired")

    // 清理已完成且超过 7 天的下载文件
    oldCompleted = db.getFileTransfers(status: "completed", olderThan: 7d)
    for record in oldCompleted:
        deleteDirectory(path.dirname(record.filePath))
        db.deleteFileTransfer(record.id)
```

## 6. 拖拽上传支持

```pseudo
// 前端拖拽处理
InputArea.onDragOver(event):
    event.preventDefault()
    showDropZone()    // 显示拖拽目标区域高亮

InputArea.onDragLeave():
    hideDropZone()

InputArea.onDrop(event):
    event.preventDefault()
    hideDropZone()
    files = event.dataTransfer.files
    validateAndAddAttachments(files)
```

## 7. 图片粘贴支持

```pseudo
// 支持从剪贴板粘贴图片
InputArea.onPaste(event):
    items = event.clipboardData.items
    for item in items:
        if item.type.startsWith("image/"):
            file = item.getAsFile()
            filename = "paste-{timestamp}.png"
            addAttachment(file, filename)
```
