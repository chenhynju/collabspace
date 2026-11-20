import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  MessageSquare,
  Files,
  Bell,
  Users,
  UserCog,
  Network,
  ScrollText,
  SlidersHorizontal,
  LogIn,
  Wifi,
  Server,
  Database,
  Clock,
  HardDrive,
  CreditCard,
  Menu as MenuIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: string;
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * 第一公民：每天真正会用的协作能力。
 * 项目与工作区合并为一个「项目空间」入口，CRUD 在页面内完成。
 */
export const CORE_NAV: NavGroup[] = [
  {
    label: "工作台",
    items: [
      { href: "/dashboard", label: "概览", icon: LayoutDashboard, perm: "dashboard:view" },
      {
        href: "/projects",
        label: "项目空间",
        icon: FolderKanban,
        perm: "project:list",
        hint: "工作区、项目与交付",
      },
      {
        href: "/collaboration",
        label: "协作空间",
        icon: BookOpen,
        perm: "project:list",
        hint: "文档、白板、Office 与 AI 助手",
      },
      {
        href: "/im",
        label: "消息",
        icon: MessageSquare,
        perm: "im:view",
        hint: "团队沟通与会议",
      },
      { href: "/files", label: "附件", icon: Files, perm: "file:manage" },
      { href: "/notifications", label: "通知中心", icon: Bell, perm: "" },
    ],
  },
];

/** 管理与系统能力：收进「设置」，不再占据主导航。 */
export const SETTINGS_NAV: NavGroup[] = [
  {
    label: "组织",
    items: [
      { href: "/members", label: "成员", icon: Users, perm: "member:list" },
      { href: "/invitations", label: "邀请", icon: UserCog, perm: "invite:list" },
      { href: "/depts", label: "部门与岗位", icon: Network, perm: "dept:manage" },
      { href: "/roles", label: "角色权限", icon: UserCog, perm: "role:list" },
      { href: "/billing", label: "套餐与账单", icon: CreditCard, perm: "billing:view" },
    ],
  },
  {
    label: "治理",
    items: [
      { href: "/audit", label: "审计日志", icon: ScrollText, perm: "audit:list" },
      { href: "/notices", label: "通知公告", icon: Bell, perm: "notice:list" },
    ],
  },
  {
    label: "系统",
    items: [
      { href: "/system/menus", label: "菜单管理", icon: MenuIcon, perm: "menu:list" },
      { href: "/system/dicts", label: "字典管理", icon: BookOpen, perm: "dict:list" },
      { href: "/system/configs", label: "参数设置", icon: SlidersHorizontal, perm: "config:list" },
      { href: "/system/login-logs", label: "登录日志", icon: LogIn, perm: "logininfor:list" },
    ],
  },
  {
    label: "监控",
    items: [
      { href: "/monitor/online", label: "在线用户", icon: Wifi, perm: "monitor:online:list" },
      { href: "/monitor/server", label: "服务监控", icon: Server, perm: "monitor:server:view" },
      { href: "/monitor/cache", label: "缓存监控", icon: Database, perm: "monitor:cache:view" },
      { href: "/monitor/jobs", label: "定时任务", icon: Clock, perm: "monitor:job:list" },
      { href: "/monitor/database", label: "数据库会话", icon: HardDrive, perm: "monitor:db:view" },
    ],
  },
];

export const NAV_GROUPS = CORE_NAV;

/** 顶栏只保留四个高频目的地；其余收进抽屉与设置。 */
export const PRIMARY_NAV: NavItem[] = [
  CORE_NAV[0].items[0],
  CORE_NAV[0].items[1],
  CORE_NAV[0].items[2],
  CORE_NAV[0].items[3],
];

export function isNavItemActive(pathname: string, item: NavItem) {
  const inContent =
    /^\/projects\/[^/]+\/(content|documents|boards)(\/|$)/.test(pathname) ||
    pathname.startsWith("/office/");
  if (item.href === "/collaboration") {
    return pathname === item.href || pathname === "/assistant" || inContent;
  }
  if (item.href === "/projects") {
    return (pathname === item.href || pathname.startsWith(item.href + "/")) && !inContent;
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function canSee(hasPerm: (p: string) => boolean, item: NavItem) {
  return !item.perm || hasPerm(item.perm);
}
