"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import AuthShell from "@/components/auth/AuthShell";

function CheckEmailInner() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const delivery = params.get("delivery");
  const [notice, setNotice] = useState("");
  const [resending, setResending] = useState(false);

  const resend = async () => {
    setResending(true);
    setNotice("");
    try {
      await api.post("/auth/resend-verification", { email });
      setNotice("已请求重新发送；若为演示邮件模式，不会实际发出，请联系管理员。");
    } catch (e: any) {
      setNotice(e.response?.data?.message || "发送失败，请稍后再试");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Check your inbox"
      title="请验证你的邮箱"
      subtitle={
        delivery === "simulated"
          ? "演示邮件模式 · 邮件未实际发送"
          : delivery === "failed"
            ? "验证邮件投递失败"
            : "验证链接已准备发送，请在 24 小时内完成验证。"
      }
      footer={
        <p className="text-sm text-slate-500">
          <Link href="/login" className="font-medium text-indigo-700 hover:underline">
            返回登录
          </Link>
        </p>
      }
    >
      {delivery === "simulated" && (
        <p role="status" className="mb-5 border-l-2 border-amber-600 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          请联系管理员配置邮件服务后重新发送。未完成验证前不会加入受邀组织。
        </p>
      )}
      <div className="border-y border-slate-200 py-5">
        <p className="eyebrow">发送至</p>
        <p className="mt-2 break-all font-mono text-sm text-slate-900">{email || "未提供邮箱"}</p>
      </div>
      <p className="mt-5 text-xs leading-6 text-slate-500">
        若未收到，请检查垃圾邮件，或点击下方按钮重新发送。链接过期后可再次获取。
      </p>
      {notice && (
        <p role="status" className="mt-4 border-l-2 border-indigo-600 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-800">
          {notice}
        </p>
      )}
      <button
        onClick={resend}
        disabled={resending || !email}
        className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {resending ? "发送中…" : "重新发送验证邮件"}
      </button>
    </AuthShell>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailInner />
    </Suspense>
  );
}
