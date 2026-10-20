"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
export default function Documents({ params }: { params: { id: string } }) {
  const org = useAuthStore((s) => s.currentOrgId);
  const [docs, setDocs] = useState<any[]>([]),
    [title, setTitle] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setDocs([]);
    api
      .get("/documents", { params: { projectId: params.id } })
      .then((r) => {
        if (active) setDocs(r.data);
      })
      .catch(() => {
        if (active) setError("文档加载失败，请检查项目权限。");
      });
    return () => {
      active = false;
    };
  }, [params.id, org]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/documents", {
        projectId: params.id,
        title,
      });
      setDocs((d) => [data, ...d]);
      setTitle("");
      setError("");
    } catch (e: any) {
      setError(e.response?.data?.message || "创建失败");
    }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <Link className="text-sm text-blue-600" href={`/projects/${params.id}`}>
        ← 返回项目
      </Link>
      <div>
        <p className="text-sm text-slate-500">
          CollabSpace / Project documents
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          一起写清楚，再开始交付。
        </h1>
        <p className="mt-2 text-slate-500">
          需求、技术决策与交付记录，和团队保持同一份上下文。
        </p>
      </div>
      <form onSubmit={create} className="flex gap-3">
        <input
          aria-label="新文档标题"
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例如：客户门户 · 交付说明"
          className="flex-1 rounded-lg border p-3"
        />
        <button className="rounded-lg bg-slate-900 px-5 text-white">
          创建文档
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="divide-y rounded-xl border bg-white">
        {!docs.length && (
          <p className="p-8 text-slate-500">
            还没有你可访问的文档。创建第一份，或请负责人授予访问权限。
          </p>
        )}
        {docs.map((d) => (
          <Link
            href={`/projects/${params.id}/documents/${d.id}`}
            key={d.id}
            className="flex items-center justify-between p-5 hover:bg-slate-50"
          >
            <div>
              <h2 className="font-medium">{d.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {d.role} · {d.status === "ARCHIVED" ? "已归档" : "可协作"}
              </p>
            </div>
            <span className="text-slate-400">打开 →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
