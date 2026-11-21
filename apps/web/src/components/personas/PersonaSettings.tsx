"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Film,
  ImagePlus,
  Mic,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  Volume2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Badge, Button, Card, Empty } from "@/components/ui";
import { FilePicker } from "@/components/file-picker";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type Draft = {
  id: string;
  kind: "PHOTO" | "VIDEO";
  state: "DRAFT" | "REVOKED" | string;
  createdAt: string;
  expiresAt: string;
};

type Capabilities = {
  consentVersion?: string;
  maxBytes?: number;
  retention?: { accessDays?: number; scheduledPurge?: boolean };
  creation?: { configured?: boolean; reason?: string };
};

type VoiceStatus = {
  provider?: string;
  cloud?: string;
  configured?: boolean;
  voices?: Record<string, unknown>;
  preciseVisemes?: boolean;
  mouthAnalysis?: { enabled?: boolean; configured?: boolean };
  realistic?: { configured?: boolean; reason?: string };
  maxSeconds?: number;
  maxText?: number;
};

const PROVIDER_LABEL: Record<string, string> = {
  azure: "Azure Speech",
  volcengine: "豆包语音",
  elevenlabs: "ElevenLabs",
  whisper: "Whisper",
};

const date = (value: string) => new Date(value).toLocaleDateString("zh-CN");

export default function PersonaSettings() {
  const org = useAuthStore((s) => s.currentOrgId);
  const user = useAuthStore((s) => s.user);
  return <PersonaSession key={`${org}:${user?.id}`} />;
}

