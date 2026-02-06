"use client";

import { useState, useEffect } from "react";
import { Bot, Sparkles, Code2, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import {
  springSnappy,
  springSmooth,
  prefersReducedMotion,
} from "@/lib/animations";

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
  const reducedMotion = prefersReducedMotion();

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

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reducedMotion ? { duration: 0.01 } : springSmooth,
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.98,
      transition: reducedMotion ? { duration: 0.01 } : { duration: 0.2 },
    },
  };

  const messageVariants = {
    initial: { opacity: 0, x: -10 },
    animate: {
      opacity: 1,
      x: 0,
      transition: reducedMotion ? { duration: 0.01 } : springSnappy,
    },
    exit: {
      opacity: 0,
      x: 10,
      transition: reducedMotion ? { duration: 0.01 } : { duration: 0.15 },
    },
  };

  const dotVariants = {
    animate: (i: number) => ({
      y: [0, -6, 0],
      transition: reducedMotion
        ? { duration: 0.01 }
        : {
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          },
    }),
  };

  const pulseVariants = {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.7, 1, 0.7],
      transition: reducedMotion
        ? { duration: 0.01 }
        : {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex gap-3"
    >
      {/* Avatar with pulse */}
      <motion.div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 relative"
        variants={pulseVariants}
        animate="animate"
      >
        <Bot className="w-4 h-4 text-primary" />
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={
            reducedMotion
              ? {}
              : {
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      </motion.div>

      {/* Content */}
      <div className="flex-1 space-y-2">
        <motion.div
          className="px-4 py-3 rounded-2xl rounded-bl-md bg-muted/50 border border-border/50"
          layout={!reducedMotion}
        >
          <div className="flex items-center gap-2">
            {/* Animated Icon */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                animate={{
                  opacity: 1,
                  rotate: 0,
                  scale: 1,
                  transition: reducedMotion ? { duration: 0.01 } : springSnappy,
                }}
                exit={{
                  opacity: 0,
                  rotate: 90,
                  scale: 0.5,
                  transition: reducedMotion ? { duration: 0.01 } : { duration: 0.15 },
                }}
              >
                <Icon className="w-4 h-4 text-primary" />
              </motion.div>
            </AnimatePresence>

            {/* Animated Message */}
            <AnimatePresence mode="wait">
              <motion.span
                key={currentMessage.text}
                variants={messageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-sm font-medium"
              >
                {currentMessage.text}
              </motion.span>
            </AnimatePresence>

            {/* Typing dots */}
            <div className="flex gap-1 ml-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  custom={i}
                  variants={dotVariants}
                  animate="animate"
                  className="w-1 h-1 rounded-full bg-primary/60"
                />
              ))}
            </div>
          </div>

          {/* Animated Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/40 via-primary/70 to-primary/40 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min((elapsedTime / 90000) * 100, 95)}%`,
                }}
                transition={reducedMotion ? { duration: 0.01 } : { duration: 0.3 }}
              />
              {/* Shimmer effect */}
              <motion.div
                className="h-full w-full -mt-1.5 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={
                  reducedMotion
                    ? {}
                    : {
                        x: ["-100%", "100%"],
                      }
                }
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Local AI processing...</span>
              <motion.span
                key={seconds}
                initial={reducedMotion ? {} : { opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {minutes > 0 ? `${minutes}m ${displaySeconds}s` : `${displaySeconds}s`}
              </motion.span>
            </div>
          </div>
        </motion.div>

        {/* Tip for long waits */}
        <AnimatePresence>
          {elapsedTime > 30000 && (
            <motion.p
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{
                opacity: 1,
                height: "auto",
                y: 0,
                transition: reducedMotion ? { duration: 0.01 } : springSmooth,
              }}
              exit={{
                opacity: 0,
                height: 0,
                y: -5,
                transition: reducedMotion ? { duration: 0.01 } : { duration: 0.2 },
              }}
              className="text-xs text-muted-foreground px-2 overflow-hidden"
            >
              Tip: Local AI models can take 1-3 minutes. For faster responses, use a cloud API.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
