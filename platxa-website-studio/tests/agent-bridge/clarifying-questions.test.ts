import { describe, it, expect } from "vitest";
import {
  analyzeAmbiguity,
  needsClarification,
  getClarifyingQuestions,
} from "@/lib/agent-bridge/clarifying-questions";

describe("Clarifying Questions", () => {
  describe("analyzeAmbiguity", () => {
    it("flags 'make it better' as ambiguous", () => {
      const result = analyzeAmbiguity("make it better");
      expect(result.needsClarification).toBe(true);
      expect(result.ambiguityScore).toBeGreaterThanOrEqual(0.3);
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it("flags 'make this nicer' as ambiguous", () => {
      const result = analyzeAmbiguity("make this nicer");
      expect(result.needsClarification).toBe(true);
      expect(result.dimensions).toContain("scope");
    });

    it("flags very short requests as ambiguous", () => {
      const result = analyzeAmbiguity("fix it");
      expect(result.needsClarification).toBe(true);
    });

    it("flags empty requests", () => {
      const result = analyzeAmbiguity("");
      expect(result.needsClarification).toBe(true);
      expect(result.ambiguityScore).toBe(1);
    });

    it("passes clear specific requests", () => {
      const result = analyzeAmbiguity(
        "Change the hero section background color to #3B82F6 and update the heading font to Inter"
      );
      expect(result.needsClarification).toBe(false);
      expect(result.ambiguityScore).toBe(0);
    });

    it("detects missing target dimension", () => {
      const result = analyzeAmbiguity("change the style");
      expect(result.dimensions).toContain("target");
    });

    it("detects style ambiguity for vague aesthetic words", () => {
      const result = analyzeAmbiguity("make it look modern and clean");
      expect(result.needsClarification).toBe(true);
      expect(result.dimensions).toContain("style");
    });

    it("detects content ambiguity for underspecified sections", () => {
      const result = analyzeAmbiguity("add a section");
      expect(result.needsClarification).toBe(true);
      expect(result.dimensions).toContain("content");
    });

    it("provides options in questions when available", () => {
      const result = analyzeAmbiguity("make it better");
      const withOptions = result.questions.filter((q) => q.options && q.options.length > 0);
      expect(withOptions.length).toBeGreaterThan(0);
    });

    it("assigns priority ordering to questions", () => {
      const result = analyzeAmbiguity("improve this");
      if (result.questions.length > 1) {
        expect(result.questions[0].priority).toBeLessThan(
          result.questions[result.questions.length - 1].priority
        );
      }
    });

    it("caps ambiguity score at 1", () => {
      // Very short + vague improvement = high score but capped
      const result = analyzeAmbiguity("improve");
      expect(result.ambiguityScore).toBeLessThanOrEqual(1);
    });

    it("deduplicates questions", () => {
      const result = analyzeAmbiguity("make it better");
      const texts = result.questions.map((q) => q.question);
      expect(new Set(texts).size).toBe(texts.length);
    });
  });

  describe("needsClarification", () => {
    it("returns true for ambiguous prompts", () => {
      expect(needsClarification("make it better")).toBe(true);
      expect(needsClarification("improve")).toBe(true);
      expect(needsClarification("")).toBe(true);
    });

    it("returns false for specific prompts", () => {
      expect(needsClarification(
        "Set the header background to navy blue and add a centered logo image"
      )).toBe(false);
    });
  });

  describe("getClarifyingQuestions", () => {
    it("returns questions for ambiguous requests", () => {
      const questions = getClarifyingQuestions("make it better");
      expect(questions.length).toBeGreaterThan(0);
      expect(questions[0].question).toBeTruthy();
    });

    it("returns empty array for clear requests", () => {
      const questions = getClarifyingQuestions(
        "Change hero heading text to 'Welcome' and set font-size to 3rem"
      );
      expect(questions).toEqual([]);
    });

    it("respects maxQuestions limit", () => {
      const questions = getClarifyingQuestions("make it better", 1);
      expect(questions.length).toBeLessThanOrEqual(1);
    });

    it("defaults to max 3 questions", () => {
      const questions = getClarifyingQuestions("add a section");
      expect(questions.length).toBeLessThanOrEqual(3);
    });
  });
});
