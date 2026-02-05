"use client";

/**
 * FollowUpQuestions
 *
 * Enables AI to ask clarifying questions before executing requests.
 * Supports multiple question types and collects user answers.
 *
 * Feature #96: UI Enhancements - Follow-up questions
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  Check,
  X,
  ChevronRight,
  AlertCircle,
  MessageSquare,
  Lightbulb,
  Loader2,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "text"
  | "number"
  | "boolean"
  | "confirmation";

export interface QuestionOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Option description */
  description?: string;
  /** Icon or emoji */
  icon?: string;
  /** Is recommended option */
  recommended?: boolean;
  /** Is disabled */
  disabled?: boolean;
}

export interface FollowUpQuestion {
  /** Unique question ID */
  id: string;
  /** Question type */
  type: QuestionType;
  /** Question text */
  question: string;
  /** Detailed explanation */
  explanation?: string;
  /** Available options (for choice types) */
  options?: QuestionOption[];
  /** Placeholder text (for text/number) */
  placeholder?: string;
  /** Default value */
  defaultValue?: string | string[] | boolean | number;
  /** Is required */
  required: boolean;
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  /** Conditional display based on other answers */
  showIf?: {
    questionId: string;
    value: string | string[] | boolean;
  };
}

export interface FollowUpSession {
  /** Session ID */
  id: string;
  /** Original user request */
  originalRequest: string;
  /** Questions to ask */
  questions: FollowUpQuestion[];
  /** Current answers */
  answers: Record<string, unknown>;
  /** Session status */
  status: "pending" | "in_progress" | "completed" | "cancelled";
  /** Current question index */
  currentIndex: number;
  /** Created timestamp */
  createdAt: Date;
  /** Completed timestamp */
  completedAt?: Date;
}

