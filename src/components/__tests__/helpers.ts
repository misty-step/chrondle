import { expect } from "vitest";

// Custom assertion helpers for component testing
export const assertElementExists = (element: HTMLElement | null) => {
  expect(element).not.toBe(null);
  expect(element).toBeTruthy();
};

export const assertElementNotExists = (element: HTMLElement | null) => {
  expect(element).toBe(null);
};

export const assertElementHasAttribute = (
  element: HTMLElement | null,
  attribute: string,
  value: string,
) => {
  expect(element).not.toBe(null);
  expect(element?.getAttribute(attribute)).toBe(value);
};

export const assertElementHasTextContent = (element: HTMLElement | null, text: string | RegExp) => {
  expect(element).not.toBe(null);
  if (typeof text === "string") {
    expect(element?.textContent).toContain(text);
  } else {
    expect(element?.textContent).toMatch(text);
  }
};

export const assertElementHasClass = (element: HTMLElement | null, className: string) => {
  expect(element).not.toBe(null);
  expect(element?.classList.contains(className)).toBe(true);
};

// Helper to check if an element is disabled
export const assertElementIsDisabled = (element: HTMLElement | null) => {
  expect(element).not.toBe(null);
  expect((element as HTMLInputElement | HTMLButtonElement)?.disabled).toBe(true);
};

export const assertElementIsEnabled = (element: HTMLElement | null) => {
  expect(element).not.toBe(null);
  expect((element as HTMLInputElement | HTMLButtonElement)?.disabled).toBe(false);
};
