"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckSquare2,
  FileText,
  FolderClosed,
  FolderKanban,
  Loader2,
  Paperclip,
  Search,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export type SearchResult = {
  id: string;
  type: "workspace" | "project" | "document" | "task" | "file";
  title: string;
  subtitle: string;
  href: string;
  updatedAt: string;
};

const TYPE_META = {
  workspace: { label: "工作区", icon: FolderClosed, color: "bg-amber-50 text-amber-700" },
  project: { label: "项目", icon: FolderKanban, color: "bg-indigo-50 text-indigo-700" },
  document: { label: "文档", icon: FileText, color: "bg-blue-50 text-blue-700" },
  task: { label: "任务", icon: CheckSquare2, color: "bg-emerald-50 text-emerald-700" },
  file: { label: "附件", icon: Paperclip, color: "bg-slate-100 text-slate-600" },
};

function useGlobalSearch(query: string, active: boolean) {
  const currentOrgId = useAuthStore((state) => state.currentOrgId);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (!active || !term || !currentOrgId) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.get("/search", {
          params: { q: term },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setResults(response.data.results ?? []);
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(e.response?.data?.message ?? "搜索暂时不可用，请稍后重试。");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, active, currentOrgId]);

  return { results, loading, error };
}

export function SearchResultList({
  results,
  onSelect,
}: {
  results: SearchResult[];
  onSelect?: () => void;
}) {
  return (
    <ul role="list" className="divide-y divide-slate-100">
      {results.map((result) => {
        const meta = TYPE_META[result.type];
        const Icon = meta.icon;
        return (
          <li key={`${result.type}:${result.id}`}>
            <Link
              href={result.href}
              onClick={onSelect}
              className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.color}`}>
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800 group-hover:text-indigo-700">
                  {result.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
              </span>
              <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                {new Date(result.updatedAt).toLocaleDateString("zh-CN")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const currentOrgId = useAuthStore((state) => state.currentOrgId);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { results, loading, error } = useGlobalSearch(query, open);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const previous = document.activeElement as HTMLElement | null;
    window.setTimeout(() => input.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ) ?? [],
        ).filter((node) => node.getClientRects().length);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
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
  }, [open, currentOrgId]);

  if (!open) return null;
  const showAll = () => {
    const term = query.trim();
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[8vh] sm:px-6">
      <button
        type="button"
        aria-label="关闭全局搜索遮罩"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        className="relative flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          {loading ? (
            <Loader2 size={19} className="shrink-0 animate-spin text-indigo-500" />
          ) : (
            <Search size={19} className="shrink-0 text-slate-400" />
          )}
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                showAll();
              }
            }}
            maxLength={80}
            aria-label="搜索项目、文档、任务和附件"
            placeholder="搜索项目、文档、任务和附件…"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空全局搜索"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">在当前组织中查找内容</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">只显示你有权访问的资源，不会跨组织检索。</p>
            </div>
          ) : error ? (
            <p role="alert" className="px-4 py-8 text-center text-sm text-red-600">{error}</p>
          ) : !loading && results.length === 0 ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-slate-500">没有找到匹配内容，试试其他关键词。</p>
          ) : (
            <SearchResultList results={results.slice(0, 10)} onSelect={onClose} />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-400">
          <span>当前组织 · 权限内结果</span>
          <button
            type="button"
            disabled={!query.trim()}
            onClick={showAll}
            className="rounded-lg px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
          >
            查看全部结果 <kbd className="ml-1 font-sans text-[10px]">Enter</kbd>
          </button>
        </footer>
      </div>
    </div>
  );
}

export function SearchPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery.trim());
  const { results, loading, error } = useGlobalSearch(query, true);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">当前组织</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">全局搜索</h1>
        <p className="mt-2 text-sm text-slate-500">查找你有权访问的工作区、项目、文档、任务和附件。</p>
      </header>
      <form
        className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(input.trim());
        }}
      >
        <Search size={18} className="ml-2 shrink-0 text-slate-400" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={80}
          aria-label="全局搜索关键词"
          placeholder="输入关键词"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          搜索
        </button>
      </form>

      <section aria-label="搜索结果" className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>{query ? `“${query}”的搜索结果` : "输入关键词开始搜索"}</span>
          {!loading && query && !error ? <span>{results.length} 条</span> : null}
        </div>
        <div className="p-2">
          {loading ? (
            <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> 正在搜索…
            </p>
          ) : error ? (
            <p role="alert" className="py-12 text-center text-sm text-red-600">{error}</p>
          ) : !query ? (
            <p className="py-12 text-center text-sm text-slate-400">可搜索标题、名称和项目描述。</p>
          ) : results.length === 0 ? (
            <p role="status" className="py-12 text-center text-sm text-slate-500">没有找到匹配内容。</p>
          ) : (
            <SearchResultList results={results} />
          )}
        </div>
      </section>
    </div>
  );
}
