"use client";
import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------------- Button ---------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500",
    secondary:
      "bg-white/70 text-slate-700 border border-slate-300 hover:border-slate-900 hover:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400",
    danger: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    success: "bg-violet-700 text-white hover:bg-violet-800 disabled:bg-violet-300",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(25,25,20,0.03)]",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------- Badge ---------------- */
const BADGE_TONES: Record<string, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-600",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-indigo-200 bg-indigo-50 text-indigo-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

export function Badge({
  tone = "slate",
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium leading-5 tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Inputs ---------------- */
export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-100 disabled:text-slate-400";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = React.useId(),
    dialog = React.useRef<HTMLDivElement>(null),
    close = React.useRef(onClose);
  close.current = onClose;
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ) || [],
        ).filter((n) => n.getClientRects().length);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-300 bg-[var(--paper-raised)] shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-[var(--paper-raised)] px-6 py-4">
          <div>
            <p className="eyebrow">CollabSpace</p>
            <h3 id={titleId} className="display-title mt-1 text-xl text-slate-900">
              {title}
            </h3>
          </div>
          <button
            aria-label="关闭弹窗"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Empty ---------------- */
export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 px-6 py-16 text-center">
      <span className="mx-auto mb-3 block h-px w-10 bg-indigo-600" />
      <p className="display-title text-base text-slate-500">{text}</p>
    </div>
  );
}

/* ---------------- Error text ---------------- */
export function InlineError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs leading-5 text-indigo-700">{message}</p>;
}
