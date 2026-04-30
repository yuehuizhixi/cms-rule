/**
 * import-export.js — 规则导入 / 导出
 *
 * 职责：
 *   - 导出规则为 JSON 文件（单条）或 ZIP 压缩包（多条/批量）
 *   - 导入 .json 和 .zip 格式的规则文件
 *   - 导入时校验格式、处理同名冲突、区分完整/暂存状态
 *   - 显示导入结果摘要弹窗
 *
 * 依赖：state.js, rules.js(y), canvas_config.js(j/P/z/ye/fe)
 * 外部库：JSZip（通过 CDN 加载）
 */

// ─── 文件工具函数 ──────────────────────────────────────────────────────────────

/**
 * 清理文件名中的非法字符，用于生成安全的下载文件名
 * @param {string} name
 */
function H(e) {
  return (e || "").replace(/[\\/:*?"<>|]/g, "_").trim()
}

/**
 * 触发浏览器下载
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 下载文件名
 */
function _(e, t) {
  const n = URL.createObjectURL(e),
    a = document.createElement("a");
  a.href = n, a.download = t, document.body.appendChild(a), a.click(),
    setTimeout(() => {
      document.body.removeChild(a), URL.revokeObjectURL(n)
    }, 100)
}

/**
 * 用 FileReader 将 File 对象读取为 UTF-8 文本
 * @param {File} file
 * @returns {Promise<string>}
 */
function O(e) {
  return new Promise((t, n) => {
    const a = new FileReader;
    a.onload = e => t(e.target.result),
      a.onerror = () => n(Error("文件读取失败")),
      a.readAsText(e, "utf-8")
  })
}

// ─── 导入校验 ──────────────────────────────────────────────────────────────────

/**
 * 校验导入的 JSON 对象结构是否合法
 * @param {Object} obj - 解析后的 JSON 对象
 * @returns {string|null} - 错误信息，null 表示通过
 */
function D(e, t) {
  if ("object" != typeof e || null === e) return "内容不是有效的对象";
  if (!e.name || "string" != typeof e.name || !e.name.trim()) return "缺少必填字段：name（规则名称）";
  if ("object" != typeof e.flow || null === e.flow) return "缺少必填字段：flow（规则流程）";
  if ("object" != typeof e.flow.nodes) return "flow.nodes 字段格式错误";
  if (!Array.isArray(e.flow.mainFlow)) return "flow.mainFlow 字段格式错误";
  for (const t of e.flow.mainFlow)
    if (!e.flow.nodes[t]) return "mainFlow 中引用了不存在的节点 ID：" + t;
  return null
}

/**
 * 将导入的 poll 对象规范化（边界修正）
 * @param {Object} poll
 */
function F(e) {
  return e && "object" == typeof e ? {
    d: Math.max(0, parseInt(e.d) || 0),
    h: Math.max(0, Math.min(23, parseInt(e.h) || 0)),
    m: Math.max(0, Math.min(59, parseInt(e.m) || 0)),
    s: Math.max(0, Math.min(59, parseInt(e.s) || 0))
  } : { d: 0, h: 0, m: 0, s: 30 }
}

/**
 * 检查 flow 中所有节点是否配置完整（用于判断导入后是否为暂存状态）
 * @param {Object} flow - 规则流程对象
 * @returns {boolean}
 */
function j(e) {
  return !!(e && e.mainFlow && e.nodes) && 0 !== e.mainFlow.length && e.mainFlow.every(t => {
    const n = e.nodes[t];
    return !!n && P(n, e.nodes)
  })
}

/**
 * 检查单个节点配置是否完整
 * 各类型节点有不同的必填字段要求
 */
function P(e, t) {
  if ("and_branch" === e.type || "or_branch" === e.type)
    return !(!e.branches || !e.branches.length) && e.branches.every(e => z(e, t));
  if ("rule" === e.type) return ye(e.config);
  if ("route" === e.type) return !!ye(e.config) && !!e.config.targetId;
  if ("timer" === e.type) {
    const t = e.config;
    return !!t.kind && !(!t.groups || !t.groups.length) && t.groups.every(e => fe(t.kind, e))
  }
  if ("modify" === e.type) return !(!e.config.param || !e.config.value);
  if ("delay" === e.type) {
    const t = parseInt(e.config.value);
    return !!(t && t > 0 && e.config.unit) && 900 >= ("秒" === e.config.unit ? t : 60 * t)
  }
  return !0
}

/**
 * 检查分支配置是否完整（含嵌套节点）
 */
function z(e, t) {
  return !!ye(e.config) && (!e.nested || e.nested.every(e => {
    const n = t[e];
    return !!n && P(n, t)
  }))
}

// ─── 导入结果展示 ──────────────────────────────────────────────────────────────

/**
 * 渲染导入结果摘要，显示成功/暂存/跳过三类规则
 * @param {{ok:string[], drafted:string[], skipped:{name,reason}[]}} result
 */
function J(e) {
  const t = document.getElementById("import-result-body");
  let n = "";
  e.ok.length && (n += `<div style="margin-bottom:12px">
 <div style="font-weight:600;color:var(--green);margin-bottom:6px">✓ 成功导入 ${e.ok.length} 条规则（已停用）</div>
 ${e.ok.map(e=>`<div style="font-size:12px;color:var(--muted);padding:2px 0 2px 14px">· ${yt(e)}</div>`).join("")}
 </div>`);
  e.drafted.length && (n += `<div style="margin-bottom:12px">
 <div style="font-weight:600;color:#b45309;margin-bottom:6px">⚠ 导入 ${e.drafted.length} 条规则（暂存中，配置不完整）</div>
 ${e.drafted.map(e=>`<div style="font-size:12px;color:var(--muted);padding:2px 0 2px 14px">· ${yt(e)}</div>`).join("")}
 </div>`);
  e.skipped.length && (n += `<div style="margin-bottom:4px">
 <div style="font-weight:600;color:var(--red);margin-bottom:6px">✕ 跳过 ${e.skipped.length} 个文件（格式或内容错误）</div>
 ${e.skipped.map(e=>`<div style="font-size:12px;color:var(--muted);padding:2px 0 2px 14px">· <b>${yt(e.name)}</b>：${yt(e.reason)}</div>`).join("")}
 </div>`);
  n || (n = '<div style="color:var(--muted);font-size:13px">未处理任何规则文件。</div>');
  t.innerHTML = n;
  document.getElementById("import-result-mask").classList.add("show")
}

// ─── 批量导出事件 ──────────────────────────────────────────────────────────────

document.getElementById("btn-batch-export").addEventListener("click", async () => {
  const e = i();
  if (!e.length) return void Et("当前分组暂无规则可导出");
  const t = new Set(Array.from(document.querySelectorAll(".ric:checked")).map(e => e.dataset.id)),
    n = t.size > 0 ? e.filter(e => t.has(e.id)) : e,
    a = o()?.name || "规则",
    d = t.size > 0 ? `已选 ${n.length} 条` : `全部 ${n.length} 条`;

  // 仅导出必要字段，不包含运行时状态
  function l(e) {
    return {
      name: e.name,
      desc: e.desc || "",
      poll: e.poll || { d: 0, h: 0, m: 0, s: 30 },
      flow: e.flow || s()
    }
  }

  // 单条规则导出为 .json
  if (1 === n.length) {
    const e = JSON.stringify(l(n[0]), null, 2);
    return _(new Blob([e], { type: "application/json" }), H(n[0].name) + ".json"), void Et("已导出 1 条规则")
  }

  // 多条规则打包为 .zip
  if ("undefined" == typeof JSZip) return void Et("JSZip 库未加载，请检查网络连接后重试");
  const r = new JSZip, c = {};
  n.forEach(e => {
    const t = H(e.name) || "rule";
    c[t] = (c[t] || 0) + 1;
    const n = c[t] > 1 ? `${t}_${c[t]}.json` : t + ".json";
    r.file(n, JSON.stringify(l(e), null, 2))
  });
  try {
    _(await r.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }),
      H(a) + "_规则导出.zip"), Et("已导出 " + d)
  } catch (e) {
    Et("导出失败：" + e.message)
  }
});

