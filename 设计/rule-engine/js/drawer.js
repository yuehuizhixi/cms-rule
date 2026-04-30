/**
 * drawer.js — 节点配置抽屉（右侧面板）
 *
 * 职责：
 *   - 打开/关闭配置抽屉（普通节点 / 分支节点）
 *   - 动态生成各节点类型的配置表单（rule / route / timer / modify / delay）
 *   - 渲染参数选择器弹窗（参数名搜索 + 确认）
 *   - 管理画布缩放按钮（+/- 和重置）
 *   - 路由节点的目标节点合法性检查与高亮
 *
 * 依赖：canvas-config.js, canvas-render.js(we/dt), utils.js
 */

// ─── 抽屉开关 ──────────────────────────────────────────────────────────────────

/**
 * 打开普通节点配置抽屉（rule / timer / delay / modify / route）
 * 分支类节点自动转发到 Oe()
 * @param {string} nodeId
 */
function _e(e) {
  if (!d) return;
  const t = U.nodes[e];
  t && ("and_branch" !== t.type && "or_branch" !== t.type ? (
    De(!1),
    G = { kind: "node", nodeId: e },
    document.getElementById("dh-title").textContent = W[t.type].label + " · " + t.name,
    document.getElementById("pin").style.display = "none",
    document.getElementById("dts").style.display = "none",
    Ue(t),
    document.getElementById("drawer").classList.add("show"),
    document.getElementById("dma").classList.add("show")
  ) : Oe(e, t.branches[0].id))
}

/**
 * 打开 AND/OR 分支节点的配置抽屉
 * 顶部 Tab 显示各分支，默认显示 branchId 对应的那条
 * @param {string} nodeId
 * @param {string} branchId
 */
function Oe(e, t) {
  if (!d) return;
  const n = U.nodes[e];
  if (!n) return;
  De(!1),
    G = { kind: "branch_group", nodeId: e, branchId: t },
    document.getElementById("dh-title").textContent = ("and_branch" === n.type ? "AND" : "OR") + " 分支配置";

  // 显示"所属节点"信息
  const a = document.getElementById("pin");
  a.style.display = "block", a.textContent = "所属节点：" + n.name;

  // 渲染分支 Tab 切换
  const s = document.getElementById("dts");
  s.style.display = "flex", s.innerHTML = "";
  n.branches.forEach(n => {
    const a = document.createElement("div");
    a.className = "tab" + (n.id === t ? " active" : ""),
      a.textContent = n.name,
      a.addEventListener("click", () => { G.branchId = n.id, Oe(e, n.id) }),
      s.appendChild(a)
  });

  const l = n.branches.find(e => e.id === t);
  Qe(n, l),
    document.getElementById("drawer").classList.add("show"),
    document.getElementById("dma").classList.add("show")
}

/**
 * 关闭抽屉
 * @param {boolean} showToast - 是否显示"配置已自动保存"提示
 */
function De(e) {
  document.getElementById("drawer").classList.contains("show") && (
    document.getElementById("drawer").classList.remove("show"),
    document.getElementById("dma").classList.remove("show"),
    document.getElementById("dma").classList.remove("transparent"),
    G = null, K = null,
    document.querySelectorAll(".node").forEach(e => e.classList.remove("rho", "rhn2")),
    e && Et("配置已自动保存"),
    we()
  )
}

// ─── 可用参数列表（模拟点位数据）─────────────────────────────────────────────

/**
 * 项目可用参数列表（实际项目中应从后端接口获取）
 * 每项：{ id, name, unit, desc }
 */
const Fe = [
  { id: "p01", name: "室内温度",     unit: "°C",  desc: "室内温度" },
  { id: "p02", name: "室外温度",     unit: "°C",  desc: "室外温度" },
  { id: "p03", name: "相对湿度",     unit: "%RH", desc: "室内湿度" },
  { id: "p04", name: "CO₂浓度",     unit: "ppm", desc: "CO₂浓度" },
  { id: "p05", name: "光照强度",     unit: "lux", desc: "光照强度" },
  { id: "p06", name: "1#空调启停",   unit: "",    desc: "空调1" },
  { id: "p07", name: "2#空调启停",   unit: "",    desc: "空调2" },
  { id: "p08", name: "照明开关",     unit: "",    desc: "照明" },
  { id: "p09", name: "新风机开关",   unit: "",    desc: "新风机" },
  { id: "p10", name: "风机盘管阀",   unit: "%",   desc: "阀门" },
  { id: "p11", name: "供水温度",     unit: "°C",  desc: "供水温度" },
  { id: "p12", name: "回水温度",     unit: "°C",  desc: "回水温度" },
  { id: "p13", name: "水泵状态",     unit: "",    desc: "水泵" },
  { id: "p14", name: "房间设定温度", unit: "°C",  desc: "设定温度" }
];

