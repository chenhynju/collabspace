import { layers, tools, coverageLabels, modes, questions } from "./data.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const root = document.documentElement;

/* ---------------- Theme ---------------- */

const themeMeta = $('meta[name="theme-color"]');
const themeToggle = $("#theme-toggle");

function applyTheme(theme, persist = true) {
  root.setAttribute("data-theme", theme);
  if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#0b0f13" : "#edf0ec");
  if (themeToggle) {
    const dark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "切换为亮色模式" : "切换为深色模式");
  }
  if (persist) {
    try {
      localStorage.setItem("atc-theme", theme);
    } catch (e) {}
  }
}

applyTheme(root.getAttribute("data-theme") || "dark", false);

themeToggle?.addEventListener("click", () => {
  applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

/* ---------------- Mobile menu ---------------- */

const menuToggle = $("#menu-toggle");
const siteNav = $("#site-nav");

function closeMenu() {
  if (!menuToggle || !siteNav) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "打开导航");
  siteNav.classList.remove("is-open");
}

menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
  siteNav?.classList.toggle("is-open", open);
});

$$("#site-nav a").forEach((link) => link.addEventListener("click", closeMenu));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

/* ---------------- Helpers ---------------- */

function layerById(id) {
  return layers.find((layer) => layer.id === id);
}

function toolById(id) {
  return tools.find((tool) => tool.id === id);
}

function layerAverage(layerId) {
  const total = tools.reduce((sum, tool) => sum + tool.layers[layerId], 0);
  return total / (tools.length * 3);
}

function barsMarkup(level) {
  return `<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="cell-level" aria-hidden="true">${level}</span>`;
}

/* ---------------- Layer stack ---------------- */

const stack = $("#layer-stack");

if (stack) {
  stack.innerHTML = layers
    .map((layer) => {
      const pct = Math.round(layerAverage(layer.id) * 100);
      return `
        <button class="stack-row" type="button" data-layer="${layer.id}" aria-label="在矩阵中定位：${layer.name}">
          <span class="stack-no">${layer.no}</span>
          <span class="stack-name">${layer.name}<small>${layer.en}</small></span>
          <span class="stack-meter" aria-hidden="true"><i style="--w:${pct}%"></i></span>
          <span class="stack-arrow" aria-hidden="true">↗</span>
        </button>`;
    })
    .join("");
}

/* ---------------- Layer accordions ---------------- */

const layerList = $("#layer-list");
const allLayersToggle = $("#toggle-all-layers");

if (layerList) {
  layerList.innerHTML = layers
    .map(
      (layer, index) => `
      <details class="layer-card" id="layer-${layer.id}" data-layer="${layer.id}"${index === 0 ? " open" : ""}>
        <summary>
          <span class="layer-no">${layer.no}</span>
          <span>
            <span class="layer-title"><h3>${layer.name}</h3><small>${layer.en}</small></span>
            <span class="layer-tagline">${layer.tagline}</span>
          </span>
          <span class="layer-gate">${layer.gate}</span>
          <span class="layer-plus" aria-hidden="true"></span>
        </summary>
        <div class="layer-body">
          <div class="layer-body-inner">
            <div>
              <p class="layer-summary">${layer.summary}</p>
              <div class="layer-gate-box">${layer.paid}</div>
              <a class="layer-link" href="#matrix" data-layer-link="${layer.id}">在矩阵中查看 →</a>
            </div>
            <ul>${layer.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
          </div>
        </div>
      </details>`,
    )
    .join("");
}

function setAllLayers(open) {
  $$(".layer-card", layerList || document).forEach((card) => {
    card.open = open;
  });
  if (allLayersToggle) {
    allLayersToggle.setAttribute("aria-expanded", String(open));
    allLayersToggle.textContent = open ? "收起全部" : "展开全部";
  }
}

allLayersToggle?.addEventListener("click", () => {
  const open = allLayersToggle.getAttribute("aria-expanded") !== "true";
  setAllLayers(open);
});

/* ---------------- Matrix ---------------- */