// ─── 导入事件 ─────────────────────────────────────────────────────────────────

document.getElementById("btn-batch-import").addEventListener("click", () => {
  document.getElementById("import-file-input").value = "",
    document.getElementById("import-file-input").click()
});

document.getElementById("import-file-input").addEventListener("change", async e => {
  const t = Array.from(e.target.files);
  if (!t.length) return;
  Et("正在处理文件…");
  let n = [];

  // 遍历选中文件，展开 ZIP 或直接读取 JSON
  for (const e of t)
    if (e.name.toLowerCase().endsWith(".zip")) {
      if ("undefined" == typeof JSZip) { Et("JSZip 库未加载，无法解析 ZIP 文件"); continue }
      try {
        const t = await JSZip.loadAsync(e),
          a = Object.entries(t.files).filter(([e, t]) => !t.dir && e.toLowerCase().endsWith(".json"));
        for (const [e, t] of a) {
          const a = await t.async("text");
          n.push({ filename: e.split("/").pop(), text: a })
        }
      } catch (t) {
        n.push({ filename: e.name, text: null, error: "ZIP 文件解析失败：" + t.message })
      }
    } else if (e.name.toLowerCase().endsWith(".json")) {
      const t = await O(e);
      n.push({ filename: e.name, text: t })
    } else n.push({ filename: e.name, text: null, error: "不支持的文件格式（仅支持 .json 和 .zip）" });

  const a = { ok: [], drafted: [], skipped: [] }, d = o();

  // 逐条处理解析后的文件
  for (const t of n) {
    if (t.error) { a.skipped.push({ name: t.filename, reason: t.error }); continue }
    let n;
    try { n = JSON.parse(t.text) } catch (e) {
      a.skipped.push({ name: t.filename, reason: "JSON 解析失败：内容格式错误" }); continue
    }
    const s = D(n, t.filename);
    if (s) { a.skipped.push({ name: t.filename, reason: s }); continue }
    const o = j(n.flow);
    let i = n.name.trim();
    // 同名规则自动追加 "New" 后缀
    for (; (d?.rules || []).some(e => e.name === i);) i += "New";
    const r = {
      id: l("rule"), name: i, desc: n.desc || "",
      poll: F(n.poll), flow: n.flow, enabled: !1, drafted: !o
    };
    d.rules.push(r);
    const c = i !== n.name ? `${i}（原名：${n.name}）` : i;
    o ? a.ok.push(c) : a.drafted.push(c)
  }
  y(), J(a)
});

document.getElementById("import-result-ok").addEventListener("click", () => {
  document.getElementById("import-result-mask").classList.remove("show")
});
