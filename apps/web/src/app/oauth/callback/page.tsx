"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { useRef, useState } from "react";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const started = useRef(false),
    [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    history.replaceState(null, "", window.location.pathname);
    if (code) {
      api
        .post("/auth/oauth/exchange", { code })
        .then(async ({ data }) => {
          setToken(data.accessToken);
          await loadProfile();
          router.replace("/dashboard");
        })
        .catch(() => setError("登录回调已过期或浏览器不匹配，请返回登录页重试。"));
    } else {
      router.push("/login");
    }
  }, [setToken, loadProfile, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4efe5] px-6">
      <div className="w-full max-w-sm border-t-2 border-slate-900 bg-white px-6 py-8 text-center">
        <p className="eyebrow">OAuth</p>
        <p className="display-title mt-3 text-xl text-slate-900">
          {error || "正在完成登录…"}
        </p>
        {error ? (
          <a className="mt-4 inline-block text-sm font-medium text-indigo-700 underline" href="/login">
            返回登录
          </a>
        ) : (
          <span className="mx-auto mt-6 block h-px w-12 animate-pulse bg-indigo-600" />
        )}
      </div>
    </div>
  );
}
