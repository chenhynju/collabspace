"use client";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import LinkExtension from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import * as Y from "yjs";
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from "y-prosemirror";
import { DocumentProvider, from64, to64 } from "@/lib/document-provider";

function positions(provider: DocumentProvider) {
  return Extension.create({
    name: "remoteSelections",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const sync = ySyncPluginKey.getState(state);
              if (!sync?.binding) return null;
              const items: Decoration[] = [];
              for (const m of provider.members) {
                if (!m.selection) continue;
                try {
                  const a = relativePositionToAbsolutePosition(
                      provider.doc,
                      sync.type,
                      Y.decodeRelativePosition(from64(m.selection.anchor)),
                      sync.binding.mapping,
                    ),
                    b = relativePositionToAbsolutePosition(
                      provider.doc,
                      sync.type,
                      Y.decodeRelativePosition(from64(m.selection.head)),
                      sync.binding.mapping,
                    );
                  if (a === null || b === null) continue;
                  const color = `hsl(${[...m.userId].reduce((n, c) => n + c.charCodeAt(0), 0) % 360} 65% 42%)`;
                  if (a !== b)
                    items.push(
                      Decoration.inline(Math.min(a, b), Math.max(a, b), {
                        style: `background:${color.replace("42%", "90%")}`,
                      }),
                    );
                  items.push(
                    Decoration.widget(
                      b,
                      () => {
                        const el = document.createElement("span");
                        el.className = "collab-caret";
                        el.style.borderColor = color;
                        el.setAttribute("aria-label", `${m.name} 的光标`);
                        const label = document.createElement("span");
                        label.textContent = m.name;
                        label.style.background = color;
                        el.append(label);
                        return el;
                      },
                      { key: m.sessionId },
                    ),
                  );
                } catch {
                  continue;
                }
              }
              return DecorationSet.create(state.doc, items);
            },
          },
        }),
      ];
    },
  });
}
export function RichEditor({
  provider,
  onSelection,
}: {
  provider: DocumentProvider;
  onSelection: (
    v: { quote: string; anchor: { start: string; end: string } } | null,
  ) => void;
}) {
  const [, render] = useState(0);
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ history: false }),
        LinkExtension.configure({
          openOnClick: false,
          protocols: ["https", "http"],
          HTMLAttributes: { rel: "noopener noreferrer" },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Collaboration.configure({ document: provider.doc }),
        positions(provider),
      ],
      editable: provider.writable,
      editorProps: {
        attributes: {
          class: "collab-editor",
          role: "textbox",
          "aria-label": "协作文档正文",
          "aria-multiline": "true",
        },
      },
      onSelectionUpdate: ({ editor: e }) => {
        const { from, to } = e.state.selection;
        const sync = ySyncPluginKey.getState(e.state);
        if (!sync?.binding) return;
        const a = to64(
            Y.encodeRelativePosition(
              absolutePositionToRelativePosition(
                from,
                sync.type,
                sync.binding.mapping,
              ),
            ),
          ),
          b = to64(
            Y.encodeRelativePosition(
              absolutePositionToRelativePosition(
                to,
                sync.type,
                sync.binding.mapping,
              ),
            ),
          );
        provider.selection({ anchor: a, head: b });
        onSelection(
          from === to
            ? null
            : {
                quote: e.state.doc.textBetween(from, to, " ").slice(0, 1000),
                anchor: { start: a, end: b },
              },
        );
      },
    },
    [provider],
  );
  useEffect(
    () =>
      provider.subscribe(() => {
        editor?.setEditable(provider.writable);
        if (editor && !editor.isDestroyed)
          editor.view.dispatch(editor.state.tr);
        render((n) => n + 1);
      }),
    [provider, editor],
  );
  if (!editor) return <p>正在加载编辑器…</p>;
  const tools: [string, () => void][] = [
    ["粗体", () => editor.chain().focus().toggleBold().run()],
    ["斜体", () => editor.chain().focus().toggleItalic().run()],
    ["标题", () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
    ["列表", () => editor.chain().focus().toggleBulletList().run()],
    ["任务", () => editor.chain().focus().toggleTaskList().run()],
    ["引用", () => editor.chain().focus().toggleBlockquote().run()],
    ["代码", () => editor.chain().focus().toggleCode().run()],
    [
      "链接",
      () => {
        const url = window.prompt("HTTPS 链接");
        if (url && /^https?:\/\//i.test(url))
          editor.chain().focus().setLink({ href: url }).run();
      },
    ],
    ["撤销", () => editor.commands.undo()],
    ["重做", () => editor.commands.redo()],
  ];
  return (
    <>
      <div
        className="flex flex-wrap gap-2 border-b p-3"
        role="toolbar"
        aria-label="正文格式"
      >
        {tools.map(([label, action]) => (
          <button
            key={label}
            type="button"
            className="rounded px-2 py-1 text-sm hover:bg-slate-100 disabled:opacity-40"
            disabled={!provider.writable}
            onMouseDown={(e) => e.preventDefault()}
            onClick={action}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
      <button
        type="button"
        className="m-4 text-sm text-blue-700"
        onClick={() => {
          const blob = new Blob([editor.getText()], {
              type: "text/plain;charset=utf-8",
            }),
            url = URL.createObjectURL(blob),
            a = document.createElement("a");
          a.href = url;
          a.download = "collabspace-draft.txt";
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        导出本地纯文本草稿
      </button>
    </>
  );
}
export default function DocumentEditor({
  docId,
  org,
  user,
  onReady,
  onSelection,
}: {
  docId: string;
  org: string;
  user: string;
  onReady: (p: DocumentProvider) => void;
  onSelection: (s: any) => void;
}) {
  const [provider, setProvider] = useState<DocumentProvider | null>(null),
    [error, setError] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    let alive = true;
    const p = new DocumentProvider(docId, org, user);
    const unsubscribe = p.subscribe(() => {
      if (alive) refresh((n) => n + 1);
    });
    p.init()
      .then(() => {
        if (alive) {
          setProvider(p);
          onReady(p);
        }
      })
      .catch(() => {
        if (alive) setError("无法打开本地存储。请检查浏览器存储权限后重试。");
      });
    return () => {
      alive = false;
      unsubscribe();
      void p.destroy();
    };
  }, [docId, org, user, onReady]);
  return error ? (
    <p role="alert" className="p-6 text-red-700">
      {error}
    </p>
  ) : provider?.ready ? (
    <RichEditor provider={provider} onSelection={onSelection} />
  ) : (
    <p className="p-6">正在读取本地草稿…</p>
  );
}