export interface FollowUpQuestionsProps {
  /** Active session */
  session: FollowUpSession;
  /** Callback when answer is provided */
  onAnswer: (questionId: string, answer: unknown) => void;
  /** Callback when all questions are answered */
  onComplete: (answers: Record<string, unknown>) => void;
  /** Callback to skip questions */
  onSkip: () => void;
  /** Callback to cancel */
  onCancel: () => void;
  /** Show progress indicator */
  showProgress?: boolean;
  /** Allow skipping optional questions */
  allowSkip?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function FollowUpQuestions({
  session,
  onAnswer,
  onComplete,
  onSkip,
  onCancel,
  showProgress = true,
  allowSkip = true,
  compact = false,
  className,
}: FollowUpQuestionsProps) {
  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>(
    session.answers || {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter visible questions based on conditions
  const visibleQuestions = useMemo(() => {
    return session.questions.filter((q) => {
      if (!q.showIf) return true;
      const dependentAnswer = localAnswers[q.showIf.questionId];
      if (Array.isArray(q.showIf.value)) {
        return q.showIf.value.includes(dependentAnswer as string);
      }
      return dependentAnswer === q.showIf.value;
    });
  }, [session.questions, localAnswers]);

  // Current question
  const currentQuestion = visibleQuestions[session.currentIndex];

  // Progress
  const answeredCount = Object.keys(localAnswers).length;
  const totalRequired = visibleQuestions.filter((q) => q.required).length;

  // Handle answer change
  const handleAnswer = useCallback(
    (questionId: string, value: unknown) => {
      setLocalAnswers((prev) => ({ ...prev, [questionId]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      onAnswer(questionId, value);
    },
    [onAnswer]
  );

  // Validate answer
  const validateAnswer = useCallback(
    (question: FollowUpQuestion, value: unknown): string | null => {
      if (question.required && (value === undefined || value === "" || value === null)) {
        return "This field is required";
      }

      if (question.validation) {
        const { min, max, pattern, message } = question.validation;

        if (question.type === "number" && typeof value === "number") {
          if (min !== undefined && value < min) {
            return message || `Value must be at least ${min}`;
          }
          if (max !== undefined && value > max) {
            return message || `Value must be at most ${max}`;
          }
        }

        if (question.type === "text" && typeof value === "string" && pattern) {
          if (!new RegExp(pattern).test(value)) {
            return message || "Invalid format";
          }
        }
      }

      return null;
    },
    []
  );

  // Handle next/submit
  const handleNext = useCallback(() => {
    if (!currentQuestion) return;

    const answer = localAnswers[currentQuestion.id];
    const error = validateAnswer(currentQuestion, answer);

    if (error) {
      setErrors((prev) => ({ ...prev, [currentQuestion.id]: error }));
      return;
    }

    if (session.currentIndex >= visibleQuestions.length - 1) {
      // All questions answered
      onComplete(localAnswers);
    }
  }, [currentQuestion, localAnswers, validateAnswer, session.currentIndex, visibleQuestions.length, onComplete]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (!currentQuestion || currentQuestion.required) return;

    if (session.currentIndex >= visibleQuestions.length - 1) {
      onComplete(localAnswers);
    }
  }, [currentQuestion, session.currentIndex, visibleQuestions.length, onComplete, localAnswers]);

  // All questions answered check
  const allAnswered = visibleQuestions.every(
    (q) => !q.required || localAnswers[q.id] !== undefined
  );

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className={cn("bg-background border rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-primary/5">
        <div className="p-1.5 rounded-full bg-primary/10">
          <HelpCircle className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm">Clarification needed</h3>
          <p className="text-xs text-muted-foreground truncate">
            {session.originalRequest}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      {showProgress && visibleQuestions.length > 1 && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Question {session.currentIndex + 1} of {visibleQuestions.length}</span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${((session.currentIndex + 1) / visibleQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Question */}
      <div className={cn("p-4", compact && "p-3")}>
        <QuestionRenderer
          question={currentQuestion}
          value={localAnswers[currentQuestion.id]}
          error={errors[currentQuestion.id]}
          onChange={(value) => handleAnswer(currentQuestion.id, value)}
          compact={compact}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          {allowSkip && !currentQuestion.required && (
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip this question
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Skip all
          </button>
          <button
            onClick={handleNext}
            disabled={currentQuestion.required && !localAnswers[currentQuestion.id]}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
          >
            {session.currentIndex >= visibleQuestions.length - 1 ? (
              <>
                <Check className="w-3 h-3" />
                Submit
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Question Renderer
// =============================================================================

interface QuestionRendererProps {
  question: FollowUpQuestion;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  compact?: boolean;
}

function QuestionRenderer({
  question,
  value,
  error,
  onChange,
  compact,
}: QuestionRendererProps) {
  return (
    <div>
      {/* Question text */}
      <div className="mb-4">
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {question.question}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </p>
        {question.explanation && (
          <p className="mt-1 text-sm text-muted-foreground">
            {question.explanation}
          </p>
        )}
      </div>

      {/* Answer input */}
      <div>
        {question.type === "single_choice" && question.options && (
          <SingleChoice
            options={question.options}
            value={value as string}
            onChange={onChange}
            compact={compact}
          />
        )}

        {question.type === "multiple_choice" && question.options && (
          <MultipleChoice
            options={question.options}
            value={(value as string[]) || []}
            onChange={onChange}
            compact={compact}
          />
        )}

        {question.type === "text" && (
          <TextInput
            value={(value as string) || ""}
            placeholder={question.placeholder}
            onChange={onChange}
            validation={question.validation}
          />
        )}

        {question.type === "number" && (
          <NumberInput
            value={value as number}
            placeholder={question.placeholder}
            onChange={onChange}
            validation={question.validation}
          />
        )}

        {question.type === "boolean" && (
          <BooleanChoice
            value={value as boolean}
            onChange={onChange}
          />
        )}

        {question.type === "confirmation" && (
          <ConfirmationInput
            value={value as boolean}
            onChange={onChange}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-sm text-red-500">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Input Components
// =============================================================================

interface SingleChoiceProps {
  options: QuestionOption[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

function SingleChoice({ options, value, onChange, compact }: SingleChoiceProps) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => !option.disabled && onChange(option.value)}
          disabled={option.disabled}
          className={cn(
            "flex items-start gap-3 p-3 border rounded-lg text-left transition-colors",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-primary/50",
            option.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0",
              value === option.value
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            )}
          >
            {value === option.value && (
              <Check className="w-full h-full text-primary-foreground p-0.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {option.icon && <span>{option.icon}</span>}
              <span className="font-medium text-sm">{option.label}</span>
              {option.recommended && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Recommended
                </span>
              )}
            </div>
            {option.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {option.description}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

interface MultipleChoiceProps {
  options: QuestionOption[];
  value: string[];
  onChange: (value: string[]) => void;
  compact?: boolean;
}

function MultipleChoice({ options, value, onChange, compact }: MultipleChoiceProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => !option.disabled && toggleOption(option.value)}
          disabled={option.disabled}
          className={cn(
            "flex items-start gap-3 p-3 border rounded-lg text-left transition-colors",
            value.includes(option.value)
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-primary/50",
            option.disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0",
              value.includes(option.value)
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            )}
          >
            {value.includes(option.value) && (
              <Check className="w-full h-full text-primary-foreground p-0.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm">{option.label}</span>
            {option.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {option.description}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

interface TextInputProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  validation?: FollowUpQuestion["validation"];
}

function TextInput({ value, placeholder, onChange, validation }: TextInputProps) {
  const isTextarea = validation?.max && validation.max > 100;

  if (isTextarea) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Type your answer..."}
        rows={3}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Type your answer..."}
      className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  );
}

interface NumberInputProps {
  value: number | undefined;
  placeholder?: string;
  onChange: (value: number) => void;
  validation?: FollowUpQuestion["validation"];
}

function NumberInput({ value, placeholder, onChange, validation }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      placeholder={placeholder || "Enter a number..."}
      min={validation?.min}
      max={validation?.max}
      className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  );
}

interface BooleanChoiceProps {
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

function BooleanChoice({ value, onChange }: BooleanChoiceProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg transition-colors",
          value === true
            ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
            : "border-muted hover:border-green-500/50"
        )}
      >
        <Check className="w-4 h-4" />
        Yes
      </button>
      <button
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg transition-colors",
          value === false
            ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            : "border-muted hover:border-red-500/50"
        )}
      >
        <X className="w-4 h-4" />
        No
      </button>
    </div>
  );
}

interface ConfirmationInputProps {
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

function ConfirmationInput({ value, onChange }: ConfirmationInputProps) {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please confirm you want to proceed with this action.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onChange(true)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded transition-colors",
                value === true
                  ? "bg-yellow-600 text-white"
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-800 dark:text-yellow-200"
              )}
            >
              Confirm
            </button>
            <button
              onClick={() => onChange(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Hook for Follow-up Questions
// =============================================================================

export interface UseFollowUpQuestionsOptions {
  onComplete?: (answers: Record<string, unknown>) => void;
  onCancel?: () => void;
}

export function useFollowUpQuestions(options: UseFollowUpQuestionsOptions = {}) {
  const [session, setSession] = useState<FollowUpSession | null>(null);

  // Start a new session
  const startSession = useCallback(
    (originalRequest: string, questions: FollowUpQuestion[]): FollowUpSession => {
      const newSession: FollowUpSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        originalRequest,
        questions,
        answers: {},
        status: "in_progress",
        currentIndex: 0,
        createdAt: new Date(),
      };
      setSession(newSession);
      return newSession;
    },
    []
  );

  // Answer a question
  const answer = useCallback((questionId: string, value: unknown) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: { ...prev.answers, [questionId]: value },
      };
    });
  }, []);

  // Move to next question
  const nextQuestion = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentIndex: Math.min(prev.currentIndex + 1, prev.questions.length - 1),
      };
    });
  }, []);

  // Move to previous question
  const prevQuestion = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentIndex: Math.max(prev.currentIndex - 1, 0),
      };
    });
  }, []);

  // Complete session
  const complete = useCallback(
    (answers: Record<string, unknown>) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "completed",
          answers,
          completedAt: new Date(),
        };
      });
      options.onComplete?.(answers);
    },
    [options]
  );

