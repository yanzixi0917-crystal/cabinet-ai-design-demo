const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const scenarios = {
  water: {
    name: "城北水厂低压配电改造",
    file: "城北水厂_低压配电技术要求.pdf",
    meta: "PDF · 18页 · 4.8 MB",
    voltage: 400, current: 1600, circuits: 8, ip: "IP31", environment: "户内",
    width: 800, height: 2200, depth: 800,
    params: [
      ["使用场景", "户内配电室", "96%", "第3页 2.1：设备安装于低压配电室内"],
      ["额定电压", "AC 400 V", "99%", "第6页 参数表：额定工作电压 400V"],
      ["额定电流", "1600 A", "98%", "第6页 参数表：主母线额定电流 1600A"],
      ["出线回路", "8 路", "94%", "第8页 回路表：有效出线回路共8路"],
      ["防护等级", "IP31", "99%", "第4页 3.2：柜体防护等级为IP31"],
      ["安装限宽", "≤ 900 mm", "91%", "第11页 平面布置图：柜位净宽900mm"],
      ["进出线方式", "上进下出", "88%", "第5页：电缆采用上进线、下出线方式"]
    ],
    issues: [
      ["缺少短路耐受参数", "未识别到额定短时耐受电流及持续时间，无法完成母排相关校核。", "缺失项 · SAFE-006"],
      ["安装净高需要确认", "平面图标注净高2300mm，柜高2200mm；是否预留母线桥及散热空间尚不明确。", "低置信度 · MECH-014"]
    ]
  },
  factory: {
    name: "精密制造车间动力柜",
    file: "制造车间_动力配电参数表.xlsx",
    meta: "Excel · 6个工作表 · 1.2 MB",
    voltage: 400, current: 630, circuits: 12, ip: "IP42", environment: "防腐",
    width: 1000, height: 2200, depth: 800,
    params: [
      ["使用场景", "车间动力配电", "97%", "Sheet 需求总表 C8：精密制造车间"],
      ["额定电压", "AC 400 V", "99%", "Sheet 电气参数 B4：400V"],
      ["额定电流", "630 A", "99%", "Sheet 电气参数 B5：630A"],
      ["出线回路", "12 路", "96%", "Sheet 回路清单：有效记录12条"],
      ["防护等级", "IP42", "98%", "Sheet 技术要求 B12：IP42"],
      ["柜体材质", "覆铝锌板", "92%", "Sheet 技术要求 B16：覆铝锌板"],
      ["进出线方式", "下进下出", "95%", "Sheet 技术要求 B19：下进下出"]
    ],
    issues: [
      ["环境描述不完整", "腐蚀介质类别和浓度未提供，现有信息不足以确认防腐等级。", "缺失项 · ENV-009"],
      ["回路表存在重复编号", "QF-07在两个工作表中出现且功率不同，需要确认是否为同一回路。", "数据冲突 · DATA-003"]
    ]
  },
  outdoor: {
    name: "户外泵站控制配电箱",
    file: "泵站配电箱_现场照片及要求.zip",
    meta: "ZIP · 9张图片 + 1份Word · 16.4 MB",
    voltage: 380, current: 250, circuits: 6, ip: "IP31", environment: "户外",
    width: 700, height: 1800, depth: 600,
    params: [
      ["使用场景", "户外泵站", "96%", "技术要求第1条：安装在泵房外侧平台"],
      ["额定电压", "AC 380 V", "98%", "铭牌照片 OCR：额定电压380V"],
      ["额定电流", "250 A", "91%", "技术要求表格：进线开关250A"],
      ["出线回路", "6 路", "89%", "现场照片及文字清单综合识别"],
      ["防护等级", "IP31", "99%", "Word第2页：柜体IP31"],
      ["安装方式", "落地安装", "93%", "现场照片判断，需复核"],
      ["进出线方式", "下进下出", "87%", "电缆沟照片推测，需复核"]
    ],
    issues: [
      ["环境与防护参数疑似冲突", "资料同时出现“户外安装”和“IP31”。系统不能自动判定合规，请按项目规范复核。", "规则冲突 · ENV-004"],
      ["现场尺寸缺失", "照片未包含可靠比例尺，无法从图片准确反推安装宽度和高度。", "缺失项 · MECH-002"]
    ]
  }
};

let state = { scenario: "water", environment: "户内", selectedModel: "GGD", view: "front", analyzed: false, confirmed: false };
let sourceVisible = false;

