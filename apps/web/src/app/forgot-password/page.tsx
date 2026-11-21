"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (d) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", d);
      setSent(true);
    } catch (e: any) {
      setError(e.response?.data?.message || "发送失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthShell
      eyebrow="Reset password"
      title="找回密码"
      subtitle="输入注册邮箱，我们会发送一封一次性重置链接，有效期 1 小时。"
      footer={
        <p className="text-sm text-slate-500">
          想起密码了？
          <Link href="/login" className="ml-1 font-medium text-indigo-700 hover:underline">
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
      {sent ? (
        <div>
          <div className="border-l-2 border-violet-700 bg-violet-50 px-4 py-4 text-sm leading-6 text-violet-800">
            如果该邮箱已注册，重置邮件很快就会送达。
            <br />
            链接有效期为 1 小时，请检查收件箱或垃圾邮件。
          </div>
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600"
          >
            返回登录
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="forgot-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              邮箱
            </label>
            <input
              id="forgot-email"
              {...form.register("email")}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {loading ? "发送中…" : "发送重置链接"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
