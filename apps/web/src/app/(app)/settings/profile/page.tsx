"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Mail, UserRound } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button, Card, InlineError, inputCls } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const save = async () => {
    const next = name.trim();
    setError("");
    setSaved(false);
    if (next.length < 1 || next.length > 50) {
      setError("姓名需要 1–50 个字符");
      return;
    }
    if (next === user?.name) {
      setSaved(true);
      return;
    }
    setBusy(true);
    try {
      await api.patch("/users/me", { name: next });
      await loadProfile();
      setSaved(true);
    } catch (e: any) {
      setError(
        typeof e.response?.data?.message === "string"
          ? e.response.data.message
          : "保存失败，请检查网络后重试",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-8 md:px-10 md:py-12">
      <PageHeader
        eyebrow="Profile"
        title="个人资料"
        description="这里修改的是你在组织内显示的姓名；邮箱由账号体系维护，暂不支持自行修改。"
      />
      <Link
        href="/settings"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-700"
      >
        <ArrowLeft size={13} /> 返回设置
      </Link>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5">
          <span className="grid h-14 w-14 place-items-center rounded-sm bg-indigo-600 text-xl font-semibold text-white">
            {(user?.name ?? "?").slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="display-title text-xl text-slate-900">{user?.name ?? "未命名用户"}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Mail size={13} /> {user?.email ?? ""}
            </p>
          </div>
        </div>

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              显示姓名
            </span>
            <div className="relative">
              <UserRound
                size={15}
                className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400"
              />
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                maxLength={50}
                required
                aria-label="显示姓名"
                className={`${inputCls} pl-10`}
                placeholder="你的姓名"
              />
            </div>
            <span className="mt-1.5 block text-xs text-slate-400">
              1–50 个字符。修改后，群聊、成员列表和消息发送者会使用新姓名。
            </span>
          </label>

          <div className="border-l-2 border-slate-300 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            邮箱：{user?.email}。如需更换邮箱，请联系组织管理员或通过账号安全流程处理。
          </div>

          <InlineError message={error} />
          {saved && !error ? (
            <p role="status" className="border-l-2 border-violet-700 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              <Check size={14} className="mr-1 inline" /> 姓名已保存
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "保存中…" : "保存姓名"}
            </Button>
            <Link
              href="/settings"
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              取消
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
