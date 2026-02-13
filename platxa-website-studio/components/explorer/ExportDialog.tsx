"use client";

import { useState, useCallback } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportStatus = "idle" | "exporting" | "success" | "error";

interface ExportProgress {
  current: number;
  total: number;
  currentFile: string;
  compressionPercent: number;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 500;

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [progress, setProgress] = useState<ExportProgress>({
    current: 0,
    total: 0,
    currentFile: "",
    compressionPercent: 0,
  });
  const { projectName, files } = useProjectStore();

  const fileCount = countFiles(files);

  const doExport = useCallback(async () => {
    setStatus("exporting");
    setErrorMessage("");
    setProgress({ current: 0, total: 0, currentFile: "", compressionPercent: 0 });

    try {
      if (fileCount === 0) {
        throw new Error("No files to export. Generate a theme first.");
      }

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Count total files for progress
      const totalFiles = fileCount;
      let currentFileIndex = 0;

      // Add files to ZIP with per-file progress
      const addFilesToZip = (items: typeof files, basePath = "") => {
        for (const item of items) {
          if (item.type === "file" && item.content) {
            const path = basePath ? `${basePath}/${item.name}` : item.path || item.name;
            zip.file(path, item.content);
            currentFileIndex++;
            setProgress((prev) => ({
              ...prev,
              current: currentFileIndex,
              total: totalFiles,
              currentFile: item.name,
            }));
          } else if (item.type === "directory" && item.children) {
            const folderPath = basePath ? `${basePath}/${item.name}` : item.name;
            addFilesToZip(item.children, folderPath);
          }
        }
      };

      addFilesToZip(files);

      // Generate ZIP with compression progress
      const blob = await zip.generateAsync(
        { type: "blob", streamFiles: true },
        (metadata) => {
          setProgress((prev) => ({
            ...prev,
            compressionPercent: Math.round(metadata.percent),
          }));
        }
      );

      // Download
      const safeName = (projectName || "theme").replace(/[^a-zA-Z0-9-_]/g, "_");
      const filename = `${safeName}_${new Date().toISOString().split("T")[0]}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("success");
      setRetryCount(0);

      // Close dialog after success
      setTimeout(() => {
        onOpenChange(false);
        setStatus("idle");
      }, 1500);
    } catch (error) {
      console.error("Export error:", error);
      const msg = error instanceof Error ? error.message : "Export failed";
      setErrorMessage(msg);
      setStatus("error");
    }
  }, [fileCount, files, projectName, onOpenChange]);

  const handleRetry = useCallback(() => {
    const nextRetry = retryCount + 1;
    setRetryCount(nextRetry);

    if (nextRetry >= MAX_RETRIES) {
      // Permanent failure after max retries
      setErrorMessage(`Export failed after ${MAX_RETRIES} attempts. ${errorMessage}`);
      return;
    }

    // Exponential backoff: 500ms, 1000ms, 2000ms
    const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
    setTimeout(() => doExport(), delay);
  }, [retryCount, errorMessage, doExport]);

  const handleExport = useCallback(() => {
    setRetryCount(0);
    doExport();
  }, [doExport]);

  const progressPercent = progress.total > 0
    ? Math.round(((progress.current / progress.total) * 50) + (progress.compressionPercent * 0.5))
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Theme as ZIP</DialogTitle>
          <DialogDescription>
            Download your Odoo theme as a ZIP file ready for installation.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === "idle" && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{projectName || "Theme"}</p>
                <p className="text-sm text-muted-foreground">
                  {fileCount} file{fileCount !== 1 ? "s" : ""} will be exported
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                The ZIP file will contain the complete Odoo module structure
                ready to be installed on your Odoo instance.
              </p>
            </div>
          )}

          {status === "exporting" && (
            <div className="flex flex-col items-center py-6 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />

              {/* Progress bar */}
              <div className="w-full space-y-2">
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {progress.current > 0
                      ? `Adding ${progress.currentFile} (${progress.current}/${progress.total})`
                      : "Preparing..."}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="mt-4 font-medium">Export successful!</p>
              <p className="text-sm text-muted-foreground">
                Your download should start automatically.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="mt-2 font-medium">Export failed</p>
              <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
              {retryCount >= MAX_RETRIES && (
                <p className="text-xs text-destructive">
                  Maximum retry attempts ({MAX_RETRIES}) reached.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {status === "idle" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={fileCount === 0}>
                <Download className="w-4 h-4 mr-2" />
                Export ZIP
              </Button>
            </>
          )}
          {status === "error" && retryCount < MAX_RETRIES && (
            <Button onClick={handleRetry} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry ({retryCount + 1}/{MAX_RETRIES})
            </Button>
          )}
          {status === "error" && (
            <Button variant="outline" onClick={() => { setStatus("idle"); setRetryCount(0); }}>
              Back
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FileNode {
  type: "file" | "directory";
  children?: FileNode[];
}

function countFiles(items: FileNode[]): number {
  let count = 0;
  for (const item of items) {
    if (item.type === "file") {
      count++;
    } else if (item.children) {
      count += countFiles(item.children);
    }
  }
  return count;
}
