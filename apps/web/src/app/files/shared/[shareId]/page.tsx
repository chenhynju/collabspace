"use client";
import { useEffect, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Card, Button } from "@/components/ui";
import { api } from "@/lib/api";

type State =
  | { phase: "loading" }
  | { phase: "ready"; blobUrl: string; filename: string; contentType: string }
  | { phase: "expired"; message: string }
  | { phase: "invalid"; message: string }
  | { phase: "login-required"; message: string };

export default function SharedFilePage({ params }: { params: { shareId: string } }) {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let blobUrl: string | null = null;
    (async () => {
      try {
        const res = await api.get(`/files/shared/${params.shareId}/download`, {
          responseType: "blob",
        });
        const filename =
          decodeURIComponent(
            (res.headers["content-disposition"] ?? "").split("filename=")[1]?.replace(/"/g, "") ??
              "",
          ) || `shared-${params.shareId}`;
        blobUrl = URL.createObjectURL(res.data);
        setState({
          phase: "ready",
          blobUrl,
          filename,
          contentType: String(res.headers["content-type"] ?? "application/octet-stream"),
        });
      } catch (e: any) {
        // 错误体也是 blob，解析 JSON
        const raw = e.response?.data instanceof Blob ? await e.response.data.text() : "";
        let message = raw;
        try {
          message = JSON.parse(raw).message ?? raw;
        } catch {
          /* keep raw */
        }
        const status = e.response?.status;
        if (status === 410) setState({ phase: "expired", message });
        else if (status === 401 || status === 403) setState({ phase: "login-required", message });
        else setState({ phase: "invalid", message: message || "共享链接无效" });
      }
    })();
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [params.shareId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-sm bg-slate-900">
            <span className="block h-3 w-3 border-2 border-[var(--paper)]" />
          </span>
          <span className="display-title text-lg text-slate-900">CollabSpace</span>
          <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Shared file
          </span>
        </div>
        <Card className="w-full p-8 text-center">
          {state.phase === "loading" ? (
            <p className="text-sm text-slate-400">正在定位共享文件…</p>
          ) : null}

          {state.phase === "ready" ? (
            <div className="space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-indigo-600 text-white">
                <ArrowDownToLine size={22} />
              </div>
              <h1 className="display-title break-all text-xl text-slate-900">{state.filename}</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                访客下载 · {state.contentType}
              </p>
              <a href={state.blobUrl} download={state.filename}>
                <Button className="w-full">下载文件</Button>
              </a>
            </div>
          ) : null}

          {state.phase === "expired" ? <ErrorBox title="共享已失效" message={state.message} /> : null}

          {state.phase === "login-required" ? (
            <ErrorBox
              title="需要指定账号"
              message={state.message || "该文件仅指定用户可下载，请先登录对应账号"}
            />
          ) : null}

          {state.phase === "invalid" ? <ErrorBox title="链接无效" message={state.message} /> : null}
        </Card>
      </div>
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-2">
      <span className="mx-auto mb-3 block h-px w-10 bg-indigo-600" />
      <h1 className="display-title text-xl text-slate-900">{title}</h1>
      <p className="text-sm leading-6 text-slate-500">{message}</p>
    </div>
  );
}
