"use client";

import type { Message } from "ai";
import { motion, AnimatePresence } from "framer-motion";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import {
  springSnappy,
  prefersReducedMotion,
} from "@/lib/animations";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const reducedMotion = prefersReducedMotion();

  // Animation variants for messages
  const messageVariants = {
    initial: (isUser: boolean) => ({
      opacity: 0,
      x: isUser ? 20 : -20,
      y: 10,
      scale: 0.95,
    }),
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: reducedMotion ? { duration: 0.01 } : springSnappy,
    },
    exit: (isUser: boolean) => ({
      opacity: 0,
      x: isUser ? 10 : -10,
      scale: 0.98,
      transition: reducedMotion ? { duration: 0.01 } : { duration: 0.15 },
    }),
  };

  const containerVariants = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.05,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="space-y-4"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            custom={message.role === "user"}
            variants={messageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout={!reducedMotion}
          >
            <MessageBubble message={message} />
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: reducedMotion ? { duration: 0.01 } : springSnappy,
            }}
            exit={{
              opacity: 0,
              y: -5,
              transition: reducedMotion ? { duration: 0.01 } : { duration: 0.15 },
            }}
          >
            <TypingIndicator />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
