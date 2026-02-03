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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFile: (path: string, language: string) => void;
  currentPath?: string;
}

const FILE_TYPES = [
  { value: "xml", label: "XML Template", extension: ".xml" },
  { value: "scss", label: "SCSS Styles", extension: ".scss" },
  { value: "css", label: "CSS Styles", extension: ".css" },
  { value: "python", label: "Python", extension: ".py" },
  { value: "javascript", label: "JavaScript", extension: ".js" },
  { value: "json", label: "JSON", extension: ".json" },
];

export function NewFileDialog({
  open,
  onOpenChange,
  onCreateFile,
  currentPath = "",
}: NewFileDialogProps) {
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("xml");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!fileName.trim()) {
      setError("File name is required");
      return;
    }

    // Validate file name
    if (!/^[a-zA-Z0-9_-]+$/.test(fileName)) {
      setError("File name can only contain letters, numbers, underscores, and hyphens");
      return;
    }

    const selectedType = FILE_TYPES.find((t) => t.value === fileType);
    const extension = selectedType?.extension || ".xml";
    const fullPath = currentPath
      ? `${currentPath}/${fileName}${extension}`
      : `${fileName}${extension}`;

    onCreateFile(fullPath, fileType);
    handleClose();
  };

  const handleClose = () => {
    setFileName("");
    setFileType("xml");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>
            Create a new file in your Odoo theme project.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setError("");
              }}
              placeholder="e.g., homepage"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fileType">File Type</Label>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger>
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} ({type.extension})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button onClick={handleCreate}>Create File</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
