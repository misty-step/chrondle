import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded border border-[#d3d6da] px-3 font-mono text-base transition-[border-color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-2 focus-visible:border-[#1a1a1b] focus-visible:shadow-[0_4px_10px_rgba(26,26,27,0.12)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