/** 参数选择器确认回调 */
let je = null;
/** 当前已选中的参数名 */
let Pe = null;

// ─── 参数选择器弹窗 ────────────────────────────────────────────────────────────

/**
 * 打开参数选择器弹窗
 * @param {string|null} currentParam - 当前已选中的参数名（高亮显示）
 * @param {Function}    onSelect     - 选中后回调 (paramName) => void
 */
function ze(e, t) {
  je = t, Pe = e || null,
    document.getElementById("param-search-input").value = "",
    Je(""),
    document.getElementById("ppm").classList.add("show")
}

/**
 * 根据搜索关键词过滤参数列表
 * @param {string} keyword
 */
function Je(e) {
  const t = e.toLowerCase(),
    n = Fe.filter(e => !t || e.name.toLowerCase().includes(t) || e.desc.toLowerCase().includes(t)),
    a = document.getElementById("ppl");
  a.innerHTML = "";
  n.length ? n.forEach(e => {
    const t = document.createElement("div");
    t.className = "pmr" + (e.name === Pe ? " selected" : ""),
      t.innerHTML = `<span class="prn">${yt(e.name)}</span>${e.unit ? `<span class="pru">${yt(e.unit)}</span>` : ""}<span class="prd">${yt(e.desc)}</span>`;
    t.addEventListener("click", () => {
      Pe = e.name,
        a.querySelectorAll(".pmr").forEach(e => e.classList.remove("selected")),
        t.classList.add("selected")
    });
    t.addEventListener("dblclick", () => { Pe = e.name, We() });
    a.appendChild(t)
  }) : a.innerHTML = '<div class="pme">无匹配</div>'
}

/** 确认参数选择，触发回调并关闭弹窗 */
function We() {
  Pe ? (document.getElementById("ppm").classList.remove("show"), je && je(Pe), je = null) : Et("请先选择一个参数")
}

// ─── 抽屉表单元素构建 ──────────────────────────────────────────────────────────

/**
 * 渲染"参数名"字段（点击打开参数选择器）
 * @param {HTMLElement} container - 表单容器
 * @param {Object}      config    - 节点 config 对象（双向绑定）
 * @param {Function}    onChange  - 选中后额外触发的回调
 */
function Ze(e, t, n) {
  const a = document.createElement("div");
  a.className = "field", a.innerHTML = '<label>参数名<span class="req">*</span></label>';
  const d = document.createElement("button");
  d.type = "button", d.className = "psb",
    d.innerHTML = `<span class="psv">${yt(t.param || "选择参数")}</span><span class="psa">▼</span>`,
    d.style.color = t.param ? "var(--ink)" : "#b0b7c8",
    d.addEventListener("click", () => {
      ze(t.param, e => {
        t.param = e, d.querySelector(".psv").textContent = e, d.style.color = "var(--ink)", n && n(), we()
      })
    });
  a.appendChild(d), e.appendChild(a)
}

/**
 * 渲染条件配置区（支持"自选参数"和"脚本配置"两种模式切换）
 * @param {HTMLElement} container
 * @param {Object}      config
 * @param {Function}    onChange
 */
