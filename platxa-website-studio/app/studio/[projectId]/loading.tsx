import { Loader2, Sparkles } from "lucide-react";

export default function StudioLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-lg font-medium">Loading Studio...</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Preparing your workspace
        </p>
      </div>
    </div>
  );
}
