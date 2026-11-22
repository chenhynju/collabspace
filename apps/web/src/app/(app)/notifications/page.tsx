"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ArrowUpRight, MessageSquare } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button, Empty, InlineError } from "@/components/ui";
import { api } from "@/lib/api";
import { usePersonalNotifications } from "@/lib/use-personal-notifications";
import { useAuthStore } from "@/store/auth";
const status: Record<string, string> = {
  PENDING: "待处理",
  ACCEPTED: "已接受",
  DECLINED: "已拒绝",
  REVOKED: "已撤销",
  EXPIRED: "已过期",
};
export default function NotificationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  const load = useCallback(() => {
    const token = useAuthStore.getState().token;
    api
      .get("/notifications")
      .then(({ data }) => {
        if (useAuthStore.getState().token === token) {
          setRows(data);
          setError("");
        }
      })
      .catch(() => setError("通知加载失败，请稍后重试"));
  }, []);
  const { count, refresh } = usePersonalNotifications(load);
  const read = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      load();
      refresh();
      window.dispatchEvent(new Event("personal-notifications:refresh"));
    } catch {
      setError("未能标记已读，请重试");
    }
  };
  const openMention = async (n: any) => {
    try {
      if (n.organization_id && n.organization_id !== useAuthStore.getState().currentOrgId)
        await useAuthStore.getState().setCurrentOrg(n.organization_id);
      if (!n.read_at) await read(n.id);
      if (n.link) router.push(n.link);
    } catch {
      setError("通知定位失败，请手动打开对应文档");
    }
  };
  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-10">
      <PageHeader
        eyebrow="Notifications"
        title="通知中心"
        description="属于你的邀请与处理结果，切换组织后仍可查看。"
      >
        <span className="rounded-sm border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
          {count} 条未读
        </span>
      </PageHeader>
      <InlineError message={error} />
      {!rows.length ? (
        <Empty text="暂无通知，收到组织邀请后会显示在这里" />
      ) : (
        <div className="border-t border-slate-300">
          {rows.map((n) => (
            <article
              key={n.id}
              className={`flex gap-4 border-b border-slate-200 py-5 ${
                n.read_at ? "opacity-70" : ""
              }`}
            >
              <div
                className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-sm ${
                  n.read_at ? "bg-slate-200 text-slate-400" : "bg-indigo-600 text-white"
                }`}
              >
                {n.kind === "board_mention" ? <MessageSquare size={16} /> : <Bell size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="display-title text-lg text-slate-900">{n.title}</h2>
                  {!n.read_at && <span className="h-1.5 w-1.5 bg-indigo-600" />}
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(n.created_at).toISOString().replace("T", " ").slice(0, 16)} UTC
                  </span>
                </div>
                <p className="mt-1 break-words text-sm leading-6 text-slate-500">{n.body}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {n.kind === "board_mention" ? (
                    <>
                      <span className="text-xs text-slate-500">图元评论 · 提到你</span>
                      {n.link && (
                        <button
                          type="button"
                          onClick={() => void openMention(n)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline"
                        >
                          打开并定位
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-500">
                        {
                          status[
                            n.invitation_status === "PENDING" &&
                            new Date(n.expires_at) < new Date()
                              ? "EXPIRED"
                              : n.invitation_status
                          ]
                        }
                      </span>
                      {n.event === "RECEIVED" && (
                        <Link
                          href={`/invite/accept?id=${encodeURIComponent(n.invitation_id)}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:underline"
                        >
                          查看邀请
                          <ArrowUpRight size={14} />
                        </Link>
                      )}
                    </>
                  )}
                  {!n.read_at && (
                    <Button variant="ghost" size="sm" onClick={() => read(n.id)}>
                      <CheckCheck size={14} />
                      标记已读
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
