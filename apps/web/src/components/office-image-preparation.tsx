"use client";
import { useEffect, useRef, useState } from "react";
import { FilePicker } from "@/components/file-picker";
import { prepareOfficeImage, type ImagePreset } from "@/lib/prepare-office-image";

export function OfficeImagePreparation() {
  const [file, setFile] = useState<File | null>(null),
    [preset, setPreset] = useState<ImagePreset>("balanced");
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  const clear = () => {
    generation.current++;
    setResult(null);
    setBusy(false);
    setError("");
  };
  return (
    <details className="group rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-medium text-slate-700">
        <span>图片上传慢？先缩小图片</span>
        <span className="text-slate-400 transition group-open:rotate-180" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 py-3">
        <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-5 text-slate-500">
          在浏览器本地生成较小副本，下载后通过编辑器“插入 → 图片 →
          来自文件的图片”选择该副本。不会自动上传或更改幻灯片。照片可选均衡或更小；截图、文字、透明图请检查预览，清晰度优先时选原图。
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <FilePicker
            label="准备插入的图片"
            accept="image/png,image/jpeg,image/webp"
            onFile={(f) => {
              clear();
              setFile(f);
            }}
            hint="PNG / JPEG / WebP · 本地处理，不会自动上传"
          />
          <select
            aria-label="图片质量"
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            value={preset}
            onChange={(e) => {
              clear();
              setPreset(e.target.value as ImagePreset);
            }}
          >
            <option value="original">原图（保持文件）</option>
            <option value="balanced">均衡（最长1920像素）</option>
            <option value="small">更小（最长1280像素）</option>
          </select>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              const run = ++generation.current;
              setBusy(true);
              setError("");
              setResult(null);
              try {
                const prepared = await prepareOfficeImage(file, preset);
                if (run === generation.current)
                  setResult({ file: prepared, url: URL.createObjectURL(prepared) });
              } catch (e) {
                if (run === generation.current)
                  setError(e instanceof Error ? e.message : "处理失败，请使用原图。");
              } finally {
                if (run === generation.current) setBusy(false);
              }
            }}
          >
            {busy ? "正在本地处理…" : "生成预览"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {result && file && (
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
            <p role="status" className="text-xs text-slate-600">
              原图 {(file.size / 1024).toFixed(1)} KB → 副本 {(result.file.size / 1024).toFixed(1)} KB
              {result.file === file
                ? "（保持原图）"
                : `（减少 ${Math.round((1 - result.file.size / file.size) * 100)}%）`}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.url}
              alt="待插入图片预览"
              className="max-h-64 max-w-full rounded-lg border border-slate-200 bg-white object-contain"
            />
            <a
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/50"
              href={result.url}
              download={result.file.name}
            >
              下载待插入图片
            </a>
            <p className="text-[11px] leading-5 text-slate-400">
              尚未插入或保存。插入后请等待服务器版本号确认；生成副本不保证网络等待时间消失。
            </p>
          </div>
        )}
      </div>
    </details>
  );
}
