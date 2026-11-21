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
  UserRound,
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
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panel}
        id="app-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="工作台菜单"
        className="absolute inset-y-0 left-0 flex w-[392px] max-w-[94vw] flex-col border-r border-black/40 bg-[var(--ink)] text-[var(--paper)] shadow-[0_24px_80px_-24px_rgba(15,23,42,0.6)] animate-[nav-drawer-in_180ms_cubic-bezier(.2,.8,.2,1)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pb-5 pt-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-sm bg-indigo-600 text-white">
                <Building2 size={16} />
              </span>
              <div>
                <p className="display-title text-[19px] leading-none text-[var(--paper-raised)]">CollabSpace</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/40">
                  {org?.name ?? "尚未选择组织"}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-[17rem] text-xs leading-5 text-white/45">
              常用入口、工作区与项目都在这里，需要时再展开。
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭导航"
            onClick={onClose}
            className="rounded-md p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
            />
            <input
              ref={search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索菜单、工作区和项目"
              placeholder="搜索页面、工作区或项目"
              className="w-full rounded-md border border-white/15 bg-white/5 py-2.5 pl-9 pr-9 text-sm text-[var(--paper-raised)] placeholder:text-white/30 focus:border-indigo-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            {query ? (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => {
                  setQuery("");
                  search.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X size={14} />
              </button>
            ) : null}
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {hasPerm("project:add") ? (
              <Link
                href="/projects?new=project"
                onClick={closeOnNavigate}
                className="inline-flex items-center gap-1.5 rounded-sm bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
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
                className="inline-flex items-center gap-1.5 rounded-sm border border-white/20 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:border-white/40 hover:text-white"
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
              className="inline-flex items-center gap-1.5 rounded-sm bg-violet-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              <Sparkles size={13} /> 问问助理
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {filteredGroups.map((group, index) => (
            <section key={group.label} className="mb-5">
              <p className="flex items-center gap-2 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                <span className="font-mono text-indigo-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
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
                        className={`group relative flex items-center gap-3 rounded-md py-2.5 pl-3 pr-3 text-sm transition ${
                          active
                            ? "bg-[var(--paper)] font-medium text-[var(--ink)]"
                            : "text-white/65 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {active ? (
                          <span className="absolute inset-y-2 left-0 w-[3px] bg-indigo-600" />
                        ) : null}
                        <Icon
                          size={16}
                          className={
                            active ? "text-indigo-700" : "text-white/35 group-hover:text-white/70"
                          }
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/projects" ? (
                          <span
                            className={`text-[10px] uppercase tracking-[0.14em] ${
                              active ? "text-slate-500" : "text-white/25"
                            }`}
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
            <section className="mb-5">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
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
                        className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
                      >
                        <Icon size={16} className="text-white/35 group-hover:text-white/70" />
                        <span className="flex-1">{item.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                          {group.label}
                        </span>
                      </Link>
                    );
                  }),
                )}
              </div>
            </section>
          ) : null}

          {hasPerm("workspace:list") ? (
            <section className="mb-5">
              <div className="flex items-center justify-between px-3 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                  工作区与项目
                </p>
                <Link
                  href="/projects?panel=workspaces"
                  onClick={closeOnNavigate}
                  className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-white"
                >
                  管理 <Settings2 size={12} />
                </Link>
              </div>
              {!loaded ? (
                <p className="px-3 py-2 text-xs text-white/35">正在读取…</p>
              ) : filteredWorkspaces.length === 0 ? (
                <p className="px-3 py-2 text-xs text-white/35">
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
                      <div key={ws.id} className="rounded-md border border-transparent">
                        <Link
                          href={`/projects?workspace=${ws.id}`}
                          onClick={closeOnNavigate}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"
                        >
                          <FolderClosed size={15} className="text-white/35" />
                          <span className="flex-1 truncate">{ws.name}</span>
                          <span className="text-[11px] text-white/30">
                            {ws._count?.projects ?? children.length}
                          </span>
                          <ChevronRight size={13} className="text-white/25" />
                        </Link>
                        {children.length ? (
                          <div className="mb-1 ml-5 space-y-0.5 border-l border-white/10 pl-2">
                            {children.slice(0, 5).map((project) => (
                              <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                onClick={closeOnNavigate}
                                className="block truncate rounded-sm px-2 py-1.5 text-xs text-white/40 hover:bg-white/5 hover:text-white"
                              >
                                {project.name}
                              </Link>
                            ))}
                            {children.length > 5 ? (
                              <Link
                                href={`/projects?workspace=${ws.id}`}
                                onClick={closeOnNavigate}
                                className="block px-2 py-1 text-[11px] text-white/30 hover:text-white"
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
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="px-3 py-1 text-[11px] text-white/30">项目搜索结果</p>
                  {filteredProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      onClick={closeOnNavigate}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white"
                    >
                      <ArrowRight size={14} className="text-white/35" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-3 px-1 py-1.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-indigo-600 text-sm font-semibold text-white">
              {(user?.name ?? "?").slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--paper-raised)]">{user?.name}</p>
              <p className="truncate text-xs text-white/35">{user?.email}</p>
            </div>
          </div>
          <div className="mt-1 space-y-0.5">
            <Link
              href="/settings"
              onClick={closeOnNavigate}
              className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"
            >
              <Settings2 size={16} className="text-white/35 group-hover:text-white/70" />
              <span className="flex-1">设置与组织</span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                成员、权限、系统
              </span>
            </Link>
            <Link
              href="/settings/profile"
              onClick={closeOnNavigate}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <UserRound size={15} className="text-white/35" />
              个人资料与姓名
            </Link>
            <Link
              href="/account/security"
              onClick={closeOnNavigate}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
            >
              <UserCog size={15} className="text-white/35" />
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
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white"
    >
      <LogOut size={15} className="text-white/35" />
      退出登录
    </button>
  );
}
