"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Building2, ChevronDown, Command, Menu, Sparkles } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { usePersonalNotifications } from "@/lib/use-personal-notifications";
import NavDrawer from "@/components/NavDrawer";
import AgentDock from "@/components/AgentDock";
import GlobalSearch from "@/components/GlobalSearch";
import { PRIMARY_NAV, canSee, isNavItemActive } from "@/components/navigation";

const IMMERSIVE = /^\/office\/[^/]+$|^\/projects\/[^/]+\/documents\/[^/]+$/;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const immersive = IMMERSIVE.test(pathname);
  const [navOpen, setNavOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
    setSearchOpen(false);
    setOrgMenu(false);
  }, [pathname]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAgentOpen(false);
        setNavOpen(false);
        setSearchOpen(true);
      }
      if (meta && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setNavOpen(false);
        setSearchOpen(false);
        setAgentOpen(true);
      }
    };
    const openAgent = () => {
      setSearchOpen(false);
      setAgentOpen(true);
    };
    const openNav = () => {
      setSearchOpen(false);
      setNavOpen(true);
    };
    const openSearch = () => {
      setNavOpen(false);
      setAgentOpen(false);
      setSearchOpen(true);
    };
    document.addEventListener("keydown", keydown);
    window.addEventListener("collabspace:open-agent", openAgent);
    window.addEventListener("collabspace:open-nav", openNav);
    window.addEventListener("collabspace:open-search", openSearch);
    return () => {
      document.removeEventListener("keydown", keydown);
      window.removeEventListener("collabspace:open-agent", openAgent);
      window.removeEventListener("collabspace:open-nav", openNav);
      window.removeEventListener("collabspace:open-search", openSearch);
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
    <div className="min-h-screen">
      {!immersive ? (
        <header className="sticky top-0 z-40 border-b border-slate-300/80 bg-[#f4efe5]/92 backdrop-blur-md">
          <div aria-hidden="true" className="h-[3px] bg-indigo-600" />
          <div className="mx-auto flex h-[61px] max-w-[1600px] items-center gap-2 px-3 sm:px-5">
            <button
              type="button"
              aria-label={navOpen ? "收起导航" : "打开导航"}
              aria-expanded={navOpen}
              aria-controls="app-navigation"
              onClick={() => setNavOpen((value) => !value)}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-900 hover:text-white"
            >
              <Menu size={18} />
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] sm:inline">
                菜单
              </span>
            </button>

            <Link
              href="/dashboard"
              className="group flex shrink-0 items-center gap-2.5 rounded-md px-1.5 py-1"
              aria-label="CollabSpace 首页"
            >
              <span className="grid h-8 w-8 place-items-center rounded-sm bg-slate-900 transition group-hover:bg-indigo-600">
                <span className="block h-3 w-3 border-2 border-[#f4efe5]" />
              </span>
              <span className="hidden items-baseline gap-2 md:flex">
                <span className="display-title text-[19px] leading-none text-slate-900">
                  CollabSpace
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Atelier
                </span>
              </span>
            </Link>

            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-slate-300 sm:block" />

            <div ref={orgButton} className="relative min-w-0">
              <button
                type="button"
                aria-label="切换组织"
                aria-expanded={orgMenu}
                onClick={() => setOrgMenu((value) => !value)}
                className="flex max-w-[132px] items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 sm:max-w-[190px]"
              >
                <Building2 size={13} className="shrink-0 text-indigo-600" />
                <span className="truncate">{org?.name ?? "选择组织"}</span>
                <ChevronDown size={12} className="shrink-0 text-slate-400" />
              </button>
              {orgMenu ? (
                <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-slate-300 bg-[#fffdf7] p-1.5 shadow-xl shadow-slate-900/15">
                  <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    当前组织
                  </p>
                  {organizations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void switchOrg(item.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition ${
                        item.id === currentOrgId
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Building2
                        size={14}
                        className={item.id === currentOrgId ? "text-white/60" : "text-slate-400"}
                      />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                  <div className="my-1 h-px bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setOrgMenu(false);
                      logout();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>

            <nav aria-label="主导航" className="ml-3 hidden h-[61px] items-stretch gap-0.5 lg:flex">
              {PRIMARY_NAV.filter((item) => canSee(hasPerm, item)).map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative inline-flex items-center px-3.5 text-[13px] font-medium tracking-tight transition ${
                      active
                        ? "text-slate-900"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                    {active ? (
                      <span className="absolute inset-x-2 bottom-0 h-[2px] bg-indigo-600" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="打开全局搜索"
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/60 px-2.5 py-2 text-xs text-slate-500 transition hover:border-slate-900 hover:text-slate-900"
              >
                <Command size={13} />
                <span className="hidden md:inline">全局搜索</span>
                <kbd className="hidden rounded-sm border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 md:inline">
                  ⌘K
                </kbd>
              </button>
              <Link
                href="/notifications"
                aria-label={`通知中心${count ? `，${count} 条未读` : ""}`}
                className="relative rounded-md p-2.5 text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900"
              >
                <Bell size={18} />
                {count ? (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                onClick={() => setAgentOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-violet-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-900"
                aria-label="打开 AI 工作助理"
              >
                <Sparkles size={14} className="text-amber-300" />
                <span className="hidden sm:inline">AI 助理</span>
              </button>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="打开工作台菜单和账号"
                className="ml-0.5 grid h-9 w-9 place-items-center rounded-md bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700"
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
            className="grid h-11 w-11 place-items-center rounded-lg border border-slate-300 bg-[#fffdf7]/95 text-slate-600 shadow-lg shadow-slate-900/10 backdrop-blur transition hover:border-slate-900 hover:text-slate-900"
          >
            <Menu size={19} />
          </button>
          <button
            type="button"
            aria-label="打开 AI 工作助理"
            onClick={() => setAgentOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-lg bg-violet-800 text-white shadow-lg shadow-slate-900/20 transition hover:bg-violet-900"
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
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
