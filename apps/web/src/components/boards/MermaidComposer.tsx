"use client";
import { createPortal } from "react-dom";
import DiagramGlyph from "./DiagramGlyph";
import { useEffect, useState } from "react";
import {
  flowNodes,
  addFlowNode,
  mindNodes,
  addMindNode,
  moveMindBranch,
  isFlowSource,
  getFlowDirection,
  flowDirection,
  renameFlowNode,
  colorFlowNode,
  duplicateFlowNode,
  deleteFlowNode,
  renameMindNode,
  deleteMindNode,
} from "@/lib/mermaid-edit";
import { diagramShapes, type DiagramShape } from "@/lib/diagram-catalog";

const COLOR_OPTIONS = [
  { key: "indigo", name: "靛蓝", hex: "#6366f1" },
  { key: "teal", name: "青绿", hex: "#14b8a6" },
  { key: "amber", name: "琥珀", hex: "#f59e0b" },
  { key: "rose", name: "玫瑰", hex: "#f43f5e" },
  { key: "slate", name: "灰蓝", hex: "#94a3b8" },
] as const;

export default function MermaidComposer({
  source,
  writable,
  commit,
  inspector,
  selectedId,
  onSelect,
}: {
  source: string;
  writable: boolean;
  commit: (before: string, after: string) => void;
  inspector?: HTMLDivElement | null;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const [label, setLabel] = useState("新节点"),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [rename, setRename] = useState(""),
    [group, setGroup] = useState("全部"),
    [expanded, setExpanded] = useState(false),
    [confirmMindDelete, setConfirmMindDelete] = useState(false),
    [childLabel, setChildLabel] = useState("");

  const mind = source.trimStart().startsWith("mindmap"),
    nodes = mind ? mindNodes(source) : flowNodes(source),
    supported = mind ? nodes.length > 0 : !source.trim() || isFlowSource(source),
    selectedNode = nodes.find((node) => node.id === selected);
  useEffect(() => {
    if (!selectedId) {
      setSelected("");
      return;
    }
    setSelected(selectedId);
    const list = mind ? mindNodes(source) : flowNodes(source);
    setRename(list.find((node) => node.id === selectedId)?.label || "");
    setConfirmMindDelete(false);
  }, [selectedId, source, mind]);

  const run = (fn: () => string) => {
    if (!writable) return;
    try {
      commit(source, fn());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const add = (kind: DiagramShape) => {
    if (!writable) return;
    if (mind) {
      run(() => addMindNode(source, label.trim() || "新主题", selected));
      return;
    }
    const id = "N" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    try {
      const name = diagramShapes.find((shape) => shape.key === kind)!.name;
      commit(source, addFlowNode(source, name, kind, id));
      setError("");
      setSelected(id);
      setRename(name);
      onSelect?.(id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const connect = (start: string, end: string) => {
    try {
      commit(source, moveMindBranch(source, start, end));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const addMindChild = () => {
    if (!writable || !selectedNode) return;
    try {
      commit(source, addMindNode(source, childLabel.trim() || "新主题", selectedNode.id));
      setError("");
      setChildLabel("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const saveSelected = () => {
    if (!selectedNode) return;
    run(() =>
      mind
        ? renameMindNode(source, selectedNode.id, rename)
        : renameFlowNode(source, selectedNode.id, rename),
    );
  };
  const removeSelected = () => {
    if (!selectedNode) return;
    if (mind) {
      if (!confirmMindDelete) {
        setConfirmMindDelete(true);
        return;
      }
      run(() => deleteMindNode(source, selectedNode.id));
      setSelected("");
      setConfirmMindDelete(false);
      onSelect?.("");
      return;
    }
    run(() => deleteFlowNode(source, selectedNode.id));
    setSelected("");
    onSelect?.("");
  };
  const errorHint = /引号|括号|HTML|符号/.test(error)
    ? "请去掉文字里的引号、括号等符号，或缩短到 100 字以内。"
    : /复杂|重复/.test(error)
      ? "这个形状的源码写法较复杂；请切换到源码视图直接修改文字。"
      : /远端修改/.test(error)
        ? "其他成员刚更新了图表，请核对最新内容后重试。"
        : "";

  const selectedPanelContent = selectedNode && (
    <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-indigo-950">
            已选中{mind ? "主题" : "形状"}
          </p>
          <p className="mt-0.5 max-w-[12rem] truncate text-[10px] text-indigo-700/70">
            {selectedNode.label} · {selectedNode.id}
          </p>
        </div>
        <button
          className="rounded-lg px-2 py-1 text-[10px] text-slate-500 hover:bg-white hover:text-slate-800"
          onClick={() => {
            setSelected("");
            onSelect?.("");
            setConfirmMindDelete(false);
          }}
        >
          取消
        </button>
      </div>
      {mind && (
        <label className="mt-2 block text-[10px] font-medium text-slate-600">
          文字
          <input
            aria-label="选中节点名称"
            disabled={!writable}
            value={rename}
            maxLength={100}
            onChange={(e) => setRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveSelected();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setRename(selectedNode.label);
              }
            }}
            className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mind && (
          <button
            disabled={!writable || rename.trim() === selectedNode.label}
            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white disabled:bg-slate-300"
            onClick={saveSelected}
          >
            更新节点名称
          </button>
        )}
        {!mind ? (
          <button
            disabled={!writable}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            onClick={() =>
              run(() =>
                duplicateFlowNode(
                  source,
                  selectedNode.id,
                  "N" + crypto.randomUUID().replaceAll("-", "").slice(0, 12),
                ),
              )
            }
          >
            复制节点
          </button>
        ) : null}
      </div>
      {mind ? (
        <div className="mt-2 flex items-end gap-1.5">
          <label className="min-w-0 flex-1 text-[10px] font-medium text-slate-600">
            子主题文字
            <input
              aria-label="子主题文字"
              value={childLabel}
              maxLength={100}
              disabled={!writable}
              onChange={(e) => setChildLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMindChild();
                }
              }}
              placeholder="例如：需求评审"
              className="mt-1 w-full rounded-lg border border-indigo-200 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400"
            />
          </label>
          <button
            disabled={!writable}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            onClick={addMindChild}
          >
            添加子主题
          </button>
        </div>
      ) : null}
      {!mind && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-slate-500">颜色</span>
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.key}
              disabled={!writable}
              aria-label={"节点配色 " + color.name}
              title={color.name}
              className="h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-200 hover:scale-110 disabled:opacity-40"
              style={{ background: color.hex }}
              onClick={() => run(() => colorFlowNode(source, selectedNode.id, color.key))}
            />
          ))}
        </div>
      )}
      <button
        disabled={!writable || (mind && selectedNode.id === nodes[0]?.id)}
        className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
          confirmMindDelete && mind
            ? "border-red-300 bg-red-600 text-white"
            : "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
        } disabled:opacity-40`}
        onClick={removeSelected}
      >
        {mind
          ? confirmMindDelete
            ? "确认删除主题及其子主题"
            : "删除主题及其子主题"
          : "删除节点与简单连线"}
      </button>
    </div>
  );
  return (
    <div
      aria-label="Mermaid 拖拽编辑"
      className="mermaid-composer min-w-0 overflow-hidden border-b border-slate-200 bg-white lg:border-b-0 lg:border-r"
    >
      <div className="border-b border-slate-200 bg-white px-3.5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              {mind ? "主题工具" : "图元库"}
            </h2>
          </div>
          {supported && !mind && source ? (
            <label className="text-[11px] text-slate-500">
              排列
              <select
                aria-label="图表布局方向"
                disabled={!writable}
                value={getFlowDirection(source)}
                onChange={(e) => run(() => flowDirection(source, e.target.value))}
                className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="LR">从左到右</option>
                <option value="TB">从上到下</option>
                <option value="RL">从右到左</option>
                <option value="BT">从下到上</option>
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 p-3">
        {!supported ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <p className="font-medium">当前图表使用源码编辑</p>
            <p className="mt-1">
              图形工具只支持 flowchart 流程图和基础 mindmap
              思维导图。为避免覆盖不支持的语法，右侧源码仍可直接编辑。
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800">
                  {mind ? "添加主题" : "添加形状"}
                </h3>
                <span className="text-[10px] text-slate-400">{writable ? "可编辑" : "只读"}</span>
              </div>
              {mind && (
                <label className="mt-2 block text-[11px] font-medium text-slate-600">
                  {mind ? "主题文字" : "形状文字"}
                  <input
                    aria-label="新节点名称"
                    value={label}
                    maxLength={100}
                    disabled={!writable}
                    placeholder={mind ? "例如：需求分析" : "例如：客户提交申请"}
                    onChange={(e) => setLabel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-normal text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              )}
              {!mind && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {["全部", "流程", "数据", "架构", "基础"].map((g) => (
                    <button
                      key={g}
                      aria-pressed={group === g}
                      onClick={() => {
                        setGroup(g);
                        setExpanded(true);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] ${group === g ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {diagramShapes
                  .filter((s) =>
                    mind
                      ? s.key === "process"
                      : (group === "全部" || s.group === group) &&
                        (expanded ||
                          [
                            "process",
                            "decision",
                            "start",
                            "subprocess",
                            "document",
                            "database",
                            "cloud",
                            "service",
                          ].includes(s.key)),
                  )
                  .map((s) => (
                    <button
                      key={s.key}
                      aria-label={mind ? "子主题" : s.name + "图元"}
                      disabled={!writable}
                      draggable={writable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-collab-mermaid", s.key);
                        e.dataTransfer.setData("application/x-collab-label", mind ? label : s.name);
                      }}
                      onClick={() => add(s.key)}
                      className="rounded-lg border border-slate-200 px-2 py-2 text-left transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40"
                    >
                      <DiagramGlyph kind={s.key} />
                      <span className="mt-1 block text-xs font-medium text-slate-700">
                        {mind ? "子主题" : s.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {mind ? "添加到选中主题" : "点击或拖入画布"}
                      </span>
                    </button>
                  ))}
              </div>
              {!mind && (
                <button
                  className="mt-2 text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  onClick={() => {
                    setExpanded((v) => !v);
                    setGroup("全部");
                  }}
                >
                  {expanded ? "收起形状库" : `展开全部 ${diagramShapes.length} 个形状`}
                </button>
              )}
            </section>

            <section>
              {mind && (
                <>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800">主题列表</h3>
                    <span className="text-[10px] text-slate-400">{nodes.length} 个</span>
                  </div>
                  <div
                    aria-label="Mermaid 节点列表"
                    className="flex max-h-64 min-h-20 flex-wrap gap-1.5 overflow-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2"
                    onDragOver={(e) => {
                      if (writable) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!writable) return;
                      const kind = e.dataTransfer.getData("application/x-collab-mermaid");
                      if (diagramShapes.some((s) => s.key === kind)) add(kind as DiagramShape);
                    }}
                  >
                    {!nodes.length && (
                      <span className="p-1 text-xs leading-5 text-slate-500">
                        还没有{mind ? "主题" : "形状"}。先在上方输入文字并点击形状。
                      </span>
                    )}
                    {nodes.map((n) => (
                      <button
                        key={n.id}
                        disabled={!writable}
                        draggable={writable}
                        aria-label={`${mind ? "思维主题" : "流程节点"} ${n.label}`}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("application/x-collab-node", n.id);
                        }}
                        onDragOver={(e) => {
                          if (writable) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!writable) return;
                          const start = e.dataTransfer.getData("application/x-collab-node");
                          if (start) connect(start, n.id);
                          else {
                            const kind = e.dataTransfer.getData("application/x-collab-mermaid");
                            if (diagramShapes.some((s) => s.key === kind))
                              add(kind as DiagramShape);
                          }
                        }}
                        onClick={() => {
                          setSelected(n.id);
                          onSelect?.(n.id);
                          setRename(n.label);
                          setConfirmMindDelete(false);
                        }}
                        className={`min-w-0 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                          selected === n.id
                            ? "border-indigo-400 bg-indigo-50 text-indigo-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                        }`}
                      >
                        <span className="block max-w-[11rem] truncate font-medium">{n.label}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-400">{n.id}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mind
                ? selectedPanelContent
                : inspector && createPortal(selectedPanelContent, inspector)}
            </section>
          </>
        )}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs">
            <p className="font-medium text-red-800">{error}</p>
            {errorHint ? <p className="mt-1 leading-5 text-red-600">{errorHint}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
