import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { QualityValidatorImpl, SemanticLeakageDetector } from "../qualityValidator";

describe("QualityValidator feedback loop", () => {
  const testFile = path.join(process.cwd(), "convex", "data", "test-leaky-phrases.json");

  beforeEach(() => {
    // Start with empty test database
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  it("learns new leak phrases and increases score", async () => {
    const detector = new SemanticLeakageDetector(testFile);
    const validator = new QualityValidatorImpl(detector);

    const text = "Secret treaty of 1815 is revealed";
    const before = detector.score(text).score;

    validator.learnFromRejected(text, [1815, 1815]);

    const after = detector.score(text).score;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("persists learned phrases to disk", () => {
    const detector = new SemanticLeakageDetector(testFile);
    const validator = new QualityValidatorImpl(detector);

    const text = "Battle of 1066 decides realm";
    validator.learnFromRejected(text, [1066, 1066]);

    // Verify file was created and contains the phrase
    expect(fs.existsSync(testFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(testFile, "utf-8"));
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBe(1);
    expect(content[0]).toMatchObject({
      phrase: expect.stringContaining("battle of 1066"),
      yearRange: [1066, 1066],
      embedding: expect.any(Array),
    });
  });

  it("appends to existing phrases database", () => {
    // Start with one phrase
    const initialPhrase = {
      phrase: "moon landing",
      yearRange: [1969, 1969],
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    };
    fs.writeFileSync(testFile, JSON.stringify([initialPhrase], null, 2), "utf-8");

    const detector = new SemanticLeakageDetector(testFile);
    const validator = new QualityValidatorImpl(detector);

    // Learn new phrase
    validator.learnFromRejected("Berlin Wall falls", [1989, 1989]);

    // Verify both phrases are in file
    const content = JSON.parse(fs.readFileSync(testFile, "utf-8"));
    expect(content.length).toBe(2);
    expect(content[0]).toMatchObject(initialPhrase);
    expect(content[1]).toMatchObject({
      phrase: "berlin wall falls",
      yearRange: [1989, 1989],
    });
  });
});
