"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import AuthShell from "@/components/auth/AuthShell";

const schema = z
  .object({
    password: z.string().min(8, "密码至少 8 位"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "两次输入的密码不一致",
    path: ["confirm"],
  });

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const setToken = useAuthStore((s) => s.setToken);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (d) => {
    if (!token) {
      setCode("TOKEN_INVALID");
      setError("重置链接缺少 token，请重新获取重置邮件");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/reset-password", {
        token,
        password: d.password,
      });
      setToken(data.accessToken);
      await loadProfile();
      router.push("/dashboard");
    } catch (e: any) {
      setCode(e.response?.data?.code ?? "");
      setError(e.response?.data?.message ?? "重置失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthShell
      eyebrow="New password"
      title="设置新密码"
      subtitle="设置后会自动登录，并让旧密码立即失效。"
      footer={
        <p className="text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-700 hover:underline">
            返回登录
          </Link>
        </p>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 border-l-2 border-indigo-600 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-800"
        >
          {error}
        </div>
      )}
      {(code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID") && (
        <div className="mb-5 text-sm">
          <Link href="/forgot-password" className="font-medium text-indigo-700 hover:underline">
            重新获取重置链接 →
          </Link>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            新密码（至少 8 位）
          </label>
          <input
            id="reset-password"
            {...form.register("password")}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
          {form.formState.errors.password && (
            <p className="mt-1.5 text-xs text-indigo-700">
              {String(form.formState.errors.password.message)}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            确认新密码
          </label>
          <input
            id="reset-confirm"
            {...form.register("confirm")}
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
          {form.formState.errors.confirm && (
            <p className="mt-1.5 text-xs text-indigo-700">
              {String(form.formState.errors.confirm.message)}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? "提交中…" : "重置密码并登录"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
