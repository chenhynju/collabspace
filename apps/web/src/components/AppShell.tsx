"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, ChevronDown, Command, Menu, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePersonalNotifications } from "@/lib/use-personal-notifications";
import NavDrawer from "@/components/NavDrawer";
import AgentDock from "@/components/AgentDock";
import { PRIMARY_NAV, canSee, isNavItemActive } from "@/components/navigation";

const IMMERSIVE = /^\/office\/[^/]+$|^\/projects\/[^/]+\/documents\/[^/]+$/;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const immersive = IMMERSIVE.test(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [orgMenu, setOrgMenu] = useState(false);
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const logout = useAuthStore((s) => s.logout);
  const { count } = usePersonalNotifications();
  const orgButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNavOpen(false);
    setAgentOpen(false);
    setOrgMenu(false);
  }, [pathname]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAgentOpen(false);
        setNavOpen(true);
      }
      if (meta && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setNavOpen(false);
        setAgentOpen(true);
      }
    };
    const openAgent = () => setAgentOpen(true);
    const openNav = () => setNavOpen(true);
    document.addEventListener("keydown", keydown);
    window.addEventListener("collabspace:open-agent", openAgent);
    window.addEventListener("collabspace:open-nav", openNav);
    return () => {
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("collabspace:open-agent", openAgent);
      window.removeEventListener("collabspace:open-nav", openNav);
    };
  }, []);

  useEffect(() => {
    if (!orgMenu) return;
    const click = (event: MouseEvent) => {
      if (!orgButton.current?.contains(event.target as Node)) setOrgMenu(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOrgMenu(false);
    };
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", esc);
    };
  }, [orgMenu]);

  const switchOrg = async (id: string) => {
    setOrgMenu(false);
    if (id === currentOrgId) return;
    await setCurrentOrg(id);
    router.push("/dashboard");
    router.refresh();
  };

  const org = organizations.find((item) => item.id === currentOrgId);

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      {!immersive ? (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:px-5">
            <button
              type="button"
              aria-label={navOpen ? "收起导航" : "打开导航"}
              aria-expanded={navOpen}
              aria-controls="app-navigation"
              onClick={() => setNavOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Menu size={19} />
              <span className="hidden sm:inline">菜单</span>
            </button>

            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1"
              aria-label="CollabSpace 首页"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
                <span className="block h-3.5 w-3.5 rounded-[4px] border-2 border-white/90" />
              </span>
              <span className="hidden text-[15px] font-semibold tracking-tight text-slate-900 md:inline">
                CollabSpace
              </span>
            </Link>

            <div ref={orgButton} className="relative min-w-0">
              <button
                type="button"
                aria-label="切换组织"
                aria-expanded={orgMenu}
                onClick={() => setOrgMenu((value) => !value)}
                className="flex max-w-[132px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:max-w-[190px]"
              >
                <Building2 size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{org?.name ?? "选择组织"}</span>
                <ChevronDown size={13} className="shrink-0 text-slate-400" />
              </button>
              {orgMenu ? (
                <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10">
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    当前组织
                  </p>
                  {organizations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void switchOrg(item.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                        item.id === currentOrgId
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Building2
                        size={14}
                        className={item.id === currentOrgId ? "text-white/70" : "text-slate-400"}
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setOrgMenu(false);
                      logout();
                      router.push("/login");
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>

            <nav aria-label="主导航" className="ml-2 hidden items-center gap-0.5 lg:flex">
              {PRIMARY_NAV.filter((item) => canSee(hasPerm, item)).map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="搜索菜单、工作区和项目"
                className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 transition hover:border-slate-300 hover:text-slate-600 md:flex"
              >
                <Command size={13} />
                <span>搜索</span>
                <kbd className="rounded-md bg-slate-100 px-1.5 py-0.5 font-sans text-[10px] text-slate-500">
                  ⌘K
                </kbd>
              </button>
              <Link
                href="/notifications"
                aria-label={`通知中心${count ? `，${count} 条未读` : ""}`}
                className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Bell size={18} />
                {count ? (
                  <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                onClick={() => setAgentOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800"
                aria-label="打开 AI 工作助理"
              >
                <Sparkles size={14} className="text-indigo-300" />
                <span className="hidden sm:inline">AI 助理</span>
              </button>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="打开工作台菜单和账号"
                className="ml-0.5 grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200 transition hover:bg-indigo-200"
              >
                {(user?.name ?? "?").slice(0, 1)}
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <main className="min-w-0">{children}</main>

      {immersive && !pathname.startsWith("/office/") ? (
        <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2">
          <button
            type="button"
            aria-label={navOpen ? "收起导航" : "打开导航"}
            aria-expanded={navOpen}
            aria-controls="app-navigation"
            onClick={() => setNavOpen((value) => !value)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white/95 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:text-slate-900"
          >
            <Menu size={19} />
          </button>
          <button
            type="button"
            aria-label="打开 AI 工作助理"
            onClick={() => setAgentOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
          >
            <Sparkles size={18} />
          </button>
        </div>
      ) : null}

      <NavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onOpenAgent={() => setAgentOpen(true)}
      />
      <AgentDock open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