const matrixTable = $("#matrix-table");
const modeSwitch = $("#mode-switch");
const layerFilter = $("#layer-filter");
const matrixReset = $("#matrix-reset");
const matrixDetail = $("#matrix-detail");

let activeMode = "all";

if (modeSwitch) {
  modeSwitch.innerHTML = modes
    .map(
      (mode) =>
        `<button type="button" data-mode="${mode.id}" aria-pressed="${mode.id === "all"}">${mode.label}</button>`,
    )
    .join("");
}

if (layerFilter) {
  layerFilter.innerHTML =
    '<option value="all">全部七层</option>' +
    layers.map((layer) => `<option value="${layer.id}">${layer.no} ${layer.name}</option>`).join("");
}

function visibleTools() {
  if (activeMode === "all") return tools;
  return tools.filter((tool) => tool.segments.includes(activeMode));
}

function visibleLayers() {
  const selected = layerFilter?.value || "all";
  return selected === "all" ? layers : layers.filter((layer) => layer.id === selected);
}

function renderMatrix() {
  if (!matrixTable) return;
  const shownTools = visibleTools();
  const shownLayers = visibleLayers();

  const head = `
    <thead>
      <tr>
        <th scope="col"><span class="tool-head"><strong>能力层</strong><span>Layer / Tool</span></span></th>
        ${shownTools
          .map(
            (tool) =>
              `<th scope="col" data-tool="${tool.id}"><span class="tool-head"><strong>${tool.name}</strong><span>${tool.type}</span></span></th>`,
          )
          .join("")}
      </tr>
    </thead>`;

  const body = shownLayers
    .map(
      (layer) => `
      <tr data-row="${layer.id}">
        <th scope="row">
          <span class="row-no">${layer.no}</span>
          <span class="row-name">${layer.name}</span>
          <span class="row-en">${layer.en}</span>
        </th>
        ${shownTools
          .map((tool) => {
            const level = tool.layers[layer.id];
            return `<td><button class="cell" type="button" data-tool="${tool.id}" data-layer="${layer.id}" data-level="${level}" aria-label="${tool.name} · ${layer.name}：${coverageLabels[level]}">${barsMarkup(level)}</button></td>`;
          })
          .join("")}
      </tr>`,
    )
    .join("");

  matrixTable.innerHTML = head + `<tbody>${body}</tbody>`;

  if (!shownTools.length) {
    matrixTable.innerHTML =
      head + `<tbody><tr><td colspan="8" class="matrix-empty">当前筛选下没有工具，请重置筛选。</td></tr></tbody>`;
  }
}

function setActiveRow(layerId) {
  $$("#matrix-table tbody tr").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.row === layerId);
  });
  $$(".stack-row").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.layer === layerId);
  });
}

function focusLayer(layerId, scroll = true) {
  const layer = layerById(layerId);
  if (!layer) return;
  if (layerFilter && layerFilter.value !== "all") {
    layerFilter.value = "all";
    renderMatrix();
  }
  setActiveRow(layerId);
  if (matrixDetail) {
    matrixDetail.innerHTML = `<strong>${layer.no} · ${layer.name}</strong> — ${layer.summary} <span class="mono">${layer.paid}</span>`;
  }
  if (scroll) {
    $("#matrix")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

stack?.addEventListener("click", (event) => {
  const button = event.target.closest(".stack-row");
  if (!button) return;
  focusLayer(button.dataset.layer);
});

layerList?.addEventListener("click", (event) => {
  const link = event.target.closest("[data-layer-link]");
  if (!link) return;
  event.preventDefault();
  focusLayer(link.dataset.layerLink);
});

modeSwitch?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (!button) return;
  activeMode = button.dataset.mode;
  $$("button", modeSwitch).forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  renderMatrix();
});

layerFilter?.addEventListener("change", renderMatrix);

