'use client';
import {usePersonalNotifications} from '@/lib/use-personal-notifications';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard, Users, UserCog, FolderKanban, FileText, Files,
  ScrollText, LogOut, Building2, Network, MessageSquare,
  Bell, Menu as MenuIcon, BookOpen, SlidersHorizontal, LogIn as LogInIcon,
  Wifi, Server, Database, Clock, HardDrive,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      { href: '/dashboard', label: '概览', icon: LayoutDashboard, perm: 'dashboard:view' },
    ],
  },
  {
    label: '项目协同',
    items: [
      { href: '/workspaces', label: '工作区', icon: FolderKanban, perm: 'workspace:list' },
      { href: '/projects', label: '项目', icon: FileText, perm: 'project:list' },
      { href: '/collaboration', label: '协作空间', icon: BookOpen, perm: 'project:list' },
      { href: '/files', label: '附件管理', icon: Files, perm: 'file:manage' },
      { href: '/im', label: '消息', icon: MessageSquare, perm: 'im:view' },
    ],
  },
  {
    label: '组织管理',
    items: [
      { href: '/members', label: '成员', icon: Users, perm: 'member:list' },
      { href: '/invitations', label: '邀请', icon: UserCog, perm: 'invite:list' },
      { href: '/depts', label: '部门岗位', icon: Network, perm: 'dept:manage' },
      { href: '/roles', label: '角色权限', icon: UserCog, perm: 'role:list' },
    ],
  },
  {
    label: '系统管理',
    items: [
      { href: '/notices', label: '通知公告', icon: Bell, perm: 'notice:list' },
      { href: '/system/menus', label: '菜单管理', icon: MenuIcon, perm: 'menu:list' },
      { href: '/system/dicts', label: '字典管理', icon: BookOpen, perm: 'dict:list' },
      { href: '/system/configs', label: '参数设置', icon: SlidersHorizontal, perm: 'config:list' },
      { href: '/system/login-logs', label: '登录日志', icon: LogInIcon, perm: 'logininfor:list' },
      { href: '/audit', label: '审计日志', icon: ScrollText, perm: 'audit:list' },
    ],
  },
  {
    label: '系统监控',
    items: [
      { href: '/monitor/online', label: '在线用户', icon: Wifi, perm: 'monitor:online:list' },
      { href: '/monitor/server', label: '服务监控', icon: Server, perm: 'monitor:server:view' },
      { href: '/monitor/cache', label: '缓存监控', icon: Database, perm: 'monitor:cache:view' },
      { href: '/monitor/jobs', label: '定时任务', icon: Clock, perm: 'monitor:job:list' },
      { href: '/monitor/database', label: '数据库会话', icon: HardDrive, perm: 'monitor:db:view' },
    ],
  },
];

export default function Sidebar() {
  const {count}=usePersonalNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const organizations = useAuthStore((s) => s.organizations);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
  const logout = useAuthStore((s) => s.logout);
  const hasPerm = useAuthStore((s) => s.hasPerm);

  const switchOrg = async (id: string) => {
    await setCurrentOrg(id);
    router.refresh();
  };

  return (
    <aside className="w-[220px] bg-[#131b2d] text-slate-100 h-dvh flex flex-col shrink-0 border-r border-white/5">
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-indigo-400" />
          <span className="font-semibold text-xl tracking-tight">CollabSpace</span>
        </div>
      </div>

      {/* 组织切换 */}
      <div className="p-3 border-b border-slate-800">
        <select
          value={currentOrgId || ''}
          onChange={(e) => switchOrg(e.target.value)}
          className="w-full bg-white/5 text-slate-200 text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        <Link href="/notifications" aria-current={pathname==='/notifications'?'page':undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${pathname==='/notifications'?'bg-indigo-600 text-white':'text-slate-300 hover:bg-white/5'}`}><Bell className="h-4 w-4"/>通知中心{count>0&&<span className="ml-auto rounded-full bg-indigo-500 px-2 py-0.5 text-xs text-white">{count>99?'99+':count}</span>}</Link>
        {GROUPS.map((group, gi) => {
          const items = group.items.filter((item) => hasPerm(item.perm));
          if (!items.length) return null;
          return (
            <details key={gi} open={gi<2?true:undefined} className="group space-y-0.5">
              {!group.label&&<summary className="hidden">概览</summary>}
              {group.label && (
                <summary className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200">
                  {group.label}
                </summary>
              )}
              {items.map((item) => {
                const inContent = /^\/projects\/[^/]+\/(content|documents|boards)(\/|$)/.test(pathname) || pathname.startsWith('/office/');
                const active = item.href === '/collaboration' ? pathname === item.href || pathname === '/assistant' || inContent : item.href === '/projects' ? (pathname === item.href || pathname.startsWith(item.href + "/")) && !inContent : pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </details>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="text-sm text-slate-200 mb-1 truncate">{user?.name}</div>
        <div className="text-xs text-slate-500 mb-2 truncate">{user?.email}</div>
        <Link href="/account/security" className="mb-2 block text-sm text-slate-300 hover:text-white">账号安全 · 修改密码</Link>
        <button
          onClick={() => {
            logout();
            router.push('/login');
          }}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <LogOut className="w-4 h-4" /> 退出登录
        </button>
      </div>
    </aside>
  );
}
