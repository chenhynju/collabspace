"use client";

// LaTeX 公式拖拽构建面板：按「三角 / 微积分 / 线性代数 / 概率论」分类的模板卡片。
// - 拖拽：dataTransfer 携带 "application/x-latex" 模板文本，投放目标是编辑器的 textarea
//   （由 LatexEditor 的 onDrop 处理插入到光标处）；
// - 点击：触屏 / 不习惯拖拽时的兜底，通过 onInsert 回调插入；
// - 每张卡片用 KaTeX 行内模式渲染缩略预览，标题为中文名称。
import { useMemo, useState } from "react";
import katex from "katex";
import { GripVertical } from "lucide-react";

export interface FormulaTemplate {
  name: string;
  latex: string;
}

interface Category {
  id: string;
  label: string;
  items: FormulaTemplate[];
}

const CATEGORIES: Category[] = [
  {
    id: "trig",
    label: "三角",
    items: [
      { name: "正弦", latex: "\\sin\\theta" },
      { name: "余弦", latex: "\\cos\\theta" },
      { name: "正切", latex: "\\tan\\theta" },
      { name: "平方和恒等式", latex: "\\sin^2\\theta + \\cos^2\\theta = 1" },
      {
        name: "和角公式",
        latex: "\\sin(\\alpha + \\beta) = \\sin\\alpha\\cos\\beta + \\cos\\alpha\\sin\\beta",
      },
      { name: "倍角公式", latex: "\\sin 2\\theta = 2\\sin\\theta\\cos\\theta" },
      { name: "欧拉公式", latex: "e^{i\\theta} = \\cos\\theta + i\\sin\\theta" },
      {
        name: "正弦定理",
        latex: "\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}",
      },
      { name: "余弦定理", latex: "c^2 = a^2 + b^2 - 2ab\\cos C" },
    ],
  },
  {
    id: "calculus",
    label: "微积分",
    items: [
      {
        name: "导数定义",
        latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}",
      },
      { name: "幂法则", latex: "\\frac{d}{dx} x^n = n x^{n-1}" },
      {
        name: "链式法则",
        latex: "\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}",
      },
      { name: "乘积法则", latex: "(uv)' = u'v + uv'" },
      { name: "不定积分", latex: "\\int f(x) \\, dx" },
      {
        name: "牛顿-莱布尼茨",
        latex: "\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)",
      },
      { name: "分部积分", latex: "\\int u \\, dv = uv - \\int v \\, du" },
      {
        name: "二重积分",
        latex: "\\iint_{D} f(x, y) \\, d\\sigma",
      },
      {
        name: "三重积分",
        latex: "\\iiint_{\\Omega} f(x, y, z) \\, dV",
      },
      {
        name: "曲面积分（对面积）",
        latex: "\\iint_{\\Sigma} f(x, y, z) \\, dS",
      },
      {
        name: "曲面积分（对坐标）",
        latex:
          "\\iint_{\\Sigma} P \\, dy\\,dz + Q \\, dz\\,dx + R \\, dx\\,dy",
      },
      {
        name: "曲线积分",
        latex: "\\oint_{C} P \\, dx + Q \\, dy",
      },
      {
        name: "泰勒展开",
        latex: "f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!} (x-a)^n",
      },
    ],
  },
  {
    id: "linalg",
    label: "线性代数",
    items: [
      {
        name: "矩阵",
        latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}",
      },
      { name: "行列式", latex: "\\det(A) = ad - bc" },
      { name: "矩阵乘法", latex: "(AB)_{ij} = \\sum_{k} a_{ik} b_{kj}" },
      { name: "特征值", latex: "A\\vec{v} = \\lambda \\vec{v}" },
      { name: "逆矩阵", latex: "A A^{-1} = I" },
      { name: "转置性质", latex: "(AB)^T = B^T A^T" },
      {
        name: "点积",
        latex: "\\vec{a} \\cdot \\vec{b} = \\sum_{i=1}^{n} a_i b_i",
      },
      {
        name: "线性组合",
        latex: "c_1\\vec{v}_1 + c_2\\vec{v}_2 + \\cdots + c_n\\vec{v}_n",
      },
    ],
  },
  {
    id: "prob",
    label: "概率论",
    items: [
      { name: "条件概率", latex: "P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}" },
      {
        name: "贝叶斯定理",
        latex: "P(A \\mid B) = \\frac{P(B \\mid A) \\, P(A)}{P(B)}",
      },
      { name: "期望", latex: "E[X] = \\sum_{i} x_i p_i" },
      { name: "方差", latex: "\\mathrm{Var}(X) = E[X^2] - (E[X])^2" },
      {
        name: "正态分布",
        latex: "f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}",
      },
      {
        name: "二项分布",
        latex: "P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}",
      },
      { name: "全概率公式", latex: "P(A) = \\sum_{i} P(A \\mid B_i) \\, P(B_i)" },
      { name: "大数定律", latex: "\\bar{X}_n \\xrightarrow{P} \\mu" },
    ],
  },
  {
    id: "greek",
    label: "希腊字母",
    items: [
      // 小写（按字母表顺序；omicron 与拉丁 o 同形，LaTeX 无对应命令，略）
      { name: "alpha", latex: "\\alpha" },
      { name: "beta", latex: "\\beta" },
      { name: "gamma", latex: "\\gamma" },
      { name: "delta", latex: "\\delta" },
      { name: "epsilon", latex: "\\varepsilon" },
      { name: "zeta", latex: "\\zeta" },
      { name: "eta", latex: "\\eta" },
      { name: "theta", latex: "\\theta" },
      { name: "iota", latex: "\\iota" },
      { name: "kappa", latex: "\\kappa" },
      { name: "lambda", latex: "\\lambda" },
      { name: "mu", latex: "\\mu" },
      { name: "nu", latex: "\\nu" },
      { name: "xi", latex: "\\xi" },
      { name: "pi", latex: "\\pi" },
      { name: "rho", latex: "\\rho" },
      { name: "sigma", latex: "\\sigma" },
      { name: "tau", latex: "\\tau" },
      { name: "upsilon", latex: "\\upsilon" },
      { name: "phi", latex: "\\varphi" },
      { name: "chi", latex: "\\chi" },
      { name: "psi", latex: "\\psi" },
      { name: "omega", latex: "\\omega" },
      // 大写（仅收录与拉丁字母不同形的）
      { name: "Gamma", latex: "\\Gamma" },
      { name: "Delta", latex: "\\Delta" },
      { name: "Theta", latex: "\\Theta" },
      { name: "Lambda", latex: "\\Lambda" },
      { name: "Xi", latex: "\\Xi" },
      { name: "Pi", latex: "\\Pi" },
      { name: "Sigma", latex: "\\Sigma" },
      { name: "Upsilon", latex: "\\Upsilon" },
      { name: "Phi", latex: "\\Phi" },
      { name: "Psi", latex: "\\Psi" },
      { name: "Omega", latex: "\\Omega" },
    ],
  },
];