const elements = {
  scenario: $("#scenario"), projectName: $("#projectName"), fileName: $("#fileName"), fileMeta: $("#fileMeta"),
  voltage: $("#voltage"), current: $("#current"), circuits: $("#circuits"), ip: $("#ipLevel"),
  analyze: $("#analyzeButton"), empty: $("#emptyState"), analysis: $("#analysisContent"), runState: $("#runState"),
  solution: $("#solution"), drawing: $("#drawing"), paramList: $("#paramList"), issues: $("#issues"),
  modelCards: $("#modelCards"), drawingSvg: $("#cabinetDrawing"), toast: $("#toast")
};

function setScenario(key) {
  state = { ...state, scenario: key, environment: scenarios[key].environment, selectedModel: "GGD", analyzed: false, confirmed: false };
  const s = scenarios[key];
  elements.projectName.textContent = s.name;
  elements.fileName.textContent = s.file;
  elements.fileMeta.textContent = s.meta;
  elements.voltage.value = s.voltage;
  elements.current.value = s.current;
  elements.circuits.value = s.circuits;
  elements.ip.value = s.ip;
  $("#cabinetWidth").value = s.width;
  $("#cabinetHeight").value = s.height;
  $("#cabinetDepth").value = s.depth;
  $$(".segmented button").forEach(btn => btn.classList.toggle("active", btn.dataset.value === s.environment));
  elements.analysis.classList.add("hidden");
  elements.empty.classList.remove("hidden", "scanning");
  elements.runState.className = "run-state";
  elements.runState.innerHTML = "<span></span> 等待解析";
  elements.solution.classList.add("locked");
  elements.drawing.classList.add("locked");
  updatePipeline(0);
  updateDrawing();
}

function updatePipeline(activeIndex) {
  $$(".pipeline-step").forEach((step, index) => {
    step.classList.toggle("active", index === activeIndex);
    step.classList.toggle("done", index < activeIndex);
  });
}

function renderAnalysis() {
  const s = scenarios[state.scenario];
  const live = {
    "额定电压": `${elements.voltage.value} V`, "额定电流": `${elements.current.value} A`,
    "出线回路": `${elements.circuits.value} 路`, "防护等级": elements.ip.value, "使用场景": state.environment
  };
  elements.paramList.innerHTML = s.params.map(([label, value, confidence, source]) => `
    <div class="param-item">
      <span>${label}</span><strong>${live[label] || value}</strong><i class="confidence">${confidence}</i>
      <div class="source-line">原文定位：${source}</div>
    </div>`).join("");
  elements.paramList.classList.toggle("show-sources", sourceVisible);

  let issues = [...s.issues];
  if (state.environment === "户外" && elements.ip.value.toUpperCase() === "IP31" && state.scenario !== "outdoor") {
    issues.unshift(["环境与防护参数需要复核", "当前选择为户外环境，但防护字段仍为IP31。系统仅提示冲突，不自动修改工程参数。", "规则冲突 · ENV-004"]);
  }
  elements.issues.innerHTML = issues.map(([title, detail, tag]) => `
    <div class="issue"><span class="issue-mark">!</span><p><strong>${title}</strong><small>${detail}</small><button data-resolve>${tag}</button></p></div>`).join("");
  $("#issueCount").innerHTML = `${issues.length}<small>项</small>`;
  $(".count-badge").textContent = issues.length;
  $$('[data-resolve]').forEach(btn => btn.addEventListener("click", () => toast("此处将接入工程师确认与批注流程")));
}

function startAnalysis() {
  elements.analyze.disabled = true;
  elements.analyze.querySelector("span").textContent = "正在解析…";
  elements.empty.classList.add("scanning");
  elements.runState.className = "run-state running";
  elements.runState.innerHTML = "<span></span> OCR与语义解析中";
  updatePipeline(1);

  const states = ["正在识别文档结构", "正在抽取工程参数", "正在执行冲突检查"];
  let index = 0;
  const interval = setInterval(() => {
    elements.runState.innerHTML = `<span></span> ${states[index++] || states[2]}`;
  }, 650);

  setTimeout(() => {
    clearInterval(interval);
    state.analyzed = true;
    renderAnalysis();
    elements.empty.classList.add("hidden");
    elements.empty.classList.remove("scanning");
    elements.analysis.classList.remove("hidden");
    elements.runState.className = "run-state done";
    elements.runState.innerHTML = "<span></span> 解析完成 · 1.8秒";
    elements.analyze.disabled = false;
    elements.analyze.querySelector("span").textContent = "重新解析";
    toast("需求解析完成，发现需要人工确认的项目");
  }, 2300);
}

