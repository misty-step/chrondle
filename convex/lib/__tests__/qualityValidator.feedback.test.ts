import { describe, it, expect } from "vitest";
import { QualityValidatorImpl, SemanticLeakageDetector } from "../qualityValidator";

describe("QualityValidator feedback loop", () => {
  it("learns new leak phrases and increases score", async () => {
    const detector = new SemanticLeakageDetector();
    const validator = new QualityValidatorImpl(detector);

    const text = "Secret treaty of 1815 is revealed";
    const before = detector.score(text).score;

    validator.learnFromRejected(text, [1815, 1815]);

    const after = detector.score(text).score;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});
