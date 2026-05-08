import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "default" ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-600 hover:bg-slate-900",
        className
      )}
      {...props}
    />
  );
}
