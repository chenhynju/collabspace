"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as Dialog from "@radix-ui/react-dialog";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import LinkExtension from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import { DocumentProvider, from64 } from "@/lib/document-provider";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { BoardPreview } from '@/components/boards/Whiteboard';
const Whiteboard = dynamic(()=>import('@/components/boards/Whiteboard'),{ssr:false});
const DocumentEditor = dynamic(
  () => import("@/components/documents/DocumentEditor"),
  { ssr: false },
);
function Preview({ state }: { state: string }) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: false,
      extensions: [
        StarterKit,
        TaskList,
        TaskItem,
        LinkExtension.configure({ openOnClick: false }),
      ],
      content: (() => {
        const d = new Y.Doc();
        Y.applyUpdate(d, from64(state));
        const json = yXmlFragmentToProsemirrorJSON(d.getXmlFragment("default"));
        d.destroy();
        return json;
      })(),
      editorProps: {
        attributes: {
          class: "collab-editor",
          "aria-label": "历史版本只读预览",
        },
      },
    },
    [state],
  );
  return <EditorContent editor={editor} />;
}
export default function DocumentPage({
  params,
}: {
  params: { id: string; docId: string };
}) {
  const org = useAuthStore((s) => s.currentOrgId),
    user = useAuthStore((s) => s.user);
  const [meta, setMeta] = useState<any>(null),
    [provider, setProvider] = useState<DocumentProvider | null>(null),
    [status, setStatus] = useState("正在连接"),
    [people, setPeople] = useState<any[]>([]),
    [tab, setTab] = useState("comments"),
    [threads, setThreads] = useState<any[]>([]),
    [versions, setVersions] = useState<any[]>([]),
    [body, setBody] = useState(""),
    [selection, setSelection] = useState<any>(null),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [grants, setGrants] = useState<any[]>([]),
    [members, setMembers] = useState<any[]>([]),
    [target, setTarget] = useState(""),
    [role, setRole] = useState("EDITOR"),
    [versionName, setVersionName] = useState(""),
    [busy, setBusy] = useState(false);
  const base = `/documents/${params.docId}`;
  const onReady = useCallback((p: DocumentProvider) => setProvider(p), []);
  useEffect(() => {
    if (!provider) return;
    const update = () => {
      setStatus(provider.status);
      setPeople(provider.members);
    };
    update();
    return provider.subscribe(update);
  }, [provider]);
  useEffect(() => {
    let active = true;
    setMeta(null);
    setProvider(null);
    setError("");
    api
      .get(base)
      .then((r) => {
        if (active) {
          if (r.data.project_id !== params.id) {
            setError("文档不属于当前项目");
            return;
          }
          setMeta(r.data);
        }
      })
      .catch(() => {
        if (active) setError("文档不存在或你没有访问权限。");
      });
    return () => {
      active = false;
    };
  }, [base, org, params.id]);
  const refresh = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get(`${base}/threads`),
        api.get(`${base}/versions`),
      ]);
      setThreads(a.data);
      setVersions(b.data);
    } catch {
      /* Connection/save status remains visible; action errors are shown below. */
    }
  }, [base]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh, org]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setError("");
      await refresh();
    } catch (e: any) {
      setError(e.response?.data?.message || "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  async function share() {
    setTab("share");
    await action(async () => {
      const [a, b] = await Promise.all([
        api.get(`${base}/grants`),
        api.get("/members"),
      ]);
      setGrants(a.data);
      setMembers(b.data);
    });
  }
  const canComment = ["OWNER", "EDITOR", "COMMENTER"].includes(
    provider?.role || meta?.role,
  );
  const anchorState = (t: any) => {
    if (!t.anchor) return "文档评论";
    if (!provider) return "选区评论";
    try {
      const a = Y.createAbsolutePositionFromRelativePosition(
          Y.decodeRelativePosition(from64(t.anchor.start)),
          provider.doc,
        ),
        b = Y.createAbsolutePositionFromRelativePosition(
          Y.decodeRelativePosition(from64(t.anchor.end)),
          provider.doc,
        );
      return !a || !b || (a.type === b.type && a.index === b.index)
        ? "原文已删除"
        : "选区评论";
    } catch {
      return "原文已删除";
    }
  };
  if (!meta)
    return (
      <div className="p-8" role="status">
        {error || "正在加载文档…"}
      </div>
    );
  const uniquePeople = [...new Map(people.map((p) => [p.userId, p])).values()];
  const Surface = meta.kind === 'BOARD' ? Whiteboard : DocumentEditor;
  return (
    <div className="flex min-h-[85vh] flex-col bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <Link
          className="text-sm text-slate-500"
          href={`/projects/${params.id}/${meta.kind==='BOARD'?'boards':'documents'}`}
        >
          ← {meta.kind==='BOARD'?'项目白板':'项目文档'}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{meta.title}</h1>
            <p
              className="mt-1 text-xs text-slate-500"
              role="status"
              aria-live="polite"
            >
              {status} · {provider?.role || meta.role}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500" aria-label="在线成员">
              {uniquePeople.map((p) => p.name).join("、") || "连接中"}
            </span>
            {meta.role === "OWNER" && (
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={share}
              >
                共享权限
              </button>
            )}
            <button
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setTab("history")}
            >
              历史版本
            </button>
            {provider?.writable && (
              <button
                className="text-sm text-slate-500"
                onClick={() => {
                  const title = window.prompt("文档标题", meta.title);
                  if (title)
                    void action(async () => {
                      const r = await api.patch(base, {
                        title,
                        revision: meta.revision,
                      });
                      setMeta({ ...meta, ...r.data });
                    });
                }}
              >
                重命名
              </button>
            )}
          </div>
        </div>
      </header>
      {error && (
        <p className="bg-red-50 px-6 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-1 flex-col lg:flex-row">
        <main className="mx-auto my-6 w-full max-w-4xl flex-1 rounded-xl border bg-white shadow-sm">
          {org && user && (
            <Surface
              key={`${org}:${params.docId}`}
              docId={params.docId}
              org={org}
              user={user.id}
              onReady={onReady}
              onSelection={setSelection}
            />
          )}
        </main>
        <aside className="w-full border-l bg-white p-5 lg:w-80">
          <nav className="mb-5 flex gap-4 border-b pb-3" aria-label="文档侧栏">
            <button
              aria-pressed={tab === "comments"}
              onClick={() => setTab("comments")}
            >
              评论
            </button>
            <button
              aria-pressed={tab === "history"}
              onClick={() => setTab("history")}
            >
              历史
            </button>
            {meta.role === "OWNER" && (
              <button aria-pressed={tab === "share"} onClick={share}>
                权限
              </button>
            )}
          </nav>
          {tab === "comments" && (
            <>
              <h2 className="mb-4 font-medium">讨论与待办</h2>
              {canComment && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      await api.post(`${base}/threads`, {
                        id: crypto.randomUUID(),
                        body,
                        quote: selection?.quote || "",
                        anchor: selection?.anchor || null,
                      });
                      setBody("");
                      setSelection(null);
                    });
                  }}
                >
                  {selection && (
                    <blockquote className="mb-2 border-l-2 pl-2 text-xs text-slate-500">
                      {selection.quote}
                    </blockquote>
                  )}
                  <textarea
                    aria-label="评论内容"
                    className="w-full rounded-lg border p-3 text-sm"
                    placeholder="对齐一个细节，或留下待讨论的问题…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                    maxLength={5000}
                  />
                  <button
                    disabled={busy || !body.trim()}
                    className="my-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    {selection ? "评论选中内容" : "添加文档评论"}
                  </button>
                </form>
              )}
              {!threads.length && (
                <p className="py-6 text-sm text-slate-400">
                  选中原文发表评论，或直接讨论整份文档。
                </p>
              )}
              {threads.map((t) => (
                <article
                  className="my-4 rounded-lg border p-3 text-sm"
                  key={t.id}
                >
                  <p className="mb-2 text-xs text-slate-400">
                    {anchorState(t)} · {t.resolved ? "已解决" : "待处理"}
                  </p>
                  {t.quote && (
                    <blockquote className="mb-2 border-l-2 pl-2 text-slate-500">
                      {t.quote}
                    </blockquote>
                  )}
                  <p className="whitespace-pre-wrap">{t.body}</p>
                  {t.replies?.map((r: any) => (
                    <p key={r.id} className="mt-3 border-t pt-2 text-slate-600">
                      ↳ {r.body}
                    </p>
                  ))}
                  {canComment && (
                    <div className="mt-3 flex gap-4 text-xs text-blue-700">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api.patch(`${base}/threads/${t.id}`, {
                              resolved: !t.resolved,
                              revision: t.revision,
                            });
                          })
                        }
                      >
                        {t.resolved ? "重新打开" : "标记解决"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const body = window.prompt("回复内容");
                          if (body)
                            void action(async () => {
                              await api.post(
                                `${base}/threads/${t.id}/replies`,
                                { id: crypto.randomUUID(), body },
                              );
                            });
                        }}
                      >
                        回复
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </>
          )}
          {tab === "history" && (
            <>
              <h2 className="font-medium">保留重要交付节点</h2>
              <p className="my-2 text-xs text-slate-500">
                版本只包含服务器已确认的正文；恢复会创建独立副本。
              </p>
              {provider?.writable && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      await api.post(`${base}/versions`, {
                        id: crypto.randomUUID(),
                        name: versionName,
                      });
                      setVersionName("");
                    });
                  }}
                >
                  <input
                    aria-label="版本名称"
                    className="mt-2 w-full rounded border p-2 text-sm"
                    placeholder="例如：客户确认 v1"
                    value={versionName}
                    maxLength={160}
                    onChange={(e) => setVersionName(e.target.value)}
                    required
                  />
                  <button
                    disabled={busy || !provider.saved}
                    className="my-3 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
                  >
                    创建版本
                  </button>
                </form>
              )}
              {versions.map((v) => (
                <div key={v.id} className="my-3 rounded-lg border p-3 text-sm">
                  <p className="font-medium">{v.name}</p>
                  <p className="my-2 text-xs text-slate-400">
                    {new Date(v.created_at).toLocaleString()}
                  </p>
                  <button
                    className="text-blue-700"
                    onClick={() =>
                      void action(async () => {
                        setPreview(
                          (await api.get(`${base}/versions/${v.id}`)).data,
                        );
                      })
                    }
                  >
                    只读预览
                  </button>
                  {provider?.writable && (
                    <button
                      disabled={busy}
                      className="ml-4 text-blue-700"
                      onClick={() =>
                        void action(async () => {
                          const r = await api.post(
                            `${base}/versions/${v.id}/restore-copy`,
                            { id: crypto.randomUUID() },
                          );
                          window.location.href = `/projects/${params.id}/documents/${r.data.id}`;
                        })
                      }
                    >
                      恢复为副本
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {tab === "share" && meta.role === "OWNER" && (
            <>
              <h2 className="font-medium">文档访问权限</h2>
              <p className="my-2 text-xs text-slate-500">
                仅已加入当前组织的有效成员可访问。项目可见不自动授予文档权限。
              </p>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    await api.put(`${base}/grants`, { userId: target, role });
                    setGrants((await api.get(`${base}/grants`)).data);
                  });
                }}
              >
                <select
                  required
                  aria-label="组织成员"
                  className="w-full rounded border p-2 text-sm"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">选择组织成员</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.userId || m.user?.id}>
                      {m.user?.name || m.name} · {m.user?.email || m.email}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="文档角色"
                  className="w-full rounded border p-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {["OWNER", "EDITOR", "COMMENTER", "VIEWER", "REMOVE"].map(
                    (r) => (
                      <option key={r}>{r}</option>
                    ),
                  )}
                </select>
                <button
                  disabled={busy}
                  className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  保存权限
                </button>
              </form>
              {grants.map((g) => (
                <p className="mt-4 text-sm" key={g.user_id}>
                  {g.name || g.user_id} · {g.role}
                </p>
              ))}
              <button
                disabled={busy}
                className="mt-8 text-sm text-red-700"
                onClick={() => {
                  if (window.confirm("归档后文档将停止接收编辑，确认归档？"))
                    void action(async () => {
                      await api.post(`${base}/archive`);
                      window.location.reload();
                    });
                }}
              >
                归档文档
              </button>
            </>
          )}
        </aside>
      </div>
      {preview && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50" />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[90vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-white"
              aria-describedby={undefined}
            >
              <div className="flex justify-between border-b p-5">
                <Dialog.Title>{preview.name} · 只读预览</Dialog.Title>
                <Dialog.Close>关闭预览</Dialog.Close>
              </div>
              {meta.kind==='BOARD'?<BoardPreview key={preview.id} state={preview.state}/>:<Preview state={preview.state} />}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
