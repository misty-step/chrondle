// Test setup for Vitest
import { beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Mock motion/react for animation testing
vi.mock("motion/react", async () => {
  const actual = await vi.importActual("motion/react");
  return {
    ...actual,
    useReducedMotion: () => false, // Default to animations enabled in tests
  };
});

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

// Notification API mocks removed - feature deleted

// Keep original timer functions for proper test execution

// Mock crypto.randomUUID for consistent testing
const mockCrypto = {
  randomUUID: () => "test-uuid-1234-5678-9abc-def123456789",
};

// Mock matchMedia for consistent testing and to prevent hanging
const mockMatchMedia = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(), // Deprecated
  removeListener: vi.fn(), // Deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

beforeEach(() => {
  // Reset localStorage before each test
  localStorageMock.clear();

  // Setup global mocks
  Object.defineProperty(global, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  Object.defineProperty(global, "crypto", {
    value: mockCrypto,
    writable: true,
  });

  // DOM-specific setup (skip in edge-runtime)
  if (typeof window !== "undefined") {
    // Mock matchMedia to prevent hanging in tests
    Object.defineProperty(window, "matchMedia", {
      value: mockMatchMedia,
      writable: true,
    });
  }

  // Ensure DOM container exists for React Testing Library (skip in edge-runtime)
  if (typeof document !== "undefined" && document.body) {
    document.body.innerHTML = '<div id="root"></div>';
  }
});

// COMPREHENSIVE CLEANUP: Force cleanup all resources after each test
afterEach(async () => {
  // Clear all Vitest timers
  vi.clearAllTimers();

  // Clear all mocks to prevent accumulation
  vi.clearAllMocks();

  // Reset DOM to prevent memory leaks (skip in edge-runtime)
  if (typeof document !== "undefined" && document.body) {
    document.body.innerHTML = "";
  }

  // Force any pending microtasks to complete
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Force garbage collection if available (Node.js testing)
  if (global.gc) {
    global.gc();
  }
});

// GLOBAL CLEANUP: Force exit after all tests complete
afterAll(async () => {

  // Final cleanup to ensure process exits
  vi.clearAllTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();

  // Force final garbage collection
  if (global.gc) {
    global.gc();
  }
});

// Optionally mock console during tests to reduce noise
if (process.env.QUIET_TESTS) {
  beforeAll(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
}

export { localStorageMock, mockCrypto };