function Xe(e, t, n) {
  t.condMode || (t.condMode = "param");
  const a = document.createElement("div");
  a.className = "ctb";
  const d = document.createElement("div");
  d.className = "ctv" + ("param" === t.condMode ? " active" : ""), d.textContent = "自选参数";
  const s = document.createElement("div");

  // 切换条件模式（自选参数 / 脚本配置）
  function l(e) {
    t.condMode = e,
      d.classList.toggle("active", "param" === e),
      s.classList.toggle("active", "script" === e),
      o.innerHTML = "",
      "param" === e ? i(o) : r(o),
      we()
  }
  s.className = "ctv" + ("script" === t.condMode ? " active" : ""), s.textContent = "脚本配置",
    d.addEventListener("click", () => l("param")),
    s.addEventListener("click", () => l("script")),
    a.appendChild(d), a.appendChild(s), e.appendChild(a);

  const o = document.createElement("div");

  // 渲染"自选参数"模式表单
  function i(e) {
    Ze(e, t, n);
    const a = document.createElement("div");
    a.className = "field",
      a.innerHTML = `<label>运算符<span class="req">*</span></label><select><option value="">请选择</option>${Z.map(e => `<option value="${e}">${e}</option>`).join("")}</select>`,
      a.querySelector("select").value = t.op || "",
      a.querySelector("select").addEventListener("change", n => {
        t.op = n.target.value, we();
        // 切换运算符时移除阈值字段，重新渲染
        const a = e.querySelectorAll(".field");
        for (let e = a.length - 1; e >= 2; e--) a[e].remove();
        Ge(e, t)
      }),
      e.appendChild(a), Ge(e, t)
  }

  // 渲染"脚本配置"模式表单（含脚本说明 + textarea）
  function r(e) {
    t.script || (t.script = "");
    const n = document.createElement("div");
    n.className = "script-rules",
      n.innerHTML = `
<div class="sr-title">📋 脚本编写规则</div>
<div class="sr-section">
 <div class="sr-label">写法 1：<code>return</code> + Python 逻辑表达式</div>
 <div class="sr-hint">规则前需加 <code>return </code>（return + 一个空格）</div>
 <pre class="sr-code">return 1 if &lt;%PriChWTempSupply01%&gt; &gt; 12 else 0</pre>
</div>
<div class="sr-section">
 <div class="sr-label">写法 2：多行 Python if 判断语句</div>
 <pre class="sr-code">if &lt;%PriChWTempSupply01%&gt; &gt; 12:\n return True\nelse:\n return False</pre>
</div>
<div class="sr-hint" style="margin-top:6px">参数引用格式：<code>&lt;%参数名%&gt;</code>　　返回 <code>1</code>/<code>True</code> 表示条件成立，<code>0</code>/<code>False</code> 表示不成立</div>`;
    e.appendChild(n);
    const a = document.createElement("div");
    a.className = "field",
      a.innerHTML = '<label>脚本内容<span class="req">*</span></label><textarea placeholder="示例：\nreturn 1 if &lt;%参数名%&gt; &gt; 12 else 0" style="height:130px;font-family:\'Courier New\',monospace;font-size:12px;line-height:1.6"></textarea>',
      a.querySelector("textarea").value = t.script,
      a.querySelector("textarea").addEventListener("input", e => { t.script = e.target.value, we() }),
      e.appendChild(a)
  }

  "param" === t.condMode ? i(o) : r(o), e.appendChild(o)
}

/**
 * 渲染阈值/范围字段（根据运算符动态切换）
 * "范围内"显示 [最小值, 最大值]；其他运算符显示单个阈值输入框
 */
function Ge(e, t) {
  const n = document.createElement("div");
  n.className = "field";
  if ("范围内" === t.op) {
    n.innerHTML = '<label>取值范围<span class="req">*</span><span class="hint" style="display:inline">闭区间</span></label><div class="row2"><input type="number" placeholder="最小值" /><input type="number" placeholder="最大值" /></div>';
    const e = n.querySelectorAll("input");
    e[0].value = t.min || "", e[1].value = t.max || "",
      e[0].addEventListener("input", n => { t.min = n.target.value, we(), Ke(e, t) }),
      e[1].addEventListener("input", n => { t.max = n.target.value, we(), Ke(e, t) }),
      Ke(e, t)
  } else {
    n.innerHTML = '<label>阈值<span class="req">*</span></label><input type="text" placeholder="阈值" />';
    const e = n.querySelector("input");
    e.value = t.threshold || "",
      e.addEventListener("input", e => { t.threshold = e.target.value, we() })
  }
  e.appendChild(n)
}

