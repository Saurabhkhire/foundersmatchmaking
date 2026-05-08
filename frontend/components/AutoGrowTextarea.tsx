"use client";

import { useEffect, useRef } from "react";

const LINE_PX = 24;
const PAD_PX = 24;

export function AutoGrowTextarea({
  label,
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const minHeight = minRows * LINE_PX + PAD_PX;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [value, minHeight]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <textarea
        ref={ref}
        rows={minRows}
        className="w-full resize-none overflow-hidden rounded-md border border-slate-700 bg-slate-900 px-3 py-3 text-base leading-6 text-slate-100 placeholder:text-slate-500"
        style={{ minHeight }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
