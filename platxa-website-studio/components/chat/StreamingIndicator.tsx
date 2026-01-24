"use client";

import { useState, useEffect } from "react";
import { Bot, Sparkles, Code2, Palette } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StreamingIndicatorProps {
  isStreaming: boolean;
  startTime?: number;
}

const LOADING_MESSAGES = [
  { icon: Sparkles, text: "Analyzing your request...", delay: 0 },
  { icon: Code2, text: "Generating QWeb templates...", delay: 5000 },
  { icon: Palette, text: "Designing styles and layouts...", delay: 15000 },
  { icon: Code2, text: "Creating snippets and components...", delay: 30000 },
  { icon: Sparkles, text: "Finalizing your website...", delay: 60000 },
];

export function StreamingIndicator({ isStreaming, startTime }: StreamingIndicatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time
  useEffect(() => {
    if (!isStreaming || !startTime) {
      setCurrentMessageIndex(0);
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Update message based on elapsed time
      for (let i = LOADING_MESSAGES.length - 1; i >= 0; i--) {
        if (elapsed >= LOADING_MESSAGES[i].delay) {
          setCurrentMessageIndex(i);
          break;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  if (!isStreaming) return null;

  const currentMessage = LOADING_MESSAGES[currentMessageIndex];
  const Icon = currentMessage.icon;
  const seconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;

  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
        <Bot className="w-4 h-4 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted/50 border border-border/50">
          <div className="flex items-center gap-2">
            <Icon className={cn(
              "w-4 h-4 text-primary",
              "animate-pulse"
            )} />
            <span className="text-sm font-medium">{currentMessage.text}</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/60 rounded-full transition-all duration-300 animate-pulse"
                style={{
                  width: `${Math.min((elapsedTime / 90000) * 100, 95)}%`
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Local AI processing...</span>
              <span>
                {minutes > 0 ? `${minutes}m ${displaySeconds}s` : `${displaySeconds}s`}
              </span>
            </div>
          </div>
        </div>

        {/* Tip for long waits */}
        {elapsedTime > 30000 && (
          <p className="text-xs text-muted-foreground px-2 animate-in fade-in duration-500">
            Tip: Local AI models can take 1-3 minutes. For faster responses, use a cloud API.
          </p>
        )}
      </div>
    </div>
  );
}
