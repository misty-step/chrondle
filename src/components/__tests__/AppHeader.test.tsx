import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "@/components/AppHeader";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ModeDropdown", () => ({
  ModeDropdown: ({ className }: { className?: string }) => (
    <div data-testid="mode-dropdown" data-class={className}>
      ModeDropdown
    </div>
  ),
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">theme</button>,
}));

vi.mock("@/components/AuthButtons", () => ({
  AuthButtons: () => <div data-testid="auth-buttons">auth</div>,
}));

vi.mock("@/components/AdminButton", () => ({
  AdminButton: () => null,
}));

vi.mock("@/components/SupportModal", () => ({
  __esModule: true,
  default: () => null,
}));

vi.mock("@/components/ui/NavbarButton", () => ({
  NavbarButton: ({ href, children, ...rest }: { href?: string; children: React.ReactNode }) => (
    <a href={href} data-testid="navbar-button" data-rest={JSON.stringify(rest)}>
      {children}
    </a>
  ),
}));

describe("AppHeader", () => {
  it("links to classic archive by default", () => {
    render(<AppHeader />);
    const archiveLink = screen.getAllByTestId("navbar-button")[0];
    expect(archiveLink).toHaveAttribute("href", "/archive");
  });

  it("links to order archive when mode is order", () => {
    render(<AppHeader mode="order" />);
    const archiveLink = screen.getAllByTestId("navbar-button")[0];
    expect(archiveLink).toHaveAttribute("href", "/archive/order");
  });

  it("renders puzzle number when provided", () => {
    render(<AppHeader puzzleNumber={42} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });
});
