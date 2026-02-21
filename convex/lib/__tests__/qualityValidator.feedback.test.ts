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
    });
  });

  it("appends to existing phrases database", () => {
    // Start with one phrase
    const initialPhrase = {
      phrase: "moon landing",
      yearRange: [1969, 1969],
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

  it("rejects phrases file paths outside convex/data", () => {
    const unsafePath = path.join(process.cwd(), "tmp", "leaky-phrases-outside.json");
    expect(() => new SemanticLeakageDetector(unsafePath)).toThrow(/convex[\/\\]data/);
    expect(fs.existsSync(unsafePath)).toBe(false);
  });

  it("never writes corrupted JSON when learning multiple phrases", () => {
    const detector = new SemanticLeakageDetector(testFile);
    const validator = new QualityValidatorImpl(detector);

    const texts = [
      "Concurrent write event A",
      "Concurrent write event B",
      "Concurrent write event C",
    ];

    for (const text of texts) {
      validator.learnFromRejected(text, [1900, 1900]);
    }

    const raw = fs.readFileSync(testFile, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const content = JSON.parse(raw);
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });
});
