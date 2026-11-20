"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
type Version = { id: string; revision: number | null };
const secondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
const field =
  "min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20";
export function OfficeFileActions({
  documentId,
  title,
  role,
  versions,
  onRenamed,
  onCopy,
}: {
  documentId: string;
  title: string;
  role: string;
  versions: Version[];
  onRenamed: (title: string) => void;
  onCopy: (id: string) => void;
}) {
  const [name, setName] = useState(""),
    [expected, setExpected] = useState(""),
    [renaming, setRenaming] = useState(false);
  const [copyName, setCopyName] = useState(""),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  const intent = useRef<{ key: string; id: string } | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const saved = versions
    .filter((v) => v.revision)
    .sort((a, b) => Number(b.revision) - Number(a.revision));
  const version = saved.find((v) => v.id === selected) || saved[0],
    editable = ["OWNER", "EDITOR"].includes(role),
    base = "/office/" + documentId;
  const run = async (action: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(action);
    setMessage("");
    try {
      await work();
    } catch (e: any) {
      if (alive.current)
        setMessage(
          e.response?.status === 409
            ? "内容或名称已变化，请刷新核对后重试。"
            : e.response?.status === 429
              ? "已有导出任务，请稍后手动重试。"
              : "操作失败，请检查权限、网络或转换服务；没有自动重试。",
        );
    } finally {
      if (alive.current) setBusy("");
    }
  };
  return (
    <details
      data-office-file-actions
      className="group rounded-xl border border-slate-200 bg-white text-sm shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-medium text-slate-700">
        <span>文件操作 · 重命名、另存副本、PDF</span>
        <span className="text-slate-400 transition group-open:rotate-180" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-500">
          副本和 PDF 取自已确认的服务器版本，不包含编辑器里尚未保存的修改。需要最新内容时，先保存并等待版本号更新。
        </p>
        {editable && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">重命名</p>
            {!renaming ? (
              <button className={secondary} onClick={() => {
                setName(title);
                setExpected(title);
                setRenaming(true);
              }}>
                重命名文件
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Office 新文件名"
                  className={field + " max-w-full flex-1"}
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className={primary}
                  disabled={!!busy || !name.trim()}
                  onClick={() =>
                    void run("rename", async () => {
                      const r = await api.post(base + "/name", {
                        title: name,
                        expectedTitle: expected,
                      });
                      if (alive.current) {
                        onRenamed(r.data.title);
                        setRenaming(false);
                        setMessage("文件名已更新；编辑器内部标题在下次打开时同步。");
                      }
                    })
                  }
                >
                  确认重命名
                </button>
                <button className={secondary} disabled={!!busy} onClick={() => setRenaming(false)}>
                  取消
                </button>
              </div>
            )}
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-slate-500">PDF 导出</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Office 操作来源版本"
              className={field + " max-w-full"}
              value={version?.id || ""}
              disabled={!!busy || !version}
              onChange={(e) => {
                setSelected(e.target.value);
                intent.current = null;
              }}
            >
              {saved.map((v) => (
                <option key={v.id} value={v.id}>
                  服务器已确认 v{v.revision}
                </option>
              ))}
            </select>
            <button
              className={secondary}
              disabled={!!busy || !version}
              onClick={() =>
                void run("pdf", async () => {
                  const r = await api.post(
                    base + "/export/pdf",
                    { versionId: version.id },
                    { responseType: "blob", timeout: 40000 },
                  );
                  if (!alive.current) return;
                  const url = URL.createObjectURL(r.data),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = title.replace(/\.[^.]+$/, "") + "-v" + version.revision + ".pdf";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setMessage(
                    "已下载服务器 v" + version.revision + " 的PDF，可使用PDF阅读器打印。",
                  );
                })
              }
            >
              {busy === "pdf" ? "正在转换…" : "导出该版本PDF"}
            </button>
          </div>
        </div>
        {editable && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">另存私有副本</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Office 副本名称"
                placeholder="输入副本名称"
                className={field + " max-w-full flex-1"}
                maxLength={150}
                value={copyName}
                onChange={(e) => {
                  setCopyName(e.target.value);
                  intent.current = null;
                }}
              />
              <button
                className={primary}
                disabled={!!busy || !version || !copyName.trim()}
                onClick={() =>
                  void run("copy", async () => {
                    const key = version.id + ":" + copyName;
                    if (intent.current?.key !== key)
                      intent.current = { key, id: crypto.randomUUID() };
                    const r = await api.post(base + "/copy", {
                      title: copyName,
                      versionId: version.id,
                      requestId: intent.current.id,
                    });
                    if (alive.current) onCopy(r.data.id);
                  })
                }
              >
                {busy === "copy" ? "正在创建…" : "另存为私有副本"}
              </button>
            </div>
          </div>
        )}
        {message && (
          <p role="status" className="rounded-lg bg-indigo-50/70 px-2.5 py-2 text-[11px] leading-5 text-indigo-800">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
