"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFolder: (path: string) => void;
  currentPath?: string;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  onCreateFolder,
  currentPath = "",
}: NewFolderDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!folderName.trim()) {
      setError("Folder name is required");
      return;
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
      setError("Folder name can only contain letters, numbers, underscores, and hyphens");
      return;
    }

    const fullPath = currentPath
      ? `${currentPath}/${folderName}`
      : folderName;

    onCreateFolder(fullPath);
    handleClose();
  };

  const handleClose = () => {
    setFolderName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your theme files.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError("");
              }}
              placeholder="e.g., views, static, data"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          {currentPath && (
            <p className="text-sm text-muted-foreground">
              Will be created in: <code className="text-xs bg-muted px-1 rounded">{currentPath}/</code>
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create Folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