matrixReset?.addEventListener("click", () => {
  activeMode = "all";
  if (modeSwitch) {
    $$("button", modeSwitch).forEach((item) => {
      item.setAttribute("aria-pressed", String(item.dataset.mode === "all"));
    });
  }
  if (layerFilter) layerFilter.value = "all";
  renderMatrix();
  setActiveRow("");
  if (matrixDetail) matrixDetail.textContent = "选择任一格查看工具、层级与编辑说明。";
});

matrixTable?.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const tool = toolById(cell.dataset.tool);
  const layer = layerById(cell.dataset.layer);
  if (!tool || !layer) return;
  const level = tool.layers[layer.id];
  const note = tool.notes?.[layer.id] || layer.gate;
  $$(".cell", matrixTable).forEach((item) => item.classList.toggle("is-active", item === cell));
  setActiveRow(layer.id);
  if (matrixDetail) {
    matrixDetail.innerHTML = `<strong>${tool.name}</strong> × <strong>${layer.name}</strong> · ${coverageLabels[level]} — ${note}`;
  }
});

renderMatrix();

/* ---------------- Tool cards ---------------- */

const toolFilter = $("#tool-filter");
const toolGrid = $("#tool-grid");
const toolModes = [
  { id: "all", label: "全部" },
  { id: "free", label: "免费起步" },
  { id: "team", label: "团队协作" },
  { id: "enterprise", label: "企业治理" },
  { id: "code", label: "代码 / 数据" },
];

if (toolFilter) {
  toolFilter.innerHTML = toolModes
    .map(
      (mode, index) =>
        `<button type="button" data-tool-mode="${mode.id}" aria-pressed="${index === 0}">${mode.label}</button>`,
    )
    .join("");
}

if (toolGrid) {
  toolGrid.innerHTML = tools
    .map(
      (tool, index) => `
      <article class="tool-card" data-tool="${tool.id}" data-segments="${tool.segments.join(" ")}">
        <div class="tool-top">
          <span class="tool-index">T${String(index + 1).padStart(2, "0")}</span>
          <span class="tool-type">${tool.type}</span>
        </div>
        <div>
          <h3>${tool.name}<small>${tool.en}</small></h3>
          <p class="tool-price">${tool.price}</p>
        </div>
        <div class="mini-grid" aria-label="${tool.name} 七层覆盖">
          ${layers
            .map(
              (layer) =>
                `<span class="mini-cell" data-level="${tool.layers[layer.id]}" title="${layer.name}：${coverageLabels[tool.layers[layer.id]]}"><i></i></span>`,
            )
            .join("")}
        </div>
        <div class="mini-labels" aria-hidden="true">${layers.map((layer) => `<span>${layer.no}</span>`).join("")}</div>
        <p class="tool-best"><span>最适合</span>${tool.bestFor}</p>
        <div class="tool-lists">
          <ul class="pros">${tool.pros.map((item) => `<li>${item}</li>`).join("")}</ul>
          <ul class="cons">${tool.cons.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <a class="tool-link" href="${tool.site}" target="_blank" rel="noopener noreferrer">
          查看官网 <span aria-hidden="true">↗</span>
        </a>
      </article>`,
    )
    .join("");
}

toolFilter?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tool-mode]");
  if (!button) return;
  const mode = button.dataset.toolMode;
  $$("button", toolFilter).forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  $$(".tool-card", toolGrid || document).forEach((card) => {
    const segments = (card.dataset.segments || "").split(" ");
    card.hidden = mode !== "all" && !segments.includes(mode);
  });
});

/* ---------------- Advisor ---------------- */

const advisorStage = $("#advisor-stage");
const stepLabel = $("#step-label");
const stepName = $("#step-name");
const progressBar = $("#progress-bar");
const advisorBack = $("#advisor-back");
const advisorNext = $("#advisor-next");
const advisorReset = $("#advisor-reset");

const answers = {};
let step = 0;
let finished = false;

