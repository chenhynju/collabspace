"use client";
import Link from "next/link";

export default function AuthShell({
  title,
  subtitle,
  eyebrow = "CollabSpace",
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[var(--paper)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <aside className="relative hidden overflow-hidden bg-[var(--ink)] p-12 text-[var(--paper)] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(244,239,229,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(244,239,229,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 top-24 select-none font-serif text-[19rem] leading-none text-white/[0.045]"
        >
          协
        </div>
        <div className="relative">
          <Link href="/login" className="inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-sm bg-indigo-600">
              <span className="block h-3.5 w-3.5 border-2 border-[var(--paper)]" />
            </span>
            <span className="display-title text-[22px] leading-none">CollabSpace</span>
          </Link>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
            Enterprise Collaboration Atelier
          </p>
        </div>

        <div className="relative max-w-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-300">
            01 — 工作方式
          </p>
          <h2 className="display-title mt-5 text-[2.6rem] leading-[1.12] text-[var(--paper-raised)]">
            把项目、文档与对话
            <br />
            放在同一张工作台上。
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/50">
            两组织、两工作区、成员邀请、项目交付与权限边界。少一点跳转，多一点真正的协作。
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-[11px] text-white/45">
            <div>
              <p className="font-mono text-lg text-[var(--paper-raised)]">RLS</p>
              <p className="mt-1 leading-4">组织级数据隔离</p>
            </div>
            <div>
              <p className="font-mono text-lg text-[var(--paper-raised)]">AUDIT</p>
              <p className="mt-1 leading-4">操作可追溯</p>
            </div>
            <div>
              <p className="font-mono text-lg text-[var(--paper-raised)]">AI</p>
              <p className="mt-1 leading-4">助理只做边界内的事</p>
            </div>
          </div>
        </div>

        <p className="relative text-[10px] uppercase tracking-[0.22em] text-white/25">
          © {new Date().getFullYear()} CollabSpace · 企业项目协作云
        </p>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-6 py-5 lg:hidden">
          <Link href="/login" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-slate-900">
              <span className="block h-3 w-3 border-2 border-[var(--paper)]" />
            </span>
            <span className="display-title text-lg">CollabSpace</span>
          </Link>
          <span className="eyebrow">Atelier</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
          <div className={`w-full ${wide ? "max-w-lg" : "max-w-[420px]"} page-enter`}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display-title mt-3 text-[2.1rem] leading-[1.1] text-slate-900">
              {title}
            </h1>
            {subtitle ? <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 border-t border-slate-200 pt-5">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}
