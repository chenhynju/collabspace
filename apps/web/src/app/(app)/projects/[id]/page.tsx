"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Field,
  Empty,
  Modal,
  InlineError,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useProjectRealtime } from "@/lib/use-realtime";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  DELIVERED: "已交付",
  ARCHIVED: "已归档",
};
const STATUS_TONE: Record<string, any> = {
  DRAFT: "slate",
  ACTIVE: "blue",
  DELIVERED: "green",
  ARCHIVED: "amber",
};
const TASK_LABEL: Record<string, string> = {
  TODO: "待办",
  IN_PROGRESS: "进行中",
  DONE: "已完成",
};
const TASK_NEXT: Record<string, string> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const hasPerm = useAuthStore((s) => s.hasPerm);
  const currentOrgId = useAuthStore((s) => s.currentOrgId);
  const [project, setProject] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [shareFor, setShareFor] = useState<any | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/projects/${params.id}`);
      setProject(data);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message || "项目加载失败");
    }
  }, [params.id]);

  // 实时协作：在线 presence + 他人改动任务时自动刷新
  const { presence, connected } = useProjectRealtime(currentOrgId, params.id, refresh);

  useEffect(() => {
    refresh();
    api
      .get("/members")
      .then((r) => setMembers(r.data))
      .catch(() => setMembers([]));
  }, [refresh]);

  if (!project) {
    if (error) {
      return <div className="p-8 text-sm text-red-500">{error}</div>;
    }
    return <div className="p-8 text-sm text-slate-400">加载中…</div>;
  }

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      await api.post("/tasks", {
        projectId: project.id,
        title: taskTitle,
        assigneeId: taskAssignee || undefined,
      });
      setTaskTitle("");
      await refresh();
    } catch (e: any) {
      alert(e.response?.data?.message ?? "创建失败");
    }
  };

  const cycleTask = async (t: any) => {
    await api.patch(`/tasks/${t.id}`, { status: TASK_NEXT[t.status] });
    await refresh();
  };

  const download = async (fileId: string) => {
    const res = await api.get(`/files/${fileId}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
    URL.revokeObjectURL(url);
  };

  const createShare = async () => {
    setError(null);
    try {
      const { data } = await api.post(`/files/${shareFor.id}/share`, { ttlDays: 7 });
      setShareUrl(data.url);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "共享失败");
    }
  };

  return (
    <div className="page-enter mx-auto max-w-[1440px] px-4 py-8 md:px-10 md:py-10">
      <PageHeader eyebrow="Project" title={project.name}>
        <Link
          href={`/projects/${params.id}/content`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600"
        >
          协作空间 · 新建 / 上传
        </Link>
        <PresenceBar presence={presence} connected={connected} />
        <Link href="/projects">
          <Button variant="secondary">返回列表</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* 左：信息 + 文件 */}
        <div className="space-y-5 lg:col-span-1">
          <Card className="space-y-3 p-5 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
            </div>
            <Info label="工作区" value={project.workspace.name} />
            <Info label="负责人" value={project.owner.name} />
            <p className="leading-6 text-slate-500">{project.description || "（无描述）"}</p>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="eyebrow">Files</p>
                <h2 className="display-title mt-1 text-lg text-slate-900">附件与交付文件</h2>
              </div>
              {hasPerm("file:manage") ? (
                <Link
                  className="text-xs font-medium text-indigo-700 hover:underline"
                  href={`/projects/${params.id}/content`}
                >
                  新建 / 上传
                </Link>
              ) : null}
            </div>
            {project.files.length === 0 ? (
              <p className="text-xs text-slate-400">暂无文件</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {project.files.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="truncate text-slate-700">
                      {f.name}
                      <span className="ml-1 font-mono text-[10px] text-slate-400">v{f.version}</span>
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {/\.(docx|xlsx|pptx)$/i.test(f.name) && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              const r = await api.post(`/office/files/${f.id}/open`);
                              window.location.href = "/office/" + r.data.id;
                            } catch (e: any) {
                              setError(
                                e.response?.data?.code === "OFFICE_NOT_CONFIGURED"
                                  ? "Office 编辑服务尚未配置：请启动 ONLYOFFICE DocumentServer，并在服务端配置 OFFICE_PUBLIC_URL、OFFICE_INTERNAL_URL、OFFICE_JWT_SECRET、OFFICE_CAPABILITY_SECRET。"
                                  : "无法打开 Office 文件，请检查服务配置、上传者和文件权限。",
                              );
                            }
                          }}
                        >
                          在线编辑
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => download(f.id)}>
                        下载
                      </Button>
                      {hasPerm("file:share") && !f.officeId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShareFor(f);
                            setShareUrl("");
                            setError(null);
                          }}
                        >
                          共享
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 右：任务 */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow">Tasks</p>
              <h2 className="display-title mt-1 text-lg text-slate-900">任务看板</h2>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {project.tasks.length} items
            </span>
          </div>
          {hasPerm("task:manage") ? (
            <div className="mb-4 flex gap-2">
              <Input
                placeholder="新增任务标题，回车创建"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                className="flex-1"
              />
              <Select
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                className="w-36"
              >
                <option value="">不指派</option>
                {members.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.user.name}
                  </option>
                ))}
              </Select>
              <Button onClick={addTask}>添加</Button>
            </div>
          ) : null}

          {project.tasks.length === 0 ? (
            <Empty text="暂无任务" />
          ) : (
            <div className="divide-y divide-slate-200 border-t border-slate-300">
              {project.tasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm ${t.status === "DONE" ? "text-slate-400 line-through" : "text-slate-800"}`}
                    >
                      {t.title}
                    </span>
                    {t.assignee ? (
                      <span className="text-xs text-slate-400">@{t.assignee.name}</span>
                    ) : null}
                  </div>
                  {hasPerm("task:manage") ? (
                    <Button size="sm" variant="secondary" onClick={() => cycleTask(t)}>
                      {TASK_LABEL[t.status]}
                    </Button>
                  ) : (
                    <Badge>{TASK_LABEL[t.status]}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!shareFor}
        onClose={() => setShareFor(null)}
        title={`共享「${shareFor?.name ?? ""}」`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            将生成一个有效期 7 天的访客链接，无需登录即可下载。
          </p>
          <InlineError message={error} />
          {shareUrl ? (
            <Field label="共享链接（复制发送）">
              <Input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            </Field>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={createShare}>生成共享链接</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** 在线成员条：连接状态点 + 重叠头像（首字）+ 人数 */
function PresenceBar({
  presence,
  connected,
}: {
  presence: { userId: string; name: string; color: string }[];
  connected: boolean;
}) {
  return (
    <div className="mr-2 flex items-center gap-2">
      <span
        className={`h-2 w-2 ${connected ? "bg-violet-700" : "bg-slate-300"}`}
        title={connected ? "实时连接中" : "实时未连接"}
      />
      <div className="flex -space-x-1.5">
        {presence.map((u) => (
          <span
            key={u.userId}
            title={u.name}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-xs text-white ring-2 ring-[var(--paper)]"
            style={{ background: u.color }}
          >
            {u.name.slice(0, 1)}
          </span>
        ))}
      </div>
      <span className="text-xs text-slate-500">{presence.length} 人在线</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}