const sceneWeights = {
  architecture: { foundation: 1, library: 2, collab: 0.6, data: 2.2, governance: 0.4, export: 1.2, ai: 0.4 },
  product: { foundation: 1, library: 1.2, collab: 2, data: 0.6, governance: 0.5, export: 1, ai: 1 },
  workshop: { foundation: 1, library: 1, collab: 3, data: 0.3, governance: 0.5, export: 0.8, ai: 1 },
  formal: { foundation: 1, library: 1, collab: 1, data: 0.8, governance: 2.5, export: 2, ai: 0.4 },
  personal: { foundation: 1.6, library: 0.5, collab: 0.2, data: 0.3, governance: 0.1, export: 0.6, ai: 0.8 },
};

const sceneLabels = {
  architecture: "架构 / 流程图",
  product: "产品设计 / 线框",
  workshop: "脑暴 / 工作坊",
  formal: "正式流程 / 合规",
  personal: "个人快速草图",
};

const sizeLabels = {
  "1": "个人使用",
  "2-10": "2–10 人小团队",
  "11-50": "11–50 人团队",
  "50+": "50 人以上组织",
};

const budgetLabels = {
  free: "免费优先",
  team: "团队档预算",
  enterprise: "企业采购",
};

function renderProgress() {
  if (stepLabel) stepLabel.textContent = finished ? "RESULT" : `${String(step + 1).padStart(2, "0")} / 06`;
  if (stepName) stepName.textContent = finished ? "建议" : questions[step]?.title.replace(/[？?].*$/, "") || "场景";
  if (progressBar) progressBar.style.width = finished ? "100%" : `${((step + 1) / questions.length) * 100}%`;
}

function renderQuestion() {
  if (!advisorStage) return;
  const question = questions[step];
  const selected = answers[question.id];
  advisorStage.innerHTML = `
    <div class="question">
      <h3 tabindex="-1">${question.title}</h3>
      <p class="question-hint">${question.hint}</p>
      <fieldset class="options">
        <legend class="sr-only">${question.title}</legend>
        ${question.options
          .map(
            (option, index) => `
            <label class="option${selected === option.value ? " is-checked" : ""}${question.options.length % 2 === 1 && index === question.options.length - 1 ? " option-wide" : ""}">
              <input type="radio" name="${question.id}" value="${option.value}" ${selected === option.value ? "checked" : ""} />
              <span class="radio" aria-hidden="true"></span>
              <span><strong>${option.label}</strong><small>${option.desc}</small></span>
            </label>`,
          )
          .join("")}
      </fieldset>
    </div>`;
  renderProgress();
  if (advisorBack) advisorBack.disabled = step === 0;
  if (advisorNext) {
    advisorNext.hidden = false;
    advisorNext.disabled = !selected;
    advisorNext.textContent = step === questions.length - 1 ? "查看建议" : "下一步";
  }
  if (advisorReset) advisorReset.hidden = true;

  $$("input", advisorStage).forEach((input) => {
    input.addEventListener("change", () => {
      answers[question.id] = input.value;
      $$(".option", advisorStage).forEach((label) => {
        const item = label.querySelector("input");
        label.classList.toggle("is-checked", item?.checked === true);
      });
      if (advisorNext) advisorNext.disabled = false;
    });
  });

  const heading = advisorStage.querySelector("h3");
  if (heading) heading.focus({ preventScroll: true });
}