  // Cancel session
  const cancel = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: "cancelled",
      };
    });
    options.onCancel?.();
  }, [options]);

  // Clear session
  const clear = useCallback(() => {
    setSession(null);
  }, []);

  return {
    session,
    isActive: session?.status === "in_progress",
    startSession,
    answer,
    nextQuestion,
    prevQuestion,
    complete,
    cancel,
    clear,
  };
}

// =============================================================================
// Question Builders
// =============================================================================

export const QuestionBuilders = {
  singleChoice: (
    id: string,
    question: string,
    options: QuestionOption[],
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "single_choice",
    question,
    options,
    required: true,
    ...opts,
  }),

  multipleChoice: (
    id: string,
    question: string,
    options: QuestionOption[],
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "multiple_choice",
    question,
    options,
    required: true,
    ...opts,
  }),

  text: (
    id: string,
    question: string,
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "text",
    question,
    required: true,
    ...opts,
  }),

  number: (
    id: string,
    question: string,
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "number",
    question,
    required: true,
    ...opts,
  }),

  boolean: (
    id: string,
    question: string,
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "boolean",
    question,
    required: true,
    ...opts,
  }),

  confirmation: (
    id: string,
    question: string,
    opts?: Partial<FollowUpQuestion>
  ): FollowUpQuestion => ({
    id,
    type: "confirmation",
    question,
    required: true,
    ...opts,
  }),
};

// =============================================================================
// Export
// =============================================================================

export default FollowUpQuestions;
