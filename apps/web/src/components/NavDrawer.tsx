"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  FolderClosed,
  LogOut,
  Plus,
  Search,
  Settings2,
  Sparkles,
  UserCog,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { CORE_NAV, SETTINGS_NAV, canSee, isNavItemActive } from "@/components/navigation";

type WorkspaceRow = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { projects: number };
};
type ProjectRow = { id: string; name: string; workspaceId: string; status: string };

export default function NavDrawer({
  open,
  onClose,
  onOpenAgent,
}: {
  open: boolean;
  onClose: () => void;
  onOpenAgent: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [query, setQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery("");
    setWorkspaces([]);
    setProjects([]);
    setLoaded(false);
    search.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ) || [],
        ).filter((node) => node.getClientRects().length);
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!first) return;
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
    let active = true;
    (async () => {
      const [ws, pj] = await Promise.allSettled([
        hasPerm("workspace:list") ? api.get("/workspaces") : Promise.resolve({ data: [] }),
        hasPerm("project:list") ? api.get("/projects") : Promise.resolve({ data: [] }),
      ]);
      if (!active) return;
      if (ws.status === "fulfilled")
        setWorkspaces(Array.isArray(ws.value.data) ? ws.value.data : []);
      if (pj.status === "fulfilled") setProjects(Array.isArray(pj.value.data) ? pj.value.data : []);
      setLoaded(true);
    })();
    return () => {
      active = false;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentOrgId]);

  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return CORE_NAV;
    return CORE_NAV.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          canSee(hasPerm, item) &&
          (item.label.toLowerCase().includes(term) ||
            (item.hint ?? "").toLowerCase().includes(term)),
      ),
    })).filter((group) => group.items.length);
  }, [query, hasPerm]);

  const filteredSettings = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return SETTINGS_NAV.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          canSee(hasPerm, item) &&
          (item.label.toLowerCase().includes(term) ||
            (item.hint ?? "").toLowerCase().includes(term) ||
            group.label.toLowerCase().includes(term)),
      ),
    })).filter((group) => group.items.length);
  }, [query, hasPerm]);

  const filteredWorkspaces = useMemo(() => {
    if (!query.trim()) return workspaces;
    const term = query.trim().toLowerCase();
    return workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(term) ||
        projects.some((p) => p.workspaceId === ws.id && p.name.toLowerCase().includes(term)),
    );
  }, [query, workspaces, projects]);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return [];
    const term = query.trim().toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(term));
  }, [query, projects]);

  if (!open) return null;
  const closeOnNavigate = () => onClose();
  const org = organizations.find((o) => o.id === currentOrgId);

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="关闭导航遮罩"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        id="app-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="工作台菜单"
        className="absolute inset-y-0 left-0 flex w-[368px] max-w-[94vw] flex-col border-r border-slate-200/80 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] animate-[nav-drawer-in_180ms_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white">
                <Building2 size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">CollabSpace</p>
                <p className="text-xs text-slate-400">{org?.name ?? "尚未选择组织"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              常用入口、工作区与项目都在这里，需要时再展开。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索菜单、工作区和项目"
              placeholder="搜索页面、工作区或项目"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
            {query ? (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => {
                  setQuery("");
                  search.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-200/70"
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {hasPerm("project:add") ? (
              <Link
                href="/projects?new=project"
                onClick={closeOnNavigate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                <Plus size={13} /> 新建项目
              </Link>
            ) : null}
            {hasPerm("workspace:add") ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/projects?panel=workspaces&new=workspace");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                <Plus size={13} /> 新建工作区
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAgent();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Sparkles size={13} /> 问问助理
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {filteredGroups.map((group) => (
            <section key={group.label} className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items
                  .filter((item) => canSee(hasPerm, item))
                  .map((item) => {
                    const Icon = item.icon;
                    const active = pathname ? isNavItemActive(pathname, item) : false;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeOnNavigate}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                          active
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <Icon
                          size={16}
                          className={
                            active ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                          }
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/projects" ? (
                          <span
                            className={`text-[11px] ${active ? "text-white/60" : "text-slate-400"}`}
                          >
                            统一入口
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
              </div>
            </section>
          ))}

          {filteredSettings.length ? (
            <section className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                设置与系统
              </p>
              <div className="space-y-0.5">
                {filteredSettings.flatMap((group) =>
                  group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeOnNavigate}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Icon size={16} className="text-slate-400 group-hover:text-slate-600" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[11px] text-slate-400">{group.label}</span>
                      </Link>
                    );
                  }),
                )}
              </div>
            </section>
          ) : null}

          {hasPerm("workspace:list") ? (
            <section className="mb-4">
              <div className="flex items-center justify-between px-3 pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  工作区与项目
                </p>
                <Link
                  href="/projects?panel=workspaces"
                  onClick={closeOnNavigate}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600"
                >
                  管理 <Settings2 size={12} />
                </Link>
              </div>
              {!loaded ? (
                <p className="px-3 py-2 text-xs text-slate-400">正在读取…</p>
              ) : filteredWorkspaces.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  {query ? "没有匹配的工作区" : "还没有工作区"}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredWorkspaces.map((ws) => {
                    const children = projects.filter(
                      (project) =>
                        project.workspaceId === ws.id &&
                        (!query.trim() ||
                          ws.name.toLowerCase().includes(query.trim().toLowerCase()) ||
                          project.name.toLowerCase().includes(query.trim().toLowerCase())),
                    );
                    return (
                      <div key={ws.id} className="rounded-xl border border-transparent">
                        <Link
                          href={`/projects?workspace=${ws.id}`}
                          onClick={closeOnNavigate}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <FolderClosed size={15} className="text-slate-400" />
                          <span className="flex-1 truncate">{ws.name}</span>
                          <span className="text-[11px] text-slate-400">
                            {ws._count?.projects ?? children.length}
                          </span>
                          <ChevronRight size={13} className="text-slate-300" />
                        </Link>
                        {children.length ? (
                          <div className="mb-1 ml-5 space-y-0.5 border-l border-slate-100 pl-2">
                            {children.slice(0, 5).map((project) => (
                              <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                onClick={closeOnNavigate}
                                className="block truncate rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              >
                                {project.name}
                              </Link>
                            ))}
                            {children.length > 5 ? (
                              <Link
                                href={`/projects?workspace=${ws.id}`}
                                onClick={closeOnNavigate}
                                className="block px-2 py-1 text-[11px] text-slate-400 hover:text-indigo-600"
                              >
                                还有 {children.length - 5} 个…
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {query && filteredProjects.length ? (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="px-3 py-1 text-[11px] text-slate-400">项目搜索结果</p>
                  {filteredProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      onClick={closeOnNavigate}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ArrowRight size={14} className="text-slate-400" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="border-t border-slate-100 px-3 py-3">
          <div className="flex items-center gap-3 px-1 py-1.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              {(user?.name ?? "?").slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <div className="mt-1 space-y-0.5">
            <Link
              href="/settings"
              onClick={closeOnNavigate}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Settings2 size={16} className="text-slate-400 group-hover:text-slate-600" />
              <span className="flex-1">设置与组织</span>
              <span className="text-[11px] text-slate-400">成员、权限、系统</span>
            </Link>
            <Link
              href="/account/security"
              onClick={closeOnNavigate}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <UserCog size={15} className="text-slate-400" />
              账号安全
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  return (
    <button
      type="button"
      onClick={() => {
        logout();
        router.push("/login");
      }}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <LogOut size={15} className="text-slate-400" />
      退出登录
    </button>
  );
}