function scoreTools() {
  const scene = answers.scene || "architecture";
  const weights = sceneWeights[scene];
  const maxBase = Object.values(weights).reduce((sum, value) => sum + value * 3, 0);
  const candidates = tools.map((tool) => {
    let score = 0;
    Object.entries(weights).forEach(([layerId, weight]) => {
      score += tool.layers[layerId] * weight;
    });

    if (answers.size === "2-10") score += tool.layers.collab * 0.8;
    if (answers.size === "11-50") score += tool.layers.governance * 1.5;
    if (answers.size === "50+") score += tool.layers.governance * 2.5;
    if (answers.realtime === "yes") score += tool.layers.collab * 2;
    if (answers.governance === "yes") score += tool.layers.governance * 2.5;
    if (answers.code === "yes") score += tool.layers.data * 2.5;
    if (answers.budget === "team") score += tool.layers.governance * 0.5;
    if (answers.budget === "enterprise") score += tool.layers.governance * 1 + tool.layers.export * 0.5;

    if (scene === "workshop" && tool.id === "miro") score += 4;
    if (scene === "formal" && ["lucidchart", "visio"].includes(tool.id)) score += 2;
    if (scene === "architecture" && ["drawio", "mermaid", "lucidchart"].includes(tool.id)) score += 0.8;
    if (scene === "personal") {
      if (tool.id === "excalidraw") score += 4;
      else if (tool.id === "drawio") score += 1;
    }
    if (scene === "product" && ["whimsical", "miro"].includes(tool.id)) score += 1.5;

    return { tool, score, maxBase };
  });

  let eligible = candidates;
  const notes = [];

  if (answers.budget === "free") {
    const freeTools = candidates.filter(({ tool }) => tool.segments.includes("free"));
    if (freeTools.length) {
      eligible = freeTools;
      notes.push("预算免费优先，已排除必须按席位付费的产品。");
    }
  }

  if (answers.governance === "yes") {
    const governed = eligible.filter(({ tool }) => tool.layers.governance >= 2);
    if (governed.length) {
      eligible = governed;
    } else {
      notes.push("免费档无法满足 SSO/审计/治理，下面的建议是权衡结果，不是硬门槛达标。");
    }
  }

  if (answers.code === "yes") {
    const withData = eligible.filter(({ tool }) => tool.layers.data >= 2);
    if (withData.length) eligible = withData;
  }

  if (answers.realtime === "yes") {
    const withCollab = eligible.filter(({ tool }) => tool.layers.collab >= 2);
    if (withCollab.length) eligible = withCollab;
  }

  if (!eligible.length) eligible = candidates;

  const maxScore = Math.max(...eligible.map((item) => item.score), 1);
  const ranked = eligible
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item,
      match: Math.max(52, Math.min(98, Math.round(58 + (item.score / maxScore) * 40))),
      relative: Math.round((item.score / maxScore) * 100),
    }));

  return { ranked, notes };
}

function buildReasons(tool) {
  const reasons = [];
  const scene = answers.scene || "architecture";

  const sceneReason = {
    architecture: "你的主要场景是架构/流程图，图形库、导出格式与代码/数据能力比工作坊更重要。",
    product: "你的场景偏产品设计与线框，模板、协作与快速迭代比企业治理更靠前。",
    workshop: "你的场景是脑暴/工作坊，共享光标、引导工具与模板数量是核心。",
    formal: "你的场景是正式流程与合规，权限、审计、评论留痕是准入门槛。",
    personal: "你只需要个人快速草图，免费、上手快、无账号负担比治理重要。",
  };
  reasons.push(sceneReason[scene]);

  if (answers.size === "11-50" || answers.size === "50+") {
    reasons.push(
      `团队规模为 ${sizeLabels[answers.size]}，${tool.name} 的治理层是“${coverageLabels[tool.layers.governance]}”，需要确认角色、审计与所有权转移是否覆盖。`,
    );
  } else if (answers.size === "2-10") {
    reasons.push("2–10 人小团队，优先看实时协作与评论，而不是完整的企业治理。");
  } else {
    reasons.push("个人使用，席位成本与账号体系不应成为负担。");
  }

  if (answers.realtime === "yes") {
    reasons.push(
      `你明确需要多人同时改图，${tool.name} 的协作层为“${coverageLabels[tool.layers.collab]}”，适合先用真实项目做一次共编验收。`,
    );
  }

  if (answers.governance === "yes") {
    reasons.push(
      `SSO/审计/权限治理是硬要求，${tool.name} 在治理层为“${coverageLabels[tool.layers.governance]}”；采购前请让安全团队核对清单。`,
    );
  }

  if (answers.code === "yes") {
    reasons.push(
      `你需要代码生成图或数据联动，${tool.name} 的数据层为“${coverageLabels[tool.layers.data]}”，决定它能否进入研发流程。`,
    );
  }

  if (answers.budget === "free") {
    reasons.push("预算免费优先，推荐只保留免费档就能完成核心工作的工具。");
  } else if (answers.budget === "team") {
    reasons.push("可接受团队档，建议先用 2–3 个真实项目验证协作与评论，再按席位扩容。");
  } else {
    reasons.push("企业采购优先看合规、集成与服务，而不是单点功能数量。");
  }

  return reasons.slice(0, 4);
}