export const LATEX_DND_TYPE = "application/x-latex";

function TemplateCard({
  item,
  onInsert,
  disabled = false,
}: {
  item: FormulaTemplate;
  onInsert: (latex: string) => void;
  disabled?: boolean;
}) {
  // 模板是静态常量，渲染结果缓存一次即可
  const html = useMemo(() => {
    try {
      return katex.renderToString(item.latex, {
        displayMode: false,
        throwOnError: true,
        strict: false,
        trust: false,
        maxExpand: 200,
        maxSize: 20,
      });
    } catch {
      return null;
    }
  }, [item.latex]);

  return (
    <button
      type="button"
      disabled={disabled}
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData(LATEX_DND_TYPE, item.latex);
        // 兼容只认 text/plain 的投放目标
        e.dataTransfer.setData("text/plain", item.latex);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(item.latex)}
      title={`点击或拖拽插入：${item.latex}`}
      className="group flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center transition-colors hover:border-blue-400 hover:bg-slate-100 active:cursor-grabbing"
    >
      <span className="flex min-h-6 max-w-full items-center justify-center overflow-hidden text-slate-900 [&_.katex]:text-[0.95rem]">
        {html ? (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="font-mono text-xs">{item.latex}</span>
        )}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-slate-500 group-hover:text-slate-900">
        <GripVertical size={11} className="shrink-0 opacity-50" />
        {item.name}
      </span>
    </button>
  );
}

export function FormulaPalette({
  onInsert,
  disabled = false,
}: {
  onInsert: (latex: string) => void;
  disabled?: boolean;
}) {
  const [catId, setCatId] = useState(CATEGORIES[0].id);
  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatId(c.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                catId === c.id
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">拖拽卡片到编辑框，或点击直接插入</p>
      </div>
      <div
        className={`grid gap-2 p-4 ${
          cat.id === "greek"
            ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        }`}
      >
        {cat.items.map((item) => (
          <TemplateCard key={item.name} item={item} onInsert={onInsert} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}
