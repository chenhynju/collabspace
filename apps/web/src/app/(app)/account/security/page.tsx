"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
export default function AccountSecurity() {
  const user = useAuthStore((s) => s.user),
    logout = useAuthStore((s) => s.logout);
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [confirmPassword, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="page-enter mx-auto max-w-3xl px-4 py-8 md:px-10 md:py-12">
      <PageHeader eyebrow="Account" title="账号安全" description="管理你的登录密码与登录状态。" />
      <section className="border-y border-slate-300 py-6">
        <div className="mb-6">
          <h2 className="display-title flex items-center gap-2 text-xl text-slate-900">
            <KeyRound size={18} className="text-indigo-600" />
            修改密码
          </h2>
          <p className="mt-2 text-sm text-slate-500">当前账号：{user?.email}</p>
          <p className="mt-1 text-sm text-slate-500">
            修改成功后需要重新登录；请先确认正在编辑的内容已保存。
          </p>
        </div>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (newPassword !== confirmPassword) {
              setError("两次输入的新密码不一致");
              return;
            }
            if (newPassword === currentPassword) {
              setError("新密码不能与当前密码相同");
              return;
            }
            setBusy(true);
            try {
              await api.post("/auth/change-password", {
                currentPassword,
                newPassword,
                confirmPassword,
              });
              setCurrent("");
              setNew("");
              setConfirm("");
              sessionStorage.setItem("collabspace:password-changed", "1");
              logout();
              window.location.replace("/login?password_changed=1");
            } catch (err: any) {
              setError(err.response?.data?.message || "修改失败，请检查网络后重试");
            } finally {
              setBusy(false);
            }
          }}
        >
          {[
            ["当前密码", currentPassword, setCurrent, "current-password"],
            ["新密码", newPassword, setNew, "new-password"],
            ["确认新密码", confirmPassword, setConfirm, "new-password"],
          ].map(([label, value, setter, autocomplete]) => (
            <label key={label as string} className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {label as string}
              </span>
              <input
                aria-label={label as string}
                type={show ? "text" : "password"}
                autoComplete={autocomplete as string}
                value={value as string}
                onChange={(e) => (setter as (s: string) => void)(e.target.value)}
                required
                minLength={label === "当前密码" ? 1 : 8}
                maxLength={72}
                disabled={busy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
            </label>
          ))}
          <p className="text-xs leading-5 text-slate-500">
            新密码至少8个字符，UTF-8长度最多72字节；建议使用字母、数字和符号。
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            显示密码
          </label>
          {error && (
            <p role="alert" className="border-l-2 border-indigo-600 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? "正在修改…" : "修改密码并重新登录"}
          </button>
        </form>
      </section>
    </main>
  );
}