const models = [
  { name: "GGD", label: "固定式低压配电柜", score: 92, bullets: ["适配当前额定参数", "企业历史案例较多", "参数化模板已就绪"] },
  { name: "GCS", label: "抽屉式低压开关柜", score: 78, bullets: ["维护便利性较高", "空间利用率较好", "需补充抽屉规格"] },
  { name: "MNS", label: "模块化低压开关柜", score: 64, bullets: ["模块扩展能力强", "当前需求可能过配", "成本参数待补充"] }
];

function renderModels() {
  elements.modelCards.innerHTML = models.map(model => `
    <article class="model-card ${model.name === state.selectedModel ? "selected" : ""}" data-model="${model.name}">
      <div class="model-score">${model.score}%</div>
      <h3>${model.name}</h3><span>${model.label}</span>
      <ul>${model.bullets.map(item => `<li>${item}</li>`).join("")}</ul>
    </article>`).join("");
  $$(".model-card").forEach(card => card.addEventListener("click", () => chooseModel(card.dataset.model)));
}

function confirmParameters() {
  state.confirmed = true;
  elements.solution.classList.remove("locked");
  renderModels();
  updatePipeline(2);
  elements.solution.scrollIntoView({ behavior: "smooth", block: "start" });
  toast("参数已锁定，规则引擎已生成候选方案");
}

function chooseModel(model) {
  state.selectedModel = model;
  renderModels();
  elements.drawing.classList.remove("locked");
  $("#chosenModel").textContent = model;
  $("#drawingTitle").textContent = `${model} 低压配电柜 初步方案`;
  updateDrawing();
  updatePipeline(3);
  setTimeout(() => elements.drawing.scrollIntoView({ behavior: "smooth", block: "start" }), 180);
  toast(`已选择 ${model} 方案，参数化图纸已更新`);
}

function svgEl(tag, attrs = {}, text = "") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  if (text) el.textContent = text;
  return el;
}

function line(svg, x1, y1, x2, y2, dashed = false) {
  svg.appendChild(svgEl("line", { x1, y1, x2, y2, stroke: "#17212b", "stroke-width": 1.25, ...(dashed ? { "stroke-dasharray": "5 4" } : {}) }));
}

function dimension(svg, x1, y1, x2, y2, label, vertical = false) {
  line(svg, x1, y1, x2, y2);
  if (vertical) { line(svg, x1 - 5, y1, x1 + 5, y1); line(svg, x2 - 5, y2, x2 + 5, y2); }
  else { line(svg, x1, y1 - 5, x1, y1 + 5); line(svg, x2, y2 - 5, x2, y2 + 5); }
  svg.appendChild(svgEl("text", { x: (x1 + x2) / 2 + (vertical ? 17 : 0), y: (y1 + y2) / 2 + (vertical ? 4 : -8), "font-size": 12, fill: "#17212b", "text-anchor": "middle", transform: vertical ? `rotate(-90 ${(x1+x2)/2+17} ${(y1+y2)/2+4})` : "" }, label));
}