/** 校验范围最小值 < 最大值，标红不合法字段 */
function Ke(e, t) {
  const n = parseFloat(t.min), a = parseFloat(t.max),
    d = !isNaN(n) && !isNaN(a) && n >= a;
  e[0].classList.toggle("invalid", d), e[1].classList.toggle("invalid", d)
}

/**
 * 渲染节点配置抽屉内容（根据节点类型切换不同表单）
 * 支持：rule / route / timer / modify / delay
 * @param {Object} node - 节点对象
 */
function Ue(e) {
  const t = document.getElementById("dbody");
  t.innerHTML = "";

  if ("rule" === e.type) {
    // 规则判断：条件配置（参数 + 运算符 + 阈值）
    Xe(t, e.config);

  } else if ("route" === e.type) {
    // 动态路由：条件 + 目标节点下拉
    Xe(t, e.config);
    const a = document.createElement("div");
    a.className = "field", a.innerHTML = '<label>目标节点<span class="req">*</span></label>';
    const d = document.createElement("select");
    d.innerHTML = '<option value="">请选择目标节点</option>';
    et(e.id).forEach(t => {
      const n = document.createElement("option");
      n.value = t.id, n.textContent = t.name,
        t.legal || (n.disabled = !0, n.textContent += " （不可选）"),
        e.config.targetId === t.id && (n.selected = !0),
        d.appendChild(n)
    });
    d.addEventListener("focus", () => {
      // 打开下拉时使遮罩透明，并高亮可选/不可选目标节点
      K = e.id,
        document.getElementById("dma").classList.add("transparent"),
        nt(e.id)
    });
    d.addEventListener("blur", () => {
      K = null,
        document.getElementById("dma").classList.remove("transparent"),
        document.querySelectorAll(".node").forEach(e => e.classList.remove("rho", "rhn2"))
    });
    d.addEventListener("change", () => { e.config.targetId = d.value, we() });
    a.appendChild(d), t.appendChild(a);

  } else if ("timer" === e.type) {
    // 定时条件：触发类型 + 时间分组
    const s = document.createElement("div");
    s.className = "field",
      s.innerHTML = '<label>触发类型<span class="req">*</span></label><select><option value="">请选择</option><option value="specific">指定时间范围</option><option value="daily">每天</option><option value="weekly">每周几</option><option value="monthly">每月第N天</option><option value="yearly">每年第N天</option></select>',
      s.querySelector("select").value = e.config.kind || "",
      s.querySelector("select").addEventListener("change", t => {
        e.config.kind = t.target.value, e.config.groups = [ge(e.config.kind)], Ue(e), we()
      }),
      t.appendChild(s);
    e.config.kind && (
      e.config.groups && e.config.groups.length || (e.config.groups = [ge(e.config.kind)]),
      Ye(t, e.config)
    );

  } else if ("modify" === e.type) {
    // 修改点值：参数 + 目标值 + 上下限（选填）
    Ze(t, e.config);
    const l = document.createElement("div");
    l.style.cssText = "font-size:11px;color:var(--muted);margin:-6px 0 12px;line-height:1.5",
      l.textContent = "固定值或表达式", t.appendChild(l);
    const o = document.createElement("div");
    o.className = "field",
      o.innerHTML = '<label>目标值<span class="req">*</span></label><input type="text" placeholder="固定值或表达式" /><div class="hint">表达式以 = 开头，引用参数：&lt;%参数名%&gt;，支持 +-*/</div>';
    const i = o.querySelector("input");
    i.value = e.config.value || "",
      i.addEventListener("input", t => { e.config.value = t.target.value, we() }),
      t.appendChild(o);
    const r = document.createElement("div");
    r.className = "field",
      r.innerHTML = '<label>上下限 <span style="color:var(--muted);font-weight:400;font-size:11px">（选填，不填则无限制）</span></label><div class="bdr"><input type="number" placeholder="下限" /><input type="number" placeholder="上限" /></div>';
    const c = r.querySelectorAll("input");
    c[0].value = e.config.limitMin || "", c[1].value = e.config.limitMax || "",
      c[0].addEventListener("input", t => { e.config.limitMin = t.target.value, we() }),
      c[1].addEventListener("input", t => { e.config.limitMax = t.target.value, we() }),
      t.appendChild(r);

  } else if ("delay" === e.type) {
    // 延时器：延时时间 + 单位（秒/分钟），最大 900 秒
    const u = document.createElement("div");
    u.className = "field",
      u.innerHTML = '<label>延时时间<span class="req">*</span></label><div class="row2"><input type="number" min="1" placeholder="数值" style="flex:1" /><select style="width:90px"><option value="秒">秒</option><option value="分钟">分钟</option></select></div><div class="hint"></div>';
    const m = u.querySelector("input"), p = u.querySelector("select"), f = u.querySelector(".hint");

    function n() {
      const e = parseInt(m.value);
      if (!e || 0 >= e) return void(f.textContent = "");
      const t = "秒" === p.value ? e : 60 * e;
      t > 900 ? (
        m.classList.add("invalid"), f.style.color = "var(--red)",
        f.textContent = "秒" === p.value ? "最多 900 秒" : "最多 15 分钟"
      ) : (
        m.classList.remove("invalid"), f.style.color = "var(--muted)",
        f.textContent = `延时 ${t} 秒后进入下一节点`
      )
    }
    m.value = e.config.value || "", p.value = e.config.unit || "秒",
      m.addEventListener("input", t => { e.config.value = t.target.value, n(), we() }),
      p.addEventListener("change", t => { e.config.unit = t.target.value, n(), we() }),
      n(), t.appendChild(u)
  }
}

