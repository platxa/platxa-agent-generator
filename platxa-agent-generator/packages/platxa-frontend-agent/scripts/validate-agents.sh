#!/usr/bin/env bash
# =============================================================================
# PLATXA FRONTEND AGENT - Agent Validation Script
# =============================================================================
# Validates agent definitions against quality criteria
# Minimum score: 7.0/10 for production readiness
#
# Usage: bash scripts/validate-agents.sh [--verbose] [--strict]
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENTS_DIR=".claude/agents"
SKILLS_DIR=".claude/skills"
MIN_SCORE=7.0
VERBOSE=false
STRICT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --strict|-s)
      STRICT=true
      MIN_SCORE=8.0
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PLATXA Frontend Agent - Validation Suite                        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Track overall results
TOTAL_AGENTS=0
PASSED_AGENTS=0
FAILED_AGENTS=0
TOTAL_SCORE=0

# =============================================================================
# Validation Functions
# =============================================================================

validate_frontmatter() {
  local file="$1"
  local score=0
  local max_score=3

  # Check for YAML frontmatter
  if head -1 "$file" | grep -q "^---$"; then
    ((score++))

    # Check for required fields: name, description, tools
    if grep -q "^name:" "$file"; then ((score++)); fi
    if grep -q "^description:" "$file"; then ((score++)); fi
  fi

  echo "$score $max_score"
}

validate_structure() {
  local file="$1"
  local score=0
  local max_score=4

  # Check for key sections
  if grep -q "^## Overview\|^## Description" "$file"; then ((score++)); fi
  if grep -q "^## Workflow\|^## Steps\|^## Process" "$file"; then ((score++)); fi
  if grep -q "^## Examples\|^## Example" "$file"; then ((score++)); fi
  if grep -q "^## Output\|^## Return\|^## Response" "$file"; then ((score++)); fi

  echo "$score $max_score"
}

validate_content_quality() {
  local file="$1"
  local score=0
  local max_score=3

  # Check minimum content length (at least 100 lines for comprehensive agent)
  local lines=$(wc -l < "$file")
  if [ "$lines" -ge 50 ]; then ((score++)); fi
  if [ "$lines" -ge 100 ]; then ((score++)); fi
  if [ "$lines" -ge 200 ]; then ((score++)); fi

  echo "$score $max_score"
}

validate_agent() {
  local file="$1"
  local filename=$(basename "$file")

  echo -e "${YELLOW}Validating: ${NC}$filename"

  # Run validations
  read fm_score fm_max <<< $(validate_frontmatter "$file")
  read st_score st_max <<< $(validate_structure "$file")
  read cq_score cq_max <<< $(validate_content_quality "$file")

  # Calculate total score
  local total_score=$((fm_score + st_score + cq_score))
  local total_max=$((fm_max + st_max + cq_max))
  local percentage=$(echo "scale=1; $total_score * 10 / $total_max" | bc)

  TOTAL_SCORE=$(echo "$TOTAL_SCORE + $percentage" | bc)
  ((TOTAL_AGENTS++))

  # Verbose output
  if [ "$VERBOSE" = true ]; then
    echo "  ├── Frontmatter: $fm_score/$fm_max"
    echo "  ├── Structure:   $st_score/$st_max"
    echo "  └── Content:     $cq_score/$cq_max"
  fi

  # Check against minimum score
  local passed=$(echo "$percentage >= $MIN_SCORE" | bc)
  if [ "$passed" -eq 1 ]; then
    echo -e "  ${GREEN}✓ Score: $percentage/10 (PASS)${NC}"
    ((PASSED_AGENTS++))
    return 0
  else
    echo -e "  ${RED}✗ Score: $percentage/10 (FAIL - minimum: $MIN_SCORE)${NC}"
    ((FAILED_AGENTS++))
    return 1
  fi
}

# =============================================================================
# Main Execution
# =============================================================================

# Validate agents
if [ -d "$AGENTS_DIR" ]; then
  echo -e "\n${BLUE}▸ Validating Agent Definitions${NC}"
  echo "─────────────────────────────────────────"

  for agent_file in "$AGENTS_DIR"/*.md; do
    if [ -f "$agent_file" ]; then
      validate_agent "$agent_file" || true
    fi
  done
else
  echo -e "${YELLOW}⚠ No agents directory found at $AGENTS_DIR${NC}"
fi

# Count skill files
SKILL_COUNT=0
if [ -d "$SKILLS_DIR" ]; then
  SKILL_COUNT=$(find "$SKILLS_DIR" -name "*.md" -type f | wc -l)
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Validation Summary                                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$TOTAL_AGENTS" -gt 0 ]; then
  AVG_SCORE=$(echo "scale=1; $TOTAL_SCORE / $TOTAL_AGENTS" | bc)
  echo -e "  Agents validated:  $TOTAL_AGENTS"
  echo -e "  Agents passed:     ${GREEN}$PASSED_AGENTS${NC}"
  echo -e "  Agents failed:     ${RED}$FAILED_AGENTS${NC}"
  echo -e "  Average score:     $AVG_SCORE/10"
  echo -e "  Skill files:       $SKILL_COUNT"
else
  echo -e "  ${YELLOW}No agent files found to validate${NC}"
  echo -e "  Skill files:       $SKILL_COUNT"
fi

echo ""

# Exit with error if any agents failed
if [ "$FAILED_AGENTS" -gt 0 ]; then
  echo -e "${RED}✗ Validation failed: $FAILED_AGENTS agent(s) below minimum score${NC}"
  exit 1
else
  echo -e "${GREEN}✓ All agents passed validation${NC}"
  exit 0
fi
