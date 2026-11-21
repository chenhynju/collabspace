"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { invitationReturn } from "@/lib/invitation-return";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; github: boolean }>({
    google: false,
    github: false,
  });
  const form = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (
      new URLSearchParams(location.search).has("password_changed") ||
      sessionStorage.getItem("collabspace:password-changed") === "1"
    ) {
      setNotice("密码已修改，请使用新密码登录。");
      sessionStorage.removeItem("collabspace:password-changed");
    }
    if (new URLSearchParams(location.search).has("oauth_error"))
      setError("第三方登录未完成，请重试或使用邮箱登录。");
    api
      .get("/auth/oauth/providers")
      .then(({ data }) => setOauthProviders({ google: !!data.google, github: !!data.github }))
      .catch(() => {});
  }, []);

  const onSubmit = form.handleSubmit(async (d) => {
    setLoading(true);
    setError("");
    setUnverifiedEmail("");
    try {
      const { data } = await api.post("/auth/login", d);
      setToken(data.accessToken);
      await loadProfile();
      router.push(invitationReturn(location.search));
    } catch (e: any) {
      setError(e.response?.data?.message || "登录失败");
      if (e.response?.data?.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(d.email);
      }
    } finally {
      setLoading(false);
    }
  });

  const resendFromLogin = async () => {
    try {
      await api.post("/auth/resend-verification", { email: unverifiedEmail });
      router.push(`/check-email?email=${encodeURIComponent(unverifiedEmail)}`);
    } catch (e: any) {
      setError(e.response?.data?.message || "发送失败，请稍后再试");
    }
  };

  const oauth = async (provider: "google" | "github") => {
    try {
      const { data } = await api.get(`/auth/oauth/${provider}/url`);
      window.location.href = data.url;
    } catch {
      setError("第三方登录暂不可用，请稍后重试或使用邮箱登录。");
    }
  };

  return (
    <AuthShell
      eyebrow="Sign in"
      title="欢迎回来"
      subtitle="登录后继续你的项目、文档与对话。"
      footer={
        <p className="text-sm text-slate-500">
          还没有账号？
          <Link href="/register" className="ml-1 font-medium text-indigo-700 hover:underline">
            创建账号
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
      {unverifiedEmail && (
        <button
          onClick={resendFromLogin}
          className="mb-5 w-full border border-amber-300 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-900 transition hover:bg-amber-100"
        >
          邮箱尚未验证。重新发送验证邮件（{unverifiedEmail}）→
        </button>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 border-l-2 border-violet-700 bg-violet-50 px-4 py-3 text-sm text-violet-800"
        >
          {notice}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            邮箱
          </label>
          <input
            id="login-email"
            {...form.register("email")}
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              密码
            </label>
            <Link href="/forgot-password" className="text-xs text-indigo-700 hover:underline">
              忘记密码？
            </Link>
          </div>
          <input
            id="login-password"
            {...form.register("password")}
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
            placeholder="至少 8 位"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>

      {(oauthProviders.google || oauthProviders.github) && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          {oauthProviders.google && (
            <button
              onClick={() => oauth("google")}
              className="rounded-lg border border-slate-300 bg-white/60 py-2.5 text-sm text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            >
              Google
            </button>
          )}
          {oauthProviders.github && (
            <button
              onClick={() => oauth("github")}
              className="rounded-lg border border-slate-300 bg-white/60 py-2.5 text-sm text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            >
              GitHub
            </button>
          )}
        </div>
      )}
    </AuthShell>
  );
}