// ─── 定时器时段配置 ────────────────────────────────────────────────────────────

/**
 * 渲染定时条件的时段分组列表（支持多时段）
 * @param {HTMLElement} container
 * @param {Object}      timerConfig - timer 节点的 config 对象
 */
function Ye(e, t) {
  const n = document.createElement("div");
  n.id = "timer-groups-container";

  function render() {
    n.innerHTML = "";
    t.groups.forEach((a, d) => {
      const s = document.createElement("div");
      s.className = "tgc";
      const l = document.createElement("div");
      l.className = "tgi", l.textContent = "时段 " + (d + 1);
      // 多于一个时段才显示删除按钮
      if (t.groups.length > 1) {
        const n = document.createElement("div");
        n.className = "tgd", n.textContent = "×",
          n.addEventListener("click", () => { t.groups.splice(d, 1), render(), we() }),
          s.appendChild(n)
      }
      s.appendChild(l), Ve(s, a, t.kind), n.appendChild(s)
    });
    const a = document.createElement("button");
    a.type = "button", a.className = "agb", a.textContent = "＋ 添加时段",
      a.addEventListener("click", () => { t.groups.push(ge(t.kind)), render(), we() }),
      n.appendChild(a)
  }

  render(), e.appendChild(n)
}

/**
 * 渲染单个时段的具体配置表单（按触发类型动态渲染）
 * @param {HTMLElement} container
 * @param {Object}      group    - 时段数据对象
 * @param {string}      kind     - 触发类型
 */
