import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AgentStatus, QualityReport } from "@/lib/agent-bridge/types";
import { safeLocalStorage } from "./safe-storage";

/**
 * Message role types
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Generated file from AI
 */
export interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  action: "create" | "update" | "delete";
}

/**
 * Message content types
 */
export interface MessageContent {
  type: "text" | "code" | "files" | "suggestion" | "error";
  content: string;
  files?: GeneratedFile[];
  language?: string;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  timestamp: string; // ISO string for serialization
  isStreaming?: boolean;
}

/**
 * Design suggestion from AI
 */
export interface DesignSuggestion {
  id: string;
  type: "color" | "layout" | "typography" | "component";
  title: string;
  description: string;
  preview?: string;
  action?: string;
}

/**
 * Chat state interface
 */
interface ChatState {
  // Messages
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;

  // Suggestions
  suggestions: DesignSuggestion[];

  // Input
  inputValue: string;
  isInputDisabled: boolean;

  // Session tracking
  sessionId: string;
  lastUpdated: string;

  // Agent bridge status
  agentStatus: AgentStatus | null;
  qualityReport: QualityReport | null;

  // Actions
  setStreaming: (isStreaming: boolean) => void;
  setSuggestions: (suggestions: DesignSuggestion[]) => void;
  setInputValue: (value: string) => void;
  setAgentStatus: (status: AgentStatus | null) => void;
  setQualityReport: (report: QualityReport | null) => void;
}

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Chat store - manages conversation state with persistence
 */
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      isStreaming: false,
      streamingContent: "",
      suggestions: [],
      inputValue: "",
      isInputDisabled: false,
      sessionId: generateSessionId(),
      lastUpdated: new Date().toISOString(),
      agentStatus: null,
      qualityReport: null,

      // Actions
      setStreaming: (isStreaming) =>
        set({
          isStreaming,
          streamingContent: isStreaming ? "" : get().streamingContent,
        }),

      setSuggestions: (suggestions) => set({ suggestions }),

      setInputValue: (value) => set({ inputValue: value }),

      setAgentStatus: (status) => set({ agentStatus: status }),

      setQualityReport: (report) => set({ qualityReport: report }),

    }),
    {
      name: "platxa-chat-storage",
      storage: createJSONStorage(() => safeLocalStorage),
      // Only persist messages (last 50) and session info
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Keep last 50 messages
        sessionId: state.sessionId,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

/**
 * Selector for getting the last assistant message
 */
export const selectLastAssistantMessage = (state: ChatState) => {
  const assistantMessages = state.messages.filter(
    (m) => m.role === "assistant"
  );
  return assistantMessages[assistantMessages.length - 1];
};

/**
 * Selector for getting all generated files from messages
 */
export const selectGeneratedFiles = (state: ChatState): GeneratedFile[] => {
  const files: GeneratedFile[] = [];
  for (const message of state.messages) {
    for (const content of message.content) {
      if (content.type === "files" && content.files) {
        files.push(...content.files);
      }
    }
  }
  return files;
};
