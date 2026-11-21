"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import AuthShell from "@/components/auth/AuthShell";

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const invitation = params.get("invitation");
  const setToken = useAuthStore((s) => s.setToken);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const [state, setState] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    if (!token) {
      setState("error");
      setCode("TOKEN_INVALID");
      setMessage("验证链接缺少 token，请重新获取验证邮件");
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/verify-email", { token });
        setToken(data.accessToken);
        await loadProfile();
        setState("success");
        setTimeout(
          () =>
            router.push(
              invitation ? "/invite/accept?token=" + encodeURIComponent(invitation) : "/dashboard",
            ),
          600,
        );
      } catch (e: any) {
        setState("error");
        setCode(e.response?.data?.code ?? "");
        setMessage(e.response?.data?.message ?? "验证失败，请稍后再试");
      }
    })();
  }, [token, invitation, setToken, loadProfile, router]);

  const resend = async () => {
    setResendNotice("");
    if (!email) {
      setResendNotice("请输入注册时使用的邮箱");
      return;
    }
    try {
      await api.post("/auth/resend-verification", { email });
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    } catch (e: any) {
      setResendNotice(e.response?.data?.message || "发送失败，请稍后再试");
    }
  };

  return (
    <AuthShell
      eyebrow="Email verification"
      title={state === "success" ? "邮箱已验证" : state === "error" ? "验证未完成" : "正在验证邮箱"}
      subtitle={
        state === "success"
          ? "即将进入工作台。"
          : state === "error"
            ? message
            : "正在核对一次性验证链接，请稍候。"
      }
      footer={
        <p className="text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-700 hover:underline">
            返回登录
          </Link>
        </p>
      }
    >
      {state === "verifying" && (
        <div className="flex items-center gap-3 border-l-2 border-indigo-600 bg-white px-4 py-4 text-sm text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
          正在验证…
        </div>
      )}

      {state === "success" && (
        <div className="border-l-2 border-violet-700 bg-violet-50 px-4 py-4 text-sm leading-6 text-violet-800">
          验证成功，正在跳转。若没有自动跳转，
          <Link href="/dashboard" className="ml-1 font-medium underline">
            进入工作台
          </Link>
          。
        </div>
      )}

      {state === "error" && (
        <div>
          {resendNotice && (
            <p className="mb-4 border-l-2 border-indigo-600 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              {resendNotice}
            </p>
          )}
          {(code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID") && (
            <div className="space-y-3">
              <label htmlFor="verify-email" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                注册邮箱
              </label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
              <button
                onClick={resend}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600"
              >
                重新发送验证邮件
              </button>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