function Ve(e, t, n) {
  // 通用时间范围组件（start~end）
  function a() {
    const e = document.createElement("div");
    e.className = "field",
      e.innerHTML = '<label>时间范围<span class="req">*</span></label><div class="row2"><input type="time" step="1" placeholder="开始" /><input type="time" step="1" placeholder="结束" /></div>';
    t.timeRange || (t.timeRange = { start: "", end: "" });
    const n = e.querySelectorAll("input");
    function validateTime() {
      const e = n[0].value, t = n[1].value, a = e && t && e > t;
      n[0].classList.toggle("invalid", a), n[1].classList.toggle("invalid", a)
    }
    n[0].value = t.timeRange.start || "", n[1].value = t.timeRange.end || "",
      n[0].addEventListener("input", e => { t.timeRange.start = e.target.value, validateTime(), we() }),
      n[1].addEventListener("input", e => { t.timeRange.end = e.target.value, validateTime(), we() }),
      validateTime();
    return e
  }

  if ("specific" === n) {
    // 指定时间范围：datetime-local 起止
    const s = document.createElement("div");
    s.className = "field",
      s.innerHTML = '<label>时间范围<span class="req">*</span></label><div style="display:flex;flex-direction:column;gap:8px"><input type="datetime-local" placeholder="开始" /><input type="datetime-local" placeholder="结束" /></div>';
    t.dateRange || (t.dateRange = { start: "", end: "" });
    const l = s.querySelectorAll("input");
    function validateDate() {
      const e = l[0].value, t = l[1].value, n = e && t && e > t;
      l[0].classList.toggle("invalid", n), l[1].classList.toggle("invalid", n)
    }
    l[0].value = t.dateRange.start || "", l[1].value = t.dateRange.end || "",
      l[0].addEventListener("input", e => { t.dateRange.start = e.target.value, validateDate(), we() }),
      l[1].addEventListener("input", e => { t.dateRange.end = e.target.value, validateDate(), we() }),
      validateDate(), e.appendChild(s)
  } else if ("daily" === n) {
    e.appendChild(a())
  } else if ("weekly" === n) {
    // 每周：选择星期几 + 时间范围
    const o = document.createElement("div");
    o.className = "field",
      o.innerHTML = '<label>选择星期<span class="req">*</span></label><div class="wdr"></div>';
    t.days || (t.days = []);
    const i = o.querySelector(".wdr");
    for (let r = 1; r <= 7; r++) {
      const c = document.createElement("button");
      c.type = "button", c.className = "dbt" + (t.days.includes(r) ? " active" : ""),
        c.textContent = "一二三四五六日"[r - 1],
        c.addEventListener("click", () => {
          const e = t.days.indexOf(r);
          0 > e ? t.days.push(r) : t.days.splice(e, 1),
            t.days.sort((e, t) => e - t), c.classList.toggle("active"), we()
        }),
        i.appendChild(c)
    }
    e.appendChild(o), e.appendChild(a())
  } else if ("monthly" === n) {
    // 每月：日期范围 + 时间范围
    const u = document.createElement("div");
    u.className = "field",
      u.innerHTML = '<label>日期范围<span class="req">*</span><span class="hint" style="display:inline">1~31</span></label><div class="row2"><input type="number" min="1" max="31" placeholder="起始日" /><input type="number" min="1" max="31" placeholder="结束日" /></div>';
    t.dayRange || (t.dayRange = { start: "", end: "" });
    const m = u.querySelectorAll("input");
    m[0].value = t.dayRange.start || "", m[1].value = t.dayRange.end || "",
      m[0].addEventListener("input", e => { t.dayRange.start = e.target.value, we() }),
      m[1].addEventListener("input", e => { t.dayRange.end = e.target.value, we() }),
      e.appendChild(u), e.appendChild(a())
  } else if ("yearly" === n) {
    // 每年：月份+日期起止 + 时间范围
    const p = Array.from({ length: 12 }, (e, t) => `<option value="${t + 1}">${t + 1}月</option>`).join(""),
      f = document.createElement("div");
    f.className = "field",
      f.innerHTML = `<label>日期范围<span class="req">*</span><span class="hint" style="display:inline">起始日期 → 结束日期</span></label>
 <div style="display:flex;flex-direction:column;gap:6px">
 <div style="display:flex;align-items:center;gap:6px">
 <select class="ys-sm" style="flex:1"><option value="">月</option>${p}</select>
 <input class="ys-sd" type="number" min="1" max="31" placeholder="日" style="width:60px;height:32px;border:1px solid var(--line);border-radius:5px;padding:0 6px;font-size:12px;font-family:inherit;outline:none" />
 <span style="color:var(--muted);font-size:12px;flex-shrink:0">至</span>
 <select class="ys-em" style="flex:1"><option value="">月</option>${p}</select>
 <input class="ys-ed" type="number" min="1" max="31" placeholder="日" style="width:60px;height:32px;border:1px solid var(--line);border-radius:5px;padding:0 6px;font-size:12px;font-family:inherit;outline:none" />
 </div>
 </div>`;
    t.dateRange || (t.dateRange = { startMonth: "", startDay: "", endMonth: "", endDay: "" });
    const g = f.querySelector(".ys-sm"), y = f.querySelector(".ys-sd"),
      h = f.querySelector(".ys-em"), v = f.querySelector(".ys-ed");
    g.value = t.dateRange.startMonth || "", y.value = t.dateRange.startDay || "",
      h.value = t.dateRange.endMonth || "", v.value = t.dateRange.endDay || "";
    [g, y, h, v].forEach(e => {
      e.addEventListener("focus", () => e.style.borderColor = "var(--blue)"),
        e.addEventListener("blur", () => e.style.borderColor = "var(--line)")
    });
    g.addEventListener("change", e => { t.dateRange.startMonth = e.target.value, we() });
    y.addEventListener("input", e => { t.dateRange.startDay = e.target.value, we() });
    h.addEventListener("change", e => { t.dateRange.endMonth = e.target.value, we() });
    v.addEventListener("input", e => { t.dateRange.endDay = e.target.value, we() });
    e.appendChild(f), e.appendChild(a())
  }
}

