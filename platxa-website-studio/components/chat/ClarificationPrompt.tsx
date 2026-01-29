"use client";

import { useState, useCallback } from "react";
import {
  HelpCircle,
  Send,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarifyingQuestion } from "@/lib/agentic-core/question-generator";

// =============================================================================
// Types
// =============================================================================

/** User's answer to a question */
export interface QuestionAnswer {
  questionId: string;
  value: string;
  selectedOptions?: string[];
}

interface ClarificationPromptProps {
  /** Questions to display */
  questions: ClarifyingQuestion[];
  /** Callback when answers are submitted */
  onSubmit: (answers: QuestionAnswer[]) => void;
  /** Callback when user skips/cancels */
  onSkip?: () => void;
  /** Whether the prompt is loading */
  loading?: boolean;
  /** Additional class name */
  className?: string;
  /** Show rationale for questions */
  showRationale?: boolean;
}

// =============================================================================
// Subcomponents
// =============================================================================

interface TextInputQuestionProps {
  question: ClarifyingQuestion;
  value: string;
  onChange: (value: string) => void;
}

function TextInputQuestion({ question, value, onChange }: TextInputQuestionProps) {
  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Type your answer..."
      className="mt-2"
    />
  );
}

interface ChoiceQuestionProps {
  question: ClarifyingQuestion;
  selected: string[];
  onChange: (selected: string[]) => void;
  multiSelect?: boolean;
}

function ChoiceQuestion({
  question,
  selected,
  onChange,
  multiSelect = false,
}: ChoiceQuestionProps) {
  const options = question.suggestedOptions || [];

  const handleSelect = (option: string) => {
    if (multiSelect) {
      if (selected.includes(option)) {
        onChange(selected.filter((s) => s !== option));
      } else {
        onChange([...selected, option]);
      }
    } else {
      onChange([option]);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      {options.map((option, i) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={i}
            type="button"
            onClick={() => handleSelect(option)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-colors",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div
              className={cn(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
              )}
            >
              {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </div>
            <span className="flex-1">{option}</span>
          </button>
        );
      })}
      {/* Custom option */}
      <div className="flex items-center gap-2 mt-2">
        <Input
          type="text"
          placeholder="Other (type your answer)..."
          className="flex-1 text-sm"
          onChange={(e) => {
            if (e.target.value) {
              onChange([e.target.value]);
            }
          }}
        />
      </div>
    </div>
  );
}

interface ListInputQuestionProps {
  question: ClarifyingQuestion;
  items: string[];
  onChange: (items: string[]) => void;
}

function ListInputQuestion({ question, items, onChange }: ListInputQuestionProps) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="mt-2 space-y-2">
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50 text-sm"
            >
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an item..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem}>
          Add
        </Button>
      </div>
    </div>
  );
}

interface ExampleInputQuestionProps {
  question: ClarifyingQuestion;
  value: string;
  onChange: (value: string) => void;
}

function ExampleInputQuestion({ question, value, onChange }: ExampleInputQuestionProps) {
  return (
    <div className="mt-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Provide an example or reference..."
        className={cn(
          "w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background",
          "text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        )}
      />
    </div>
  );
}

interface QuestionCardProps {
  question: ClarifyingQuestion;
  index: number;
  value: string;
  selectedOptions: string[];
  onValueChange: (value: string) => void;
  onOptionsChange: (options: string[]) => void;
  showRationale: boolean;
}

function QuestionCard({
  question,
  index,
  value,
  selectedOptions,
  onValueChange,
  onOptionsChange,
  showRationale,
}: QuestionCardProps) {
  const [expanded, setExpanded] = useState(true);

  const answerTypeIcons = {
    text: MessageCircle,
    choice: ListChecks,
    list: ListChecks,
    example: MessageCircle,
  };
  const Icon = answerTypeIcons[question.expectedAnswerType] || MessageCircle;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-start gap-3 p-3 text-left",
          "hover:bg-muted/50 transition-colors"
        )}
      >
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{question.text}</p>
          {showRationale && question.rationale && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {question.rationale}
            </p>
          )}
        </div>
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0">
          {question.expectedAnswerType === "text" && (
            <TextInputQuestion
              question={question}
              value={value}
              onChange={onValueChange}
            />
          )}
          {question.expectedAnswerType === "choice" && (
            <ChoiceQuestion
              question={question}
              selected={selectedOptions}
              onChange={onOptionsChange}
            />
          )}
          {question.expectedAnswerType === "list" && (
            <ListInputQuestion
              question={question}
              items={selectedOptions}
              onChange={onOptionsChange}
            />
          )}
          {question.expectedAnswerType === "example" && (
            <ExampleInputQuestion
              question={question}
              value={value}
              onChange={onValueChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * ClarificationPrompt - Displays questions and collects answers
 *
 * Feature #52: Shows questions with input fields or multiple choice where appropriate
 *
 * @example
 * ```tsx
 * <ClarificationPrompt
 *   questions={clarifyingQuestions}
 *   onSubmit={(answers) => console.log('Answers:', answers)}
 *   onSkip={() => console.log('Skipped')}
 * />
 * ```
 */
export function ClarificationPrompt({
  questions,
  onSubmit,
  onSkip,
  loading = false,
  className,
  showRationale = false,
}: ClarificationPromptProps) {
  // Track answers for each question
  const [answers, setAnswers] = useState<Record<string, { value: string; options: string[] }>>(
    () =>
      questions.reduce(
        (acc, q) => ({
          ...acc,
          [q.id]: { value: "", options: [] },
        }),
        {}
      )
  );

  const updateValue = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], value },
    }));
  }, []);

  const updateOptions = useCallback((questionId: string, options: string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], options },
    }));
  }, []);

  const handleSubmit = () => {
    const formattedAnswers: QuestionAnswer[] = questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id]?.value || "",
      selectedOptions:
        answers[q.id]?.options.length > 0 ? answers[q.id].options : undefined,
    }));
    onSubmit(formattedAnswers);
  };

  const hasAnswers = questions.some((q) => {
    const answer = answers[q.id];
    return answer?.value || (answer?.options && answer.options.length > 0);
  });

  if (questions.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-primary" />
        <h3 className="font-medium">Questions to Clarify</h3>
        <span className="text-xs text-muted-foreground">
          ({questions.length} question{questions.length > 1 ? "s" : ""})
        </span>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id]?.value || ""}
            selectedOptions={answers[question.id]?.options || []}
            onValueChange={(v) => updateValue(question.id, v)}
            onOptionsChange={(opts) => updateOptions(question.id, opts)}
            showRationale={showRationale}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onSkip && (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Skip for Now
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={loading || !hasAnswers}
        >
          {loading ? (
            "Submitting..."
          ) : (
            <>
              <Send className="w-4 h-4 mr-1" />
              Submit Answers
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ClarificationPrompt;