function PersonaSession() {
  const org = useAuthStore((s) => s.currentOrgId);
  const user = useAuthStore((s) => s.user);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [language, setLanguage] = useState("zh-CN");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [kind, setKind] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [mediaKind, setMediaKind] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [consent, setConsent] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [voice, setVoice] = useState<VoiceStatus | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const pending = useRef<string | null>(null);
  const epoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const accessDays = caps?.retention?.accessDays ?? 7;
  const maxMb = caps?.maxBytes ? Math.round(caps.maxBytes / 1024 / 1024) : 20;

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);
  useEffect(() => {
    setSpeechAvailable(typeof window !== "undefined" && "speechSynthesis" in window);
    if (!org) return;
    const c = new AbortController();
    setVoiceError("");
    api
      .get("/voice/status", { signal: c.signal })
      .then((r) => setVoice(r.data))
      .catch(() => {
        if (!c.signal.aborted) setVoiceError("语音能力状态读取失败，请稍后重试");
      });
    return () => c.abort();
  }, [org]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(
    () => () => {
      epoch.current++;
      controller.current?.abort();
    },
    [],
  );

  const clearPreview = () => {
    setPreview("");
    setFile(null);
    setConsent(false);
    pending.current = null;
  };

  const load = async (signal: AbortSignal) => {
    const [c, p, d] = await Promise.all([
      api.get("/voice/persona/capabilities", { signal }),
      api.get("/voice/persona", { signal }),
      api.get("/voice/persona/drafts", { signal }),
    ]);
    if (signal.aborted) return;
    setCaps(c.data);
    setLanguage(p.data.locale);
    setDrafts(d.data);
  };

  useEffect(() => {
    if (!org) return;
    const scope = org;
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setLoadError("");
    api
      .get("/voice/persona/capabilities", { signal: current.signal })
      .catch((error) => {
        if (!current.signal.aborted && useAuthStore.getState().currentOrgId === scope)
          setLoadError(
            error.response?.data?.message ?? "数字分身服务未就绪；请检查服务版本、迁移或网络。",
          );
      })
      .finally(() => {
        if (!current.signal.aborted && useAuthStore.getState().currentOrgId === scope)
          setLoading(false);
      });
    void load(current.signal).catch((error) => {
      if (!current.signal.aborted && useAuthStore.getState().currentOrgId === scope)
        setLoadError(
          error.response?.data?.message ?? "数字分身服务未就绪；请检查服务版本、迁移或网络。",
        );
    });
    return () => current.abort();
  }, [org]);

  // The newest photo draft is shown as the avatar. It is the owner's stored
  // original, never a generated digital human.
  useEffect(() => {
    const draft = drafts.find((item) => item.state === "DRAFT" && item.kind === "PHOTO");
    if (!draft) {
      setAvatar("");
      return;
    }
    let mounted = true;
    let url = "";
    const current = new AbortController();
    api
      .get(`/voice/persona/drafts/${draft.id}/source`, {
        responseType: "blob",
        signal: current.signal,
      })
      .then((response) => {
        if (!mounted) return;
        url = URL.createObjectURL(response.data);
        setAvatar(url);
      })
      .catch(() => {
        if (mounted) setAvatar("");
      });
    return () => {
      mounted = false;
      current.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [drafts]);

  const action = async (work: (signal: AbortSignal, run: number) => Promise<void>) => {
    if (busy) return;
    const current = new AbortController();
    controller.current = current;
    const run = ++epoch.current;
    setBusy(true);
    setNotice("");
    try {
      await work(current.signal, run);
    } catch (error: any) {
      if (!current.signal.aborted && run === epoch.current)
        setNotice(
          typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : "操作失败，请检查网络后重试。",
        );
    } finally {
      if (run === epoch.current) setBusy(false);
    }
  };

  const refreshDrafts = async (signal: AbortSignal, run: number) => {
    const response = await api.get("/voice/persona/drafts", { signal });
    if (run === epoch.current) setDrafts(response.data);
  };

  const choose = (picked: File) => {
    clearPreview();
    if (picked.size > (caps?.maxBytes ?? 20971520)) {
      setNotice(`素材最大 ${maxMb}MB`);
      return;
    }
    const allowed =
      kind === "PHOTO" ? ["image/png", "image/jpeg", "image/webp"] : ["video/mp4", "video/webm"];
    if (!allowed.includes(picked.type)) {
      setNotice("请选择当前类型支持的真实文件");
      return;
    }
    setMediaKind(kind);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    setNotice("仅本地预览，尚未上传或生成数字分身。");
  };

  const saveLanguage = () =>
    void action(async (signal, run) => {
      await api.put("/voice/persona", { style: "realistic", locale: language }, { signal });
      if (run === epoch.current)
        setNotice("已保存默认语言偏好；不会改变身份或权限。");
    });

  const saveDraft = () =>
    void action(async (signal, run) => {
      if (!file || !caps) return;
      const form = new FormData();
      if (!pending.current) pending.current = crypto.randomUUID();
      Object.entries({
        requestId: pending.current,
        kind,
        locale: language,
        consent: "true",
        consentVersion: caps.consentVersion ?? "",
      }).forEach(([key, value]) => form.append(key, value));
      form.append("file", file);
      await api.post("/voice/persona/drafts", form, { signal });
      if (run !== epoch.current) return;
      clearPreview();
      await refreshDrafts(signal, run);
      if (run === epoch.current)
        setNotice("已保存私有素材草稿，尚未创建或训练数字分身。");
    });

  const viewDraft = (draft: Draft) =>
    void action(async (signal, run) => {
      const response = await api.get(`/voice/persona/drafts/${draft.id}/source`, {
        responseType: "blob",
        signal,
      });
      if (run !== epoch.current) return;
      setFile(null);
      setConsent(false);
      setMediaKind(draft.kind);
      setPreview(URL.createObjectURL(response.data));
      setNotice("原素材预览，不是AI生成结果。");
    });

  const removeDraft = (draft: Draft) => {
    if (!window.confirm("撤销后原素材会从当前存储删除，确定继续？")) return;
    void action(async (signal, run) => {
      await api.delete(`/voice/persona/drafts/${draft.id}`, { signal });
      if (run !== epoch.current) return;
      clearPreview();
      await refreshDrafts(signal, run);
      if (run === epoch.current) setNotice("已撤销该草稿，原素材已从当前存储删除。");
    });
  };

  const speakSample = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      "语音与数字分身设置。这是一段系统朗读试听，不会生成或保存音频。",
    );
    utterance.lang = language;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const refreshVoice = async () => {
    setVoiceError("");
    try {
      const { data } = await api.get("/voice/status");
      setVoice(data);
    } catch {
      setVoiceError("语音能力状态读取失败，请稍后重试");
    }
  };

  const providerLabel = voice?.provider    ? PROVIDER_LABEL[voice.provider] ?? voice.provider
    : "未检测";
  const serverReady = voice?.configured === true;
  const visemeLabel = voice?.preciseVisemes
    ? "精确口型"
    : voice?.mouthAnalysis?.enabled
      ? "基础口型"
      : "未启用";

  return (
    <div className="page-enter mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-10">
      <div className="mb-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-indigo-600"
        >
          <ArrowLeft size={13} /> 返回设置
        </Link>
      </div>
      <PageHeader
        eyebrow="Voice & Persona"
        title="语音与数字分身"
        description="语音转文字、朗读与本人素材草稿集中在这里；IM 只保留输入与消息本身。"
      />

      <Card className="mt-6 overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Voice</p>
                <h2 className="display-title mt-1.5 text-xl text-slate-900">语音能力</h2>
                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">
                  语音消息本身不依赖供应商；听写与朗读需要服务端语音服务，未配置时只提供浏览器降级。
                </p>
              </div>
              <Badge tone={serverReady ? "green" : "amber"}>
                {serverReady ? "服务端已配置" : "服务端未配置"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-4">
              {[
                { label: "语音转文字", value: serverReady ? "可用" : "未配置", icon: Mic },
                { label: "文字转语音", value: serverReady ? "可用" : "未配置", icon: Volume2 },
                { label: "口型 / Viseme", value: visemeLabel, icon: Film },
                {
                  label: "浏览器朗读",
                  value: speechAvailable ? "可用（降级）" : "不可用",
                  icon: Volume2,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="bg-white p-3">
                    <Icon size={14} className="text-slate-400" />
                    <p className="mt-2 text-[11px] text-slate-500">{item.label}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{item.value}</p>
                  </div>
                );
              })}
            </div>

            {!serverReady && (
              <div className="mt-4 border-l-2 border-amber-600 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                代码已接入 Azure Speech、豆包语音与 ElevenLabs TTS；生产尚未配置服务端密钥，因此服务端
                ASR/TTS 会直接拒绝，不会调用供应商。若要用 Whisper 做听写，需要在服务端新增 OpenAI
                适配并配置密钥；页面不会接收密钥。
              </div>
            )}
            {voiceError && (
              <p role="alert" className="mt-3 text-xs text-indigo-700">
                {voiceError}
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="eyebrow">Provider</p>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <dt className="text-slate-500">当前服务商</dt>
                <dd className="font-medium text-slate-800">{providerLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <dt className="text-slate-500">云区域</dt>
                <dd className="font-mono text-[11px] text-slate-700">{voice?.cloud ?? "默认"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <dt className="text-slate-500">单次上限</dt>
                <dd className="font-mono text-[11px] text-slate-700">
                  {voice?.maxSeconds ?? 60}s / {voice?.maxText ?? 4000} 字
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">浏览器语音</dt>
                <dd className="font-medium text-slate-800">
                  {speechAvailable ? "支持" : "不支持"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!speechAvailable || speaking}
                onClick={speakSample}
              >
                <Volume2 size={14} />
                {speaking ? "朗读中…" : "试听系统语音"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => void refreshVoice()}>
                <RefreshCw size={14} /> 刷新语音状态
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {loadError && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/5] w-full bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-100">
              {avatar ? (
                <img
                  src={avatar}
                  alt="我的数字分身私有素材草稿"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                  <span className="grid h-24 w-24 place-items-center rounded-full bg-white/80 text-3xl font-semibold text-indigo-500 shadow-sm">
                    {(user?.name ?? "我").slice(0, 1)}
                  </span>
                  <span className="text-xs">尚未添加本人素材</span>
                </div>
              )}
              <span className="absolute left-3 top-3">
                <Badge tone={avatar ? "violet" : "slate"}>
                  {avatar ? "私有素材草稿" : "未创建"}
                </Badge>
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">{user?.name ?? "我"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {avatar
                    ? "这是本人素材，不是AI生成结果；仅本人可见。"
                    : "保存本人照片后，这里会显示草稿预览。"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">默认语言</span>
                <div className="flex gap-1" role="group" aria-label="默认语言">
                  {[
                    { value: "zh-CN", label: "中文" },
                    { value: "en-US", label: "English" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={language === value}
                      disabled={busy}
                      onClick={() => {
                        pending.current = null;
                        setLanguage(value);
                      }}
                      className={
                        "rounded-lg px-2.5 py-1 text-xs font-medium transition " +
                        (language === value
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={busy}
                onClick={saveLanguage}
              >
                保存默认语言
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ShieldCheck size={15} className="text-emerald-600" /> 隐私与边界
            </h2>
            <ul className="space-y-2 text-xs leading-5 text-slate-500">
              <li>仅本人可见，同组织其他成员无法查看原素材。</li>
              <li>不会发送给外部供应商，不训练，也不生成真人视频。</li>
              <li>可随时撤销，原素材会从当前存储删除。</li>
              <li>草稿 {accessDays} 天后过期，需重新保存。</li>
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">添加本人素材</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  先本地预览，再保存为仅本人可见的私有草稿。
                </p>
              </div>
              <div
                className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
                role="group"
                aria-label="素材类型"
              >
                {(
                  [
                    { value: "PHOTO", label: "照片", icon: ImagePlus },
                    { value: "VIDEO", label: "视频", icon: Film },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    disabled={busy}
                    onClick={() => {
                      setKind(value);
                      clearPreview();
                    }}
                    className={
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                      (kind === value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700")
                    }
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              {kind === "PHOTO"
                ? "上传清晰单人正脸照片，避免遮挡和强滤镜；仅支持 PNG / JPEG / WebP。"
                : "上传本人 MP4 / WebM 素材。录制时长、台词和授权要求待供应商确认；草稿不代表已满足训练要求。"}
            </p>
            <div className="mt-3">
              <FilePicker
                disabled={busy}
                key={kind}
                label={kind === "PHOTO" ? "选择本人照片" : "选择本人视频"}
                accept={kind === "PHOTO" ? ".png,.jpg,.jpeg,.webp" : ".mp4,.webm"}
                hint={`仅本人素材 · 最大 ${maxMb}MB · 先本地预览`}
                onFile={choose}
              />
            </div>
            {preview && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="overflow-hidden rounded-xl bg-white">
                  {mediaKind === "PHOTO" ? (
                    <img
                      src={preview}
                      alt="本人素材预览，尚非生成结果"
                      className="max-h-72 w-full object-contain"
                    />
                  ) : (
                    <video
                      src={preview}
                      aria-label="本人视频素材预览"
                      controls
                      preload="metadata"
                      className="max-h-72 w-full"
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">本地预览 · 不是AI生成结果</p>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={clearPreview}>
                    清除预览
                  </Button>
                </div>
              </div>
            )}
            <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-600">
              <input
                aria-label="本人素材草稿授权"
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                我确认是本人素材，授权在本组织中私有保存本次草稿（{accessDays}
                天后不可访问，按清理策略删除）。不包含外部供应商训练、声音克隆或自动发送授权。
                {caps?.consentVersion && (
                  <span className="text-slate-400"> 授权版本：{caps.consentVersion}</span>
                )}
              </span>
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button disabled={busy || !file || !consent || !caps} onClick={saveDraft}>
                {busy ? "处理中…" : "保存私有素材草稿"}
              </Button>
              <span className="text-xs text-slate-400">仅本人可见 · 不生成真人</span>
            </div>
            <p
              role="status"
              className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900"
            >
              {caps?.creation?.reason ?? "正在检查数字分身服务…"}
              。照片与视频真实生成均待供应商接入，不会显示虚假的创建成功或可播放结果。
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              清理策略：
              {caps?.retention?.scheduledPurge
                ? "每小时批量清理过期草稿"
                : "定时清理未启用，访问时清理本人过期草稿"}
              ；备份按备份保留期清除。
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">我的私有素材草稿</h2>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void action(refreshDrafts)}
              >
                <RefreshCw size={13} /> 刷新
              </Button>
            </div>
            {loading ? (
              <p className="py-6 text-center text-xs text-slate-400">正在读取…</p>
            ) : drafts.length === 0 ? (
              <Empty text="还没有素材草稿" />
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {drafts.map((draft) => (
                  <li key={draft.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      {draft.kind === "PHOTO" ? <ImagePlus size={16} /> : <Film size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm text-slate-700">
                        {draft.kind === "PHOTO" ? "照片素材" : "视频素材"}
                        <Badge tone={draft.state === "REVOKED" ? "slate" : "violet"}>
                          {draft.state === "REVOKED" ? "已撤销" : "草稿，未生成"}
                        </Badge>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        保存于 {date(draft.createdAt)} ·{" "}
                        {draft.state === "REVOKED"
                          ? "原素材已删除"
                          : `有效至 ${date(draft.expiresAt)}`}
                      </p>
                    </div>
                    {draft.state === "DRAFT" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => viewDraft(draft)}
                        >
                          查看原素材
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => removeDraft(draft)}
                        >
                          <Trash2 size={13} /> 撤销并删除
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {notice && (
            <p role="status" className="text-xs text-slate-600">
              {notice}
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <UserRound size={14} /> 卡通 Agent 形象属于 AI Agent，不会代替你的真人身份。
      </p>
    </div>
  );
}
