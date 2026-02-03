/**
 * WebSocket File Writer
 *
 * Real-time file write channel that routes AI-generated output through
 * the editor-sync WebSocket using Yjs doc.transact(). This ensures
 * writes propagate to all connected clients in real-time via CRDT sync.
 *
 * Uses the existing /ws/doc/{path} endpoint in platxa-editor-sync.
 */

import { Y, type YDoc } from "@/lib/yjs-singleton";
import type { WriteResult, FileWriteStatus } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface WsFileWriterOptions {
  /** Editor-sync WebSocket base URL (e.g. ws://localhost:8765) */
  wsBaseUrl: string;
  /** Auth token sent via Sec-WebSocket-Protocol header */
  authToken?: string;
  /** Connection timeout in ms (default: 5000) */
  connectTimeoutMs?: number;
  /** Per-file write timeout in ms (default: 10000) */
  writeTimeoutMs?: number;
}

interface WsWriteConnection {
  ws: WebSocket;
  doc: YDoc;
  ready: Promise<void>;
}

// =============================================================================
// Connection Management
// =============================================================================

/**
 * Opens a WebSocket connection to the editor-sync /ws/doc/{path} endpoint
 * and initializes a local Y.Doc that syncs with the server.
 */
function openDocConnection(
  wsBaseUrl: string,
  filePath: string,
  authToken?: string,
  connectTimeoutMs = 5000,
): WsWriteConnection {
  const doc = new Y.Doc();
  const url = `${wsBaseUrl}/ws/doc/${encodeURIComponent(filePath)}`;

  const protocols = authToken ? [authToken] : undefined;
  const ws = new WebSocket(url, protocols);
  ws.binaryType = "arraybuffer";

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection timeout for ${filePath}`));
    }, connectTimeoutMs);

    ws.addEventListener("open", () => {
      clearTimeout(timeout);
    });

    // First message from server is the initial Y.Doc state
    ws.addEventListener(
      "message",
      (event) => {
        clearTimeout(timeout);
        const data = event.data instanceof ArrayBuffer
          ? new Uint8Array(event.data)
          : new Uint8Array(0);
        if (data.length > 0) {
          Y.applyUpdate(doc, data);
        }
        resolve();
      },
      { once: true },
    );

    ws.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error for ${filePath}`));
    });

    ws.addEventListener("close", () => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket closed before ready for ${filePath}`));
    });
  });

  return { ws, doc, ready };
}

// =============================================================================
// Single File Write
// =============================================================================

/**
 * Writes content to a file through the Yjs WebSocket channel.
 * Uses doc.transact() to atomically replace the document content,
 * which propagates to all connected clients.
 */
async function writeFileViaWs(
  wsBaseUrl: string,
  file: { path: string; content: string },
  authToken?: string,
  connectTimeoutMs?: number,
  writeTimeoutMs = 10000,
): Promise<FileWriteStatus> {
  let conn: WsWriteConnection | null = null;

  try {
    conn = openDocConnection(wsBaseUrl, file.path, authToken, connectTimeoutMs);
    await conn.ready;

    const { doc, ws } = conn;
    const text = doc.getText("content");

    // Atomic content replacement via doc.transact()
    doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, file.content);
    });

    // Send the update to the server
    const update = Y.encodeStateAsUpdate(doc);
    ws.send(update);

    // Wait for the update to be acknowledged (next message from server)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Write timeout for ${file.path}`));
      }, writeTimeoutMs);

      ws.addEventListener(
        "message",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );

      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error(`Write error for ${file.path}`));
      });
    });

    return { path: file.path, success: true };
  } catch (error) {
    return {
      path: file.path,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (conn) {
      conn.doc.destroy();
      if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
        conn.ws.close();
      }
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Writes files through the editor-sync WebSocket using Yjs doc.transact().
 * Each file write opens a connection to /ws/doc/{path}, atomically replaces
 * the content, and propagates to all connected clients in real-time.
 *
 * Falls back gracefully when the WebSocket endpoint is unavailable.
 */
export async function writeThroughWebSocket(
  files: Array<{ path: string; content: string }>,
  options: WsFileWriterOptions,
): Promise<WriteResult> {
  const { wsBaseUrl, authToken, connectTimeoutMs, writeTimeoutMs } = options;

  if (!wsBaseUrl || files.length === 0) {
    return {
      success: files.length === 0,
      filesWritten: [],
      totalFiles: files.length,
      failedFiles: 0,
      usedSidecar: false,
    };
  }

  // Write all files in parallel
  const results = await Promise.all(
    files.map((f) =>
      writeFileViaWs(wsBaseUrl, f, authToken, connectTimeoutMs, writeTimeoutMs),
    ),
  );

  const failedFiles = results.filter((r) => !r.success).length;

  return {
    success: failedFiles === 0,
    filesWritten: results,
    totalFiles: files.length,
    failedFiles,
    usedSidecar: true, // Used real-time channel
  };
}
