"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  Button,
  Badge,
  Modal,
  Input,
  Textarea,
  Field,
  Select,
  Empty,
  InlineError,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const STATUS_TONE: Record<string, any> = {
  DRAFT: "slate",
  ACTIVE: "blue",
  DELIVERED: "green",
  ARCHIVED: "amber",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  DELIVERED: "已交付",
  ARCHIVED: "已归档",
};

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  _count: { projects: number };
};
type Project = {
  id: string;
  name: string;
  description: string | null;
  status: keyof typeof STATUS_LABEL;
  updatedAt: string;
  workspace: { id: string; name: string };
  owner: { id: string; name: string };
  _count: { tasks: number; files: number };
};

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">加载中…</div>}>
      <ProjectSpace />
    </Suspense>
  );
}

function ProjectSpace() {
  const router = useRouter();
  const params = useSearchParams();
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const org = useAuthStore((s) => s.currentOrgId);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const [projectOpen, setProjectOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", workspaceId: "" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const [wsName, setWsName] = useState("");
  const [wsDescription, setWsDescription] = useState("");
  const [wsBusy, setWsBusy] = useState(false);
  const [wsError, setWsError] = useState("");
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const handledLink = useRef("");

  const refresh = useCallback(async () => {
    const search = new URLSearchParams();
    if (workspaceFilter) search.set("workspaceId", workspaceFilter);
    if (statusFilter) search.set("status", statusFilter);
    try {
      const [ws, pj] = await Promise.all([
        hasPerm("workspace:list") ? api.get("/workspaces") : Promise.resolve({ data: [] }),
        api.get(`/projects${search.toString() ? `?${search.toString()}` : ""}`),
      ]);
      if (useAuthStore.getState().currentOrgId !== org) return;
      setWorkspaces(Array.isArray(ws.data) ? ws.data : []);
      setProjects(Array.isArray(pj.data) ? pj.data : pj.data.list || []);
      setError("");
    } catch (e: any) {
      setError(e.response?.data?.message ?? "项目空间加载失败，请检查权限或网络。");
    } finally {
      setLoading(false);
    }
  }, [org, workspaceFilter, statusFilter, hasPerm]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const changed = () => void refresh();
    window.addEventListener("collabspace:data-changed", changed);
    return () => window.removeEventListener("collabspace:data-changed", changed);
  }, [refresh]);

  useEffect(() => {
    if (!projectOpen || form.workspaceId || !workspaces.length) return;
    setForm((current) => ({ ...current, workspaceId: workspaces[0].id }));
  }, [projectOpen, form.workspaceId, workspaces]);

  const openCreate = useCallback(() => {
    setForm({ name: "", description: "", workspaceId: workspaces[0]?.id ?? "" });
    setFormError("");
    setProjectOpen(true);
  }, [workspaces]);

  useEffect(() => {
    const key = params.toString();
    if (key === handledLink.current) return;
    handledLink.current = key;
    if (params.get("new") === "project") openCreate();
    if (params.get("panel") === "workspaces") setPanelOpen(true);
    if (params.get("new") === "workspace") setPanelOpen(true);
    const ws = params.get("workspace");
    if (ws) setWorkspaceFilter(ws);
  }, [params, openCreate]);

  const createProject = async () => {
    setBusy(true);
    setFormError("");
    try {
      await api.post("/projects", form);
      setProjectOpen(false);
      setForm({ name: "", description: "", workspaceId: form.workspaceId });
      router.replace("/projects");
      await refresh();
    } catch (e: any) {
      setFormError(e.response?.data?.message ?? "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async () => {
    if (!wsName.trim()) return;
    setWsBusy(true);
    setWsError("");
    try {
      await api.post("/workspaces", { name: wsName, description: wsDescription });
      setWsName("");
      setWsDescription("");
      await refresh();
    } catch (e: any) {
      setWsError(e.response?.data?.message ?? "创建失败");
    } finally {
      setWsBusy(false);
    }
  };

  const saveWorkspace = async () => {
    if (!editingWs || !editName.trim()) return;
    setEditBusy(true);
    setEditError("");
    try {
      await api.patch(`/workspaces/${editingWs.id}`, {
        name: editName,
        description: editDescription,
      });
      setEditingWs(null);
      await refresh();
    } catch (e: any) {
      setEditError(e.response?.data?.message ?? "保存失败");
    } finally {
      setEditBusy(false);
    }
  };

  const removeWorkspace = async (workspace: Workspace) => {
    if (!confirm(`确认删除工作区「${workspace.name}」？工作区内必须没有项目。`)) return;
    try {
      await api.delete(`/workspaces/${workspace.id}`);
      if (workspaceFilter === workspace.id) setWorkspaceFilter("");
      await refresh();
    } catch (e: any) {
      setWsError(e.response?.data?.message ?? "删除失败");
    }
  };

  const transition = async (project: Project, action: "activate" | "deliver" | "archive") => {
    setError("");
    try {
      await api.post(`/projects/${project.id}/${action}`);
      await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message ?? "操作失败");
    }
  };

  const removeProject = async (project: Project) => {
    if (!confirm(`确认删除草稿「${project.name}」？`)) return;
    setError("");
    try {
      await api.delete(`/projects/${project.id}`);
      await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message ?? "删除失败");
    }
  };

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(term) ||
        (project.description ?? "").toLowerCase().includes(term) ||
        project.workspace.name.toLowerCase().includes(term),
    );
  }, [projects, query]);

  const activeCount = projects.filter((project) => project.status === "ACTIVE").length;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === workspaceFilter);

  return (
    <div className="page-enter mx-auto max-w-[1440px] px-4 py-8 md:px-10 md:py-12">
      <PageHeader
        eyebrow="Projects"
        title="项目空间"
        description="工作区与项目共用一个入口。按工作区分组，在一个页面完成创建、编辑、状态流转与交付。"
      >
        {hasPerm("workspace:list") ? (
          <Button variant="secondary" onClick={() => setPanelOpen(true)}>
            <Settings2 size={15} />
            管理工作区
          </Button>
        ) : null}
        {hasPerm("project:add") ? (
          <Button onClick={openCreate}>
            <Plus size={15} />
            新建项目
          </Button>
        ) : null}
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 border-y border-slate-300 md:grid-cols-4">
        {[
          { label: "当前视图项目", value: projects.length, icon: FolderKanban },
          { label: "进行中", value: activeCount, icon: ArrowUpRight },
          { label: "工作区", value: workspaces.length, icon: Layers },
          {
            label: "已交付",
            value: projects.filter((project) => project.status === "DELIVERED").length,
            icon: ArrowRight,
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`relative px-3 py-5 md:px-5 ${index ? "border-l border-slate-200" : ""}`}
            >
              <Icon size={14} className="text-slate-400" />
              <p className="display-title mt-3 text-[2.2rem] leading-none text-slate-900">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-5 border-b border-slate-300">
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <button
            type="button"
            onClick={() => setWorkspaceFilter("")}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition ${
              !workspaceFilter
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            全部工作区
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => setWorkspaceFilter(workspace.id)}
                className={`whitespace-nowrap rounded-sm px-3 py-1.5 text-sm transition ${
                  workspaceFilter === workspace.id
                    ? "border border-slate-900 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-white/70"
                }`}
                aria-pressed={workspaceFilter === workspace.id}
              >
                {workspace.name}
                <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                  {workspace._count.projects}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索项目或工作区"
              aria-label="搜索项目"
              className="w-56 py-2 pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="按状态筛选"
            className="w-32 py-2"
          >
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="ACTIVE">进行中</option>
            <option value="DELIVERED">已交付</option>
            <option value="ARCHIVED">已归档</option>
          </Select>
        </div>
      </div>

      <InlineErrorGroup message={error} />

      {loading ? (
        <p className="px-2 py-16 text-center text-sm text-slate-400">正在读取项目空间…</p>
      ) : visible.length === 0 ? (
        <div className="mt-4">
          <Empty
            text={
              currentWorkspace
                ? `「${currentWorkspace.name}」下还没有匹配的项目`
                : query
                  ? "没有匹配的项目，试试更短的关键词"
                  : "还没有项目，创建第一个交付项目吧"
            }
          />
          {hasPerm("project:add") ? (
            <div className="mt-3 flex justify-center">
              <Button onClick={openCreate}>
                <Plus size={15} /> 新建项目
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid gap-px overflow-hidden border border-slate-300 bg-slate-300 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project, index) => (
            <article
              key={project.id}
              className="group relative flex flex-col bg-[var(--paper-raised)] p-5 transition hover:bg-white"
            >
              <span className="absolute left-0 top-0 h-[2px] w-0 bg-indigo-600 transition-all duration-300 group-hover:w-full" />
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-slate-400">
                  P{String(index + 1).padStart(2, "0")}
                </span>
                <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
              </div>
              <Link
                href={`/projects/${project.id}`}
                className="display-title mt-5 text-[1.4rem] leading-tight text-slate-900 transition group-hover:text-indigo-700"
              >
                {project.name}
              </Link>
              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-6 text-slate-500">
                {project.description || "暂无描述"}
              </p>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                {project.workspace.name}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>负责人 {project.owner.name}</span>
                <span className="text-slate-300">/</span>
                <span>{project._count.tasks} 个任务</span>
                <span className="text-slate-300">/</span>
                <span>{project._count.files} 个文件</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-700"
                >
                  打开项目 <ArrowUpRight size={13} />
                </Link>
                <div className="flex items-center gap-1.5">
                  {project.status === "DRAFT" && hasPerm("project:edit") ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => transition(project, "activate")}
                    >
                      启动
                    </Button>
                  ) : null}
                  {project.status === "ACTIVE" && hasPerm("project:deliver") ? (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => transition(project, "deliver")}
                    >
                      交付
                    </Button>
                  ) : null}
                  {(project.status === "ACTIVE" || project.status === "DELIVERED") &&
                  hasPerm("project:edit") ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => transition(project, "archive")}
                    >
                      归档
                    </Button>
                  ) : null}
                  {project.status === "DRAFT" && hasPerm("project:remove") ? (
                    <Button size="sm" variant="danger" onClick={() => removeProject(project)}>
                      删除
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={projectOpen} onClose={() => setProjectOpen(false)} title="新建项目" wide>
        <div className="space-y-4">
          <Field label="所属工作区" hint="工作区在同一个项目空间中管理，不再单独占一个菜单。">
            <Select
              value={form.workspaceId}
              onChange={(event) => setForm({ ...form, workspaceId: event.target.value })}
            >
              {workspaces.length === 0 ? <option value="">请先创建工作区</option> : null}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </Select>
          </Field>
          {workspaces.length === 0 && hasPerm("workspace:add") ? (
            <Button
              variant="secondary"
              onClick={() => {
                setProjectOpen(false);
                setPanelOpen(true);
              }}
            >
              <Plus size={14} /> 去创建工作区
            </Button>
          ) : null}
          <Field label="项目名称">
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={64}
              placeholder="例如：客户官网改版"
            />
          </Field>
          <Field label="描述">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              maxLength={255}
              placeholder="交付目标、范围或关键联系人"
            />
          </Field>
          <InlineError message={formError} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProjectOpen(false)}>
              取消
            </Button>
            <Button
              onClick={createProject}
              disabled={busy || !form.name.trim() || !form.workspaceId}
            >
              {busy ? "创建中…" : "创建（草稿）"}
            </Button>
          </div>
        </div>
      </Modal>

      {panelOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="关闭工作区管理"
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
            onClick={() => setPanelOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="管理工作区"
            className="absolute inset-y-0 right-0 flex w-[440px] max-w-[94vw] flex-col border-l border-slate-200 bg-white shadow-2xl animate-[agent-dock-in_180ms_cubic-bezier(.2,.8,.2,1)]"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">管理工作区</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  工作区是项目的分组。删除前必须先清空其中的项目。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭工作区管理"
                onClick={() => setPanelOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {hasPerm("workspace:add") ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-700">新建工作区</p>
                  <div className="space-y-2">
                    <Input
                      value={wsName}
                      onChange={(event) => setWsName(event.target.value)}
                      placeholder="工作区名称"
                      aria-label="工作区名称"
                      maxLength={64}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void createWorkspace();
                      }}
                    />
                    <Textarea
                      value={wsDescription}
                      onChange={(event) => setWsDescription(event.target.value)}
                      placeholder="用途说明（可选）"
                      aria-label="工作区描述"
                      rows={2}
                      maxLength={255}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={createWorkspace}
                        disabled={wsBusy || !wsName.trim()}
                      >
                        {wsBusy ? "创建中…" : "创建工作区"}
                      </Button>
                    </div>
                  </div>
                  <InlineError message={wsError} />
                </div>
              ) : null}

              <div className="space-y-2">
                {workspaces.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    还没有工作区
                  </p>
                ) : (
                  workspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500">
                        <Layers size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {workspace.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {workspace.description || "无描述"} · {workspace._count.projects} 个项目
                        </p>
                        <Link
                          href={`/projects?workspace=${workspace.id}`}
                          onClick={() => setPanelOpen(false)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                        >
                          查看项目 <ArrowRight size={11} />
                        </Link>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {hasPerm("workspace:edit") ? (
                          <button
                            type="button"
                            aria-label={`编辑工作区 ${workspace.name}`}
                            onClick={() => {
                              setEditingWs(workspace);
                              setEditName(workspace.name);
                              setEditDescription(workspace.description ?? "");
                              setEditError("");
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        {hasPerm("workspace:remove") ? (
                          <button
                            type="button"
                            aria-label={`删除工作区 ${workspace.name}`}
                            onClick={() => void removeWorkspace(workspace)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Modal open={!!editingWs} onClose={() => setEditingWs(null)} title="编辑工作区">
        <div className="space-y-4">
          <Field label="名称">
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              maxLength={64}
            />
          </Field>
          <Field label="描述">
            <Textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={3}
              maxLength={255}
            />
          </Field>
          <InlineError message={editError} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingWs(null)}>
              取消
            </Button>
            <Button onClick={saveWorkspace} disabled={editBusy || !editName.trim()}>
              {editBusy ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InlineErrorGroup({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-700"
      role="alert"
    >
      {message}
    </p>
  );
}