function buildWarnings(tool) {
  const warnings = [...tool.cons];
  if (answers.governance === "yes" && tool.layers.governance < 3) {
    warnings.push("治理层不是完整级，务必确认 SSO、审计与保留策略是否满足采购要求。");
  }
  if (answers.code === "yes" && tool.layers.data < 3) {
    warnings.push("数据/代码层不是完整级，Mermaid 或 SQL/Sheet 联动可能需要额外工具补齐。");
  }
  if (answers.budget === "free" && !tool.segments.includes("free")) {
    warnings.push("该工具的核心能力通常需要付费档。");
  }
  warnings.push("价格与套餐会变化，签约前以官网和销售报价为准。");
  return warnings.slice(0, 4);
}

function showResult() {
  if (!advisorStage) return;
  finished = true;
  const { ranked, notes } = scoreTools();
  const best = ranked[0];
  const alternatives = ranked.slice(1, 3);
  if (!best) {
    advisorStage.innerHTML = '<p class="question-hint">没有找到合适结果，请重置后重试。</p>';
    return;
  }
  const reasons = buildReasons(best.tool);
  const warnings = buildWarnings(best.tool);

  advisorStage.innerHTML = `
    <div class="result">
      <div class="result-top">
        <div>
          <p class="result-label">你的首选 / Primary match</p>
          <h3 class="result-name" tabindex="-1">${best.tool.name}</h3>
          <p class="result-sub">${sceneLabels[answers.scene] || ""} · ${sizeLabels[answers.size] || ""} · ${budgetLabels[answers.budget] || ""}</p>
        </div>
        <div class="score-box">
          <span>匹配度</span>
          <strong>${best.match}</strong>
          <div class="score-track" aria-hidden="true"><i style="width:${best.match}%"></i></div>
        </div>
      </div>
      <div class="result-grid">
        <div class="result-block">
          <h4>为什么是它</h4>
          <ul>${reasons.map((reason) => `<li>${reason}</li>`).join("")}</ul>
        </div>
        <div class="result-block warn">
          <h4>先确认这些</h4>
          <ul>${warnings.map((warning) => `<li>${warning}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="alternatives">
        <span class="alt-chip"><span>备选</span><strong>${alternatives.map((item) => item.tool.name).join(" / ") || "无"}</strong></span>
        ${notes.map((note) => `<span class="alt-chip"><span>注意</span><strong>${note}</strong></span>`).join("")}
      </div>
    </div>`;

  renderProgress();
  if (advisorNext) advisorNext.hidden = true;
  if (advisorBack) advisorBack.hidden = true;
  if (advisorReset) advisorReset.hidden = false;
  advisorStage.querySelector("h3")?.focus({ preventScroll: true });
}

advisorStage?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    event.preventDefault();
    if (step === questions.length - 1) showResult();
    else {
      step += 1;
      renderQuestion();
    }
  }
});

advisorNext?.addEventListener("click", () => {
  if (!answers[questions[step]?.id]) return;
  if (step === questions.length - 1) showResult();
  else {
    step += 1;
    renderQuestion();
  }
});

advisorBack?.addEventListener("click", () => {
  if (step === 0) return;
  finished = false;
  step -= 1;
  renderQuestion();
});

advisorReset?.addEventListener("click", () => {
  Object.keys(answers).forEach((key) => delete answers[key]);
  step = 0;
  finished = false;
  if (advisorBack) advisorBack.hidden = false;
  if (advisorNext) advisorNext.hidden = false;
  renderQuestion();
});

renderQuestion();

/* ---------------- Reveal on scroll ---------------- */

const revealItems = $$(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
  );
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