// ─── 分支配置渲染 ─────────────────────────────────────────────────────────────

/**
 * 渲染分支的配置表单（分支主条件：参数 + 运算符 + 阈值）
 * @param {Object} node   - 所属分支节点
 * @param {Object} branch - 分支对象
 */
function Qe(e, t) {
  const n = document.getElementById("dbody");
  n.innerHTML = "", Xe(n, t.config)
}

// ─── 路由目标合法性 ────────────────────────────────────────────────────────────

/**
 * 获取路由节点可选的目标节点列表（主流程中的节点，含合法性标记）
 * @param {string} routeNodeId - 路由节点自身 ID（排除自身）
 */
function et(e) {
  const t = [];
  for (const n of U.mainFlow) {
    const a = U.nodes[n];
    t.push({ id: a.id, name: a.name, legal: tt(e, a.id) })
  }
  return t
}

/**
 * 检查路由跳转目标是否合法
 * 不可指向自身、不可指向路由类型节点、必须在主流程中
 * @param {string} fromId - 路由节点 ID
 * @param {string} toId   - 目标节点 ID
 */
function tt(e, t) {
  if (e === t) return !1;
  const n = U.nodes[t];
  return !!n && "route" !== n.type && !!U.mainFlow.includes(t)
}

/**
 * 高亮主流程节点以提示路由可选目标
 * .rho = 可选（高亮绿色轮廓）
 * .rhn2 = 不可选（灰色半透明）
 */
function nt(e) {
  document.querySelectorAll(".node").forEach(t => {
    const n = t.dataset.nodeId;
    n && n !== e && (tt(e, n) ? t.classList.add("rho") : t.classList.add("rhn2"))
  })
}

// ─── 画布缩放控制 ──────────────────────────────────────────────────────────────

/**
 * 将画布缩放比例设置到指定值
 * 更新 + 按钮缩放（保持视觉大小一致）
 * @param {number} val - 目标缩放值（0.25~2）
 */
function at(e) {
  Y = Math.max(.25, Math.min(2, e)),
    document.getElementById("zvl").textContent = Math.round(100 * Y) + "%",
    dt(),
    document.querySelectorAll(".plus").forEach(e => e.style.transform = "scale(" + 1 / Y + ")")
}

/**
 * 应用当前缩放和平移到画布 DOM transform
 * （此函数在 canvas-render.js 也有引用，需保证统一）
 */
function dt() {
  document.getElementById("canvas").style.transform = `translate(${V.x}px,${V.y}px) scale(${Y})`
}

// ─── 缩放/参数选择器事件绑定 ────────────────────────────────────────────────────

document.getElementById("param-search-input").addEventListener("input", e => Je(e.target.value));
document.getElementById("param-picker-cancel").addEventListener("click", () => {
  document.getElementById("ppm").classList.remove("show"), je = null
});
document.getElementById("param-picker-ok").addEventListener("click", We);

// 缩放 + / - / 重置 按钮
document.getElementById("btn-zin").addEventListener("click", () => at(Y + .1));
document.getElementById("btn-zout").addEventListener("click", () => at(Y - .1));
document.getElementById("btn-zreset").addEventListener("click", () => {
  at(1), V = { x: 60, y: 40 }, dt()
});
// 双击缩放百分比文字 → 重置到 100%
document.getElementById("zvl").addEventListener("dblclick", () => at(1));

// 画布滚轮缩放（抽屉中的绑定，与 canvas-render 中的合并，以此版本为准）
document.getElementById("cw").addEventListener("wheel", e => {
  a && (e.preventDefault(), at(Y + (0 > e.deltaY ? .1 : -.1)))
}, { passive: !1 });