function updateDrawing() {
  const svg = elements.drawingSvg;
  svg.innerHTML = "";
  const w = Number($("#cabinetWidth").value);
  const h = Number($("#cabinetHeight").value);
  const d = Number($("#cabinetDepth").value);
  const circuits = Math.max(1, Math.min(24, Number(elements.circuits.value) || 1));
  $("#widthOut").textContent = `${w} mm`;
  $("#heightOut").textContent = `${h} mm`;
  $("#depthOut").textContent = `${d} mm`;
  $("#chosenCircuits").textContent = circuits;
  $("#chosenIp").textContent = elements.ip.value.toUpperCase();

  const defs = svgEl("defs");
  const pattern = svgEl("pattern", { id: "hatch", width: 8, height: 8, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pattern.appendChild(svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#9aa8b2", "stroke-width": 1 }));
  defs.appendChild(pattern); svg.appendChild(defs);

  svg.appendChild(svgEl("text", { x: 60, y: 40, "font-size": 14, "font-weight": 700, fill: "#17212b" }, `${state.selectedModel} ${state.view === "front" ? "正视图" : state.view === "side" ? "侧视图" : "柜内元器件布局示意"}`));
  svg.appendChild(svgEl("text", { x: 60, y: 60, "font-size": 9, fill: "#6f7b82" }, "AI PARAMETRIC PRELIMINARY DRAWING · DEMO ONLY"));

  if (state.view === "front") drawFront(svg, w, h, circuits);
  if (state.view === "side") drawSide(svg, d, h);
  if (state.view === "layout") drawLayout(svg, w, h, circuits);
}

function drawFront(svg, width, height, circuits) {
  const ratio = width / height;
  const drawH = 390, drawW = Math.min(260, drawH * ratio);
  const x = 390 - drawW / 2, y = 75;
  svg.appendChild(svgEl("rect", { x, y, width: drawW, height: drawH, fill: "none", stroke: "#17212b", "stroke-width": 2 }));
  svg.appendChild(svgEl("rect", { x: x + 8, y: y + 8, width: drawW - 16, height: drawH - 16, fill: "none", stroke: "#17212b" }));
  line(svg, x + drawW * .64, y + 8, x + drawW * .64, y + drawH - 8);
  svg.appendChild(svgEl("rect", { x: x + 22, y: y + 36, width: drawW * .46, height: 62, fill: "url(#hatch)", stroke: "#17212b" }));
  const rows = Math.min(6, Math.ceil(circuits / 2));
  for (let i = 0; i < rows; i++) {
    const yy = y + 125 + i * 38;
    svg.appendChild(svgEl("rect", { x: x + 22, y: yy, width: drawW * .42, height: 22, fill: "none", stroke: "#17212b" }));
    svg.appendChild(svgEl("circle", { cx: x + drawW * .78, cy: yy + 11, r: 6, fill: "none", stroke: "#17212b" }));
  }
  svg.appendChild(svgEl("circle", { cx: x + drawW - 22, cy: y + drawH / 2, r: 4, fill: "#17212b" }));
  line(svg, x - 10, y + drawH + 18, x + drawW + 10, y + drawH + 18, true);
  dimension(svg, x, y + drawH + 40, x + drawW, y + drawH + 40, `W = ${width}`);
  dimension(svg, x - 38, y, x - 38, y + drawH, `H = ${height}`, true);
  svg.appendChild(svgEl("text", { x: x + drawW + 42, y: y + 74, "font-size": 9, fill: "#65717f" }, `${circuits} 回路`));
  line(svg, x + drawW * .64, y + 90, x + drawW + 35, y + 70, true);
}

function drawSide(svg, depth, height) {
  const drawH = 390, drawW = Math.min(280, drawH * depth / height);
  const x = 390 - drawW / 2, y = 75;
  svg.appendChild(svgEl("rect", { x, y, width: drawW, height: drawH, fill: "none", stroke: "#17212b", "stroke-width": 2 }));
  for (let i = 0; i < 7; i++) line(svg, x + 25 + i * 12, y + 35, x + 25 + i * 12, y + 62);
  for (let i = 0; i < 7; i++) line(svg, x + drawW - 95 + i * 12, y + drawH - 62, x + drawW - 95 + i * 12, y + drawH - 35);
  line(svg, x + 12, y + 78, x + drawW - 12, y + 78, true);
  line(svg, x + 12, y + drawH - 90, x + drawW - 12, y + drawH - 90, true);
  dimension(svg, x, y + drawH + 40, x + drawW, y + drawH + 40, `D = ${depth}`);
  dimension(svg, x - 38, y, x - 38, y + drawH, `H = ${height}`, true);
}

function drawLayout(svg, width, height, circuits) {
  const ratio = width / height;
  const drawH = 390, drawW = Math.min(270, drawH * ratio);
  const x = 390 - drawW / 2, y = 75;
  svg.appendChild(svgEl("rect", { x, y, width: drawW, height: drawH, fill: "none", stroke: "#17212b", "stroke-width": 2 }));
  svg.appendChild(svgEl("rect", { x: x + 20, y: y + 24, width: drawW - 40, height: 48, fill: "url(#hatch)", stroke: "#17212b" }));
  svg.appendChild(svgEl("text", { x: x + drawW / 2, y: y + 53, "font-size": 9, "text-anchor": "middle", fill: "#17212b" }, "主母排区 · 待复核"));
  const cols = circuits > 8 ? 3 : 2;
  const rows = Math.ceil(circuits / cols);
  const cellW = (drawW - 42) / cols;
  const cellH = Math.min(46, 245 / rows);
  for (let i = 0; i < circuits; i++) {
    const cx = x + 20 + (i % cols) * cellW;
    const cy = y + 95 + Math.floor(i / cols) * cellH;
    svg.appendChild(svgEl("rect", { x: cx, y: cy, width: cellW - 8, height: cellH - 8, fill: "none", stroke: "#17212b" }));
    svg.appendChild(svgEl("text", { x: cx + (cellW - 8) / 2, y: cy + cellH / 2, "font-size": 7, "text-anchor": "middle", fill: "#17212b" }, `QF-${String(i + 1).padStart(2, "0")}`));
  }
  dimension(svg, x, y + drawH + 40, x + drawW, y + drawH + 40, `W = ${width}`);
  dimension(svg, x - 38, y, x - 38, y + drawH, `H = ${height}`, true);
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportJson() {
  const payload = {
    demo: true, warning: "演示数据，不可用于工程生产", project: scenarios[state.scenario].name,
    requirement: { voltage_v: +elements.voltage.value, current_a: +elements.current.value, circuits: +elements.circuits.value, ip_level: elements.ip.value, environment: state.environment },
    selected_model: state.selectedModel,
    cabinet_mm: { width: +$("#cabinetWidth").value, height: +$("#cabinetHeight").value, depth: +$("#cabinetDepth").value }
  };
  download(`E-CABINET_${state.selectedModel}_demo.json`, JSON.stringify(payload, null, 2), "application/json");
  toast("演示参数 JSON 已导出");
}

function exportDxf() {
  const w = +$("#cabinetWidth").value, h = +$("#cabinetHeight").value;
  const lines = [[0,0,w,0],[w,0,w,h],[w,h,0,h],[0,h,0,0],[20,20,w-20,20],[w-20,20,w-20,h-20],[w-20,h-20,20,h-20],[20,h-20,20,20]];
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  lines.forEach(([x1,y1,x2,y2]) => { dxf += `0\nLINE\n8\nDEMO_CABINET\n10\n${x1}\n20\n${y1}\n30\n0\n11\n${x2}\n21\n${y2}\n31\n0\n`; });
  dxf += "0\nENDSEC\n0\nEOF\n";
  download(`E-CABINET_${state.selectedModel}_demo.dxf`, dxf, "application/dxf");
  toast("演示 DXF 已导出：仅含柜体轮廓，不含工程计算");
}

elements.scenario.addEventListener("change", e => setScenario(e.target.value));
elements.analyze.addEventListener("click", startAnalysis);
$("#confirmButton").addEventListener("click", confirmParameters);
$("#toggleSources").addEventListener("click", () => { sourceVisible = !sourceVisible; elements.paramList.classList.toggle("show-sources", sourceVisible); $("#toggleSources").textContent = sourceVisible ? "隐藏原文定位" : "显示原文定位"; });

$$(".segmented button").forEach(btn => btn.addEventListener("click", () => {
  state.environment = btn.dataset.value;
  $$(".segmented button").forEach(item => item.classList.toggle("active", item === btn));
  if (state.analyzed) renderAnalysis();
}));

[$("#cabinetWidth"), $("#cabinetHeight"), $("#cabinetDepth"), elements.circuits, elements.ip].forEach(input => input.addEventListener("input", updateDrawing));
$$(".view-tabs button").forEach(btn => btn.addEventListener("click", () => { state.view = btn.dataset.view; $$(".view-tabs button").forEach(item => item.classList.toggle("active", item === btn)); updateDrawing(); }));
$$(".pipeline-step").forEach(step => step.addEventListener("click", () => { const target = $("#" + step.dataset.jump); if (target) target.scrollIntoView({ behavior: "smooth", block: "start" }); }));

const fileInput = $("#fileInput");
$("#dropZone").addEventListener("click", () => fileInput.click());
$("#dropZone").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0]; if (!file) return;
  elements.fileName.textContent = file.name;
  elements.fileMeta.textContent = `${file.type || "本地文件"} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  toast("文件仅用于界面演示，当前版本不会读取或上传内容");
});

$("#downloadJson").addEventListener("click", exportJson);
$("#downloadDxf").addEventListener("click", exportDxf);
$("#printPdf").addEventListener("click", () => { toast("即将打开打印窗口，可选择“另存为 PDF”"); setTimeout(() => window.print(), 500); });

const help = $("#helpDialog");
$("#helpButton").addEventListener("click", () => help.showModal());
$("#closeHelp").addEventListener("click", () => help.close());
$("#understood").addEventListener("click", () => help.close());

renderModels();
setScenario("water");
