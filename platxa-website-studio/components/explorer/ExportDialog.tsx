"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { projectName, files } = useProjectStore();

  const handleExport = async () => {
    setStatus("exporting");
    setErrorMessage("");

    try {
      // For now, create ZIP client-side using the files from store
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add files to ZIP
      const addFilesToZip = (items: typeof files, basePath = "") => {
        for (const item of items) {
          if (item.type === "file" && item.content) {
            const path = basePath ? `${basePath}/${item.name}` : item.path || item.name;
            zip.file(path, item.content);
          } else if (item.type === "directory" && item.children) {
            const folderPath = basePath ? `${basePath}/${item.name}` : item.name;
            addFilesToZip(item.children, folderPath);
          }
        }
      };

      addFilesToZip(files);

      // Generate ZIP
      const blob = await zip.generateAsync({ type: "blob" });

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

      // Close dialog after success
      setTimeout(() => {
        onOpenChange(false);
        setStatus("idle");
      }, 1500);
    } catch (error) {
      console.error("Export error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Export failed");
      setStatus("error");
    }
  };

  const fileCount = countFiles(files);

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
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Creating ZIP file...
              </p>
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
            <div className="flex flex-col items-center py-8">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="mt-4 font-medium">Export failed</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
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
          {status === "error" && (
            <Button variant="outline" onClick={() => setStatus("idle")}>
              Try Again
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
