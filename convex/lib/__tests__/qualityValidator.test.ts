import { describe, it, expect } from "vitest";
import { QualityValidatorImpl, SemanticLeakageDetector } from "../qualityValidator";

describe("SemanticLeakageDetector", () => {
  it("scores higher for known leaky phrase", () => {
    const detector = new SemanticLeakageDetector();
    const known = detector.score("The Battle of Waterloo ends Napoleon's rule");
    const unknown = detector.score("A small village harvests wheat");

    expect(known.score).toBeGreaterThan(unknown.score);
    expect(known.score).toBeGreaterThan(0);
  });

  it("scores 1.0 for exact phrase match", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The Battle of Waterloo ends Napoleon's rule");

    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("scores 0 for unrelated text", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("A small village harvests wheat");

    expect(result.score).toBe(0);
  });

  it("scores partial for partial match", () => {
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The moon was full that night");

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });
});

describe("SemanticLeakageDetector - stopword filtering", () => {
  it("does not flag text sharing only stopwords with a leaky phrase", () => {
    // "Battle of Hastings" shares "battle" and "of" with "battle of waterloo".
    // "of" is a stopword and should be ignored; only "battle" is a content match → 1/2 = 0.5,
    // which is below the 0.6 threshold and must not be flagged as leakage.
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The Battle of Hastings changed English history");

    expect(result.score).toBeLessThan(0.6);
  });

  it("scores content-word matches correctly after stopword removal", () => {
    // "battle of waterloo" content tokens are {battle, waterloo}.
    // Text contains both → full recall score of 1.0 regardless of surrounding stopwords.
    const detector = new SemanticLeakageDetector();
    const result = detector.score("The famous battle at waterloo in 1815");

    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("produces consistent scores on repeated calls (pre-tokenized phrases)", () => {
    const detector = new SemanticLeakageDetector();
    const text = "The Battle of Waterloo ends Napoleon's rule";

    expect(detector.score(text).score).toEqual(detector.score(text).score);
  });
});

describe("QualityValidatorImpl", () => {
  it("flags missing metadata and leakage", async () => {
    const validator = new QualityValidatorImpl(new SemanticLeakageDetector());

    const result = await validator.validateEvent({
      event_text: "The Battle of Waterloo concludes",
      year: 1815,
      metadata: undefined,
    });

    expect(result.passed).toBe(false);
    expect(result.scores.semantic_leakage).toBeGreaterThan(0);
    expect(result.suggestions?.length).toBeGreaterThan(0);
  });
});
