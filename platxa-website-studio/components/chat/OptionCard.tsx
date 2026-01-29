"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  FileCode2,
  Clock,
  AlertTriangle,
  Star,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import type {
  DesignOption,
  OptionPro,
  OptionCon,
  AffectedFile,
  EffortLevel,
} from "@/lib/agentic-core/option-generator";

// =============================================================================
// Types
// =============================================================================

interface OptionCardProps {
  /** The design option to display */
  option: DesignOption;
  /** Whether this card is selected */
  selected?: boolean;
  /** Callback when card is clicked/selected */
  onSelect?: (optionId: string) => void;
  /** Whether the card is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

const EFFORT_CONFIG: Record<EffortLevel, { label: string; color: string }> = {
  trivial: { label: "Trivial", color: "text-emerald-500" },
  small: { label: "Small", color: "text-green-500" },
  medium: { label: "Medium", color: "text-amber-500" },
  large: { label: "Large", color: "text-orange-500" },
  complex: { label: "Complex", color: "text-red-500" },
};

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "Low Risk", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  medium: { label: "Medium Risk", color: "text-amber-600", bg: "bg-amber-500/10" },
  high: { label: "High Risk", color: "text-red-600", bg: "bg-red-500/10" },
};

function ImpactBadge({ impact }: { impact: "low" | "medium" | "high" }) {
  const colors = {
    low: "bg-slate-500/10 text-slate-600",
    medium: "bg-blue-500/10 text-blue-600",
    high: "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] rounded", colors[impact])}>
      {impact}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const colors = {
    low: "bg-slate-500/10 text-slate-600",
    medium: "bg-amber-500/10 text-amber-600",
    high: "bg-red-500/10 text-red-600",
  };
  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] rounded", colors[severity])}>
      {severity}
    </span>
  );
}

function ChangeTypeBadge({ type }: { type: "create" | "modify" | "delete" }) {
  const config = {
    create: { label: "New", color: "bg-emerald-500/10 text-emerald-600" },
    modify: { label: "Edit", color: "bg-blue-500/10 text-blue-600" },
    delete: { label: "Delete", color: "bg-red-500/10 text-red-600" },
  };
  return (
    <span className={cn("px-1.5 py-0.5 text-[10px] rounded", config[type].color)}>
      {config[type].label}
    </span>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function ProsList({ pros }: { pros: OptionPro[] }) {
  if (pros.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-emerald-600 flex items-center gap-1">
        <Check className="w-3 h-3" />
        Pros
      </h4>
      <ul className="space-y-1.5">
        {pros.map((pro, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{pro.text}</span>
            <ImpactBadge impact={pro.impact} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsList({ cons }: { cons: OptionCon[] }) {
  if (cons.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-red-600 flex items-center gap-1">
        <X className="w-3 h-3" />
        Cons
      </h4>
      <ul className="space-y-1.5">
        {cons.map((con, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-start gap-2">
              <X className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{con.text}</span>
              <SeverityBadge severity={con.severity} />
            </div>
            {con.mitigation && (
              <p className="ml-5 text-xs text-muted-foreground mt-0.5">
                Mitigation: {con.mitigation}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilesList({ files }: { files: AffectedFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-blue-600 flex items-center gap-1">
        <FileCode2 className="w-3 h-3" />
        Affected Files ({files.length})
      </h4>
      <ul className="space-y-1">
        {files.map((file, i) => (
          <li
            key={i}
            className="flex items-center gap-2 text-xs font-mono bg-muted/50 px-2 py-1 rounded"
          >
            <ChangeTypeBadge type={file.changeType} />
            <span className="flex-1 truncate" title={file.path}>
              {file.path}
            </span>
            {file.linesChanged && (
              <span className="text-muted-foreground">~{file.linesChanged} lines</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * OptionCard - Displays a design option with expandable details
 *
 * Feature #50: Card shows name, description; expand reveals pros/cons/files
 *
 * @example
 * ```tsx
 * <OptionCard
 *   option={designOption}
 *   selected={selectedId === option.id}
 *   onSelect={(id) => setSelectedId(id)}
 * />
 * ```
 */
export function OptionCard({
  option,
  selected = false,
  onSelect,
  disabled = false,
  className,
  defaultExpanded = false,
}: OptionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const effortConfig = EFFORT_CONFIG[option.effort.level];
  const riskConfig = RISK_CONFIG[option.riskLevel];

  const handleClick = () => {
    if (!disabled && onSelect) {
      onSelect(option.id);
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all duration-200",
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && onSelect && "cursor-pointer",
        className
      )}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Header - Always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{option.name}</h3>
              {option.recommended && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-600">
                  <Star className="w-3 h-3" />
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {option.description}
            </p>
          </div>

          {/* Selection indicator */}
          {onSelect && (
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                selected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}
            >
              {selected && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              effortConfig.color
            )}
          >
            <Clock className="w-3 h-3" />
            {effortConfig.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded",
              riskConfig.bg,
              riskConfig.color
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            {riskConfig.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileCode2 className="w-3 h-3" />
            {option.filesAffected.length} files
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Zap className="w-3 h-3" />
            {option.plan.steps.length} steps
          </span>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={toggleExpand}
        className={cn(
          "w-full px-4 py-2 flex items-center justify-center gap-1",
          "text-xs text-muted-foreground hover:text-foreground",
          "border-t bg-muted/30 hover:bg-muted/50 transition-colors"
        )}
        type="button"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Show pros/cons & files
          </>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t animate-in slide-in-from-top-2 duration-200">
          <ProsList pros={option.pros} />
          <ConsList cons={option.cons} />
          <FilesList files={option.filesAffected} />

          {option.notes && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Note:</strong> {option.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OptionCard;
