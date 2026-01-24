import { create } from "zustand";
import { persist } from "zustand/middleware";

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

  // Actions
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateLastMessage: (content: MessageContent[]) => void;
  appendToStream: (text: string) => void;
  finalizeStream: () => void;
  setStreaming: (isStreaming: boolean) => void;
  setSuggestions: (suggestions: DesignSuggestion[]) => void;
  clearSuggestions: () => void;
  setInputValue: (value: string) => void;
  setInputDisabled: (disabled: boolean) => void;
  clearMessages: () => void;
  newSession: () => void;
}

/**
 * Generate unique message ID
 */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

      // Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: generateId(),
              timestamp: new Date().toISOString(),
            },
          ],
          lastUpdated: new Date().toISOString(),
        })),

      updateLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages];
          if (messages.length > 0) {
            messages[messages.length - 1] = {
              ...messages[messages.length - 1],
              content,
              isStreaming: false,
            };
          }
          return { messages, lastUpdated: new Date().toISOString() };
        }),

      appendToStream: (text) =>
        set((state) => ({
          streamingContent: state.streamingContent + text,
        })),

      finalizeStream: () =>
        set((state) => {
          const messages = [...state.messages];
          if (messages.length > 0 && state.streamingContent) {
            const lastMessage = messages[messages.length - 1];
            // Append streamed content to the last message
            const newContent: MessageContent = {
              type: "text",
              content: state.streamingContent,
            };
            messages[messages.length - 1] = {
              ...lastMessage,
              content: [...lastMessage.content, newContent],
              isStreaming: false,
            };
          }
          return {
            messages,
            streamingContent: "",
            isStreaming: false,
            lastUpdated: new Date().toISOString(),
          };
        }),

      setStreaming: (isStreaming) =>
        set({
          isStreaming,
          streamingContent: isStreaming ? "" : get().streamingContent,
        }),

      setSuggestions: (suggestions) => set({ suggestions }),

      clearSuggestions: () => set({ suggestions: [] }),

      setInputValue: (value) => set({ inputValue: value }),

      setInputDisabled: (disabled) => set({ isInputDisabled: disabled }),

      clearMessages: () =>
        set({
          messages: [],
          streamingContent: "",
          isStreaming: false,
          suggestions: [],
          lastUpdated: new Date().toISOString(),
        }),

      newSession: () =>
        set({
          messages: [],
          streamingContent: "",
          isStreaming: false,
          suggestions: [],
          inputValue: "",
          isInputDisabled: false,
          sessionId: generateSessionId(),
          lastUpdated: new Date().toISOString(),
        }),
    }),
    {
      name: "platxa-chat-storage",
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
