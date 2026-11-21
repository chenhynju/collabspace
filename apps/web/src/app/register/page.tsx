"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  organizationName: z.string().optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteLoading, setInviteLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const form = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("invitation");
    if (!t) {
      setInviteLoading(false);
      return;
    }
    setInviteToken(t);
    api
      .get("/invitations/preview", { params: { token: t } })
      .then(({ data }) => {
        if (data.status !== "PENDING") throw Error("邀请已处理或过期");
        setInvitation(data);
        form.setValue("email", data.email);
        form.setValue("organizationName", data.organization.name);
      })
      .catch((e) => setError(e.response?.data?.message || e.message || "邀请不可用"))
      .finally(() => setInviteLoading(false));
  }, []);

  const onSubmit = form.handleSubmit(async (d) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/register", {
        ...d,
        organizationName: invitation ? undefined : d.organizationName?.trim() || undefined,
        inviteToken: inviteToken || undefined,
      });
      if (data?.requireEmailVerification === false && data?.accessToken) {
        useAuthStore.getState().setToken(data.accessToken);
        await useAuthStore.getState().loadProfile();
        router.push(
          inviteToken ? "/invite/accept?token=" + encodeURIComponent(inviteToken) : "/dashboard",
        );
        return;
      }
      router.push(
        `/check-email?email=${encodeURIComponent(d.email)}&delivery=${data.emailProvider === "console" ? "simulated" : data.emailSent === false ? "failed" : "sent"}`,
      );
    } catch (e: any) {
      setError(e.response?.data?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthShell
      eyebrow="Create account"
      title="创建你的协作空间"
      subtitle={
        invitation
          ? `来自「${invitation.organization.name}」的邀请。确认邮箱后还需要你明确选择加入。`
          : "一个账号即可创建独立空间，或加入受邀组织。"
      }
      footer={
        <p className="text-sm text-slate-500">
          已有账号？
          <Link href="/login" className="ml-1 font-medium text-indigo-700 hover:underline">
            直接登录
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
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-name" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            姓名
          </label>
          <input
            id="register-name"
            {...form.register("name")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            邮箱
          </label>
          <input
            id="register-email"
            {...form.register("email")}
            readOnly={!!inviteToken}
            type="email"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 read-only:bg-slate-100 read-only:text-slate-500"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            密码（至少 8 位）
          </label>
          <input
            id="register-password"
            {...form.register("password")}
            type="password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
        </div>
        <div>
          <label htmlFor="register-org" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            团队／组织名称（可选）
          </label>
          <input
            id="register-org"
            readOnly={!!inviteToken}
            aria-label="团队或组织名称"
            {...form.register("organizationName")}
            placeholder="留空即可使用个人协作空间"
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 read-only:bg-slate-100 read-only:text-slate-500"
          />
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {inviteToken
            ? "组织与邮箱由邀请确定。验证邮箱后，还需要你明确选择加入；注册本身不会自动加入组织。"
            : "不填写组织名称也可正常使用协作功能，系统会自动创建独立空间。你的内容与其他组织隔离，仅向获授权成员开放。"}
        </p>
        <button
          type="submit"
          disabled={loading || inviteLoading || (!!inviteToken && !invitation)}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {loading ? "注册中…" : inviteToken ? "接受邀请并注册" : "创建账号"}
        </button>
      </form>
    </AuthShell>
  );
}
