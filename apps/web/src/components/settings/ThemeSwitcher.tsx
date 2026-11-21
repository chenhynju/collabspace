"use client";
import { useEffect, useState } from "react";
import { Check, MoonStar, SunMedium } from "lucide-react";
import { Card } from "@/components/ui";

type UiTheme = "editorial" | "classic";

const OPTIONS: {
  id: UiTheme;
  name: string;
  caption: string;
  description: string;
  icon: typeof SunMedium;
  swatches: string[];
}[] = [
  {
    id: "editorial",
    name: "编辑风",
    caption: "当前主题",
    description: "暖纸、衬线与朱砂；适合长时间阅读与评审。",
    icon: MoonStar,
    swatches: ["#f4efe5", "#bc4a2b", "#1e4b3b", "#191914"],
  },
  {
    id: "classic",
    name: "经典浅色",
    caption: "12:00 前版本",
    description: "冷白、靛蓝与更大圆角；恢复旧版工作台观感。",
    icon: SunMedium,
    swatches: ["#f7f8fa", "#4f46e5", "#e2e8f0", "#0f172a"],
  },
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<UiTheme>("editorial");

  useEffect(() => {
    const current = document.documentElement.dataset.uiTheme;
    setTheme(current === "classic" ? "classic" : "editorial");
  }, []);

  const choose = (next: UiTheme) => {
    document.documentElement.dataset.uiTheme = next;
    try {
      localStorage.setItem("collabspace:ui-theme", next);
    } catch {}
    setTheme(next);
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Appearance</p>
          <h2 className="display-title mt-1.5 text-xl text-slate-900">界面主题</h2>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
            切换后立即生效，并保存在当前浏览器。它只影响外观，不改变权限、数据或组织配置。
          </p>
        </div>
        <span className="rounded-sm border border-slate-300 px-2.5 py-1 font-mono text-[10px] text-slate-500">
          {theme === "editorial" ? "EDITORIAL" : "CLASSIC"}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="界面主题"
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(option.id)}
              className={`group relative overflow-hidden rounded-lg border p-4 text-left transition ${
                active
                  ? "border-slate-900 bg-white shadow-sm"
                  : "border-slate-200 bg-white/50 hover:border-slate-400 hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-sm ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-medium ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 text-slate-500"
                  }`}
                >
                  {active ? <Check size={11} /> : null}
                  {active ? "使用中" : option.caption}
                </span>
              </div>
              <span className="mt-3 flex items-baseline gap-2">
                <span className="display-title text-lg text-slate-900">{option.name}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                  {option.caption}
                </span>
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {option.description}
              </span>
              <span className="mt-3 flex gap-1.5" aria-hidden="true">
                {option.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-5 flex-1 border border-black/10"
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
