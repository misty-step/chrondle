import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModeDropdown } from "../ModeDropdown";

vi.mock("next/navigation", () => ({
  usePathname: () => "/classic",
  useRouter: () => ({ push: vi.fn() }),
}));

// Keep the options visible; Radix portal mechanics are not this contract.
vi.mock("@/components/ui/select", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Select: Container,
    SelectContent: Container,
    SelectTrigger: Container,
    SelectValue: () => null,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
      <div role="option" aria-selected={false} data-value={value}>
        {children}
      </div>
    ),
  };
});

afterEach(cleanup);

describe("Game navigation", () => {
  it("offers only Classic and Order, never retired Duel", () => {
    render(<ModeDropdown />);
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Classic",
      "Order",
    ]);
    expect(screen.queryByText("Duel")).not.toBeInTheDocument();
  });
});
