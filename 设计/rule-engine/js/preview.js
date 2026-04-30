/**
 * preview.js — 预览模拟引擎 & 规则轮询
 *
 * 职责：
 *   - 预览模式：每 2 秒模拟执行一次当前规则流程，
 *     并将 pass/fail/pending 状态渲染到节点卡片
 *   - 模拟数据：为各参数生成随机值，模拟条件判断结果
 *   - 规则轮询：规则启用后持续轮询，将执行结果写入日志
 *
 * 依赖：canvas-config.js(U/W), canvas-render.js(we), state.js, utils.js, logger.js
 */

// ─── 模拟数据生成 ─────────────────────────────────────────────────────────────

/**
 * 为指定参数名生成随机模拟值
 * 各参数的取值范围参考真实建筑系统指标
 * @param {string} paramName
 * @returns {number}
 */
function wt(e) {
  const t = {
    "室内温度":    () => 18 + 14 * Math.random(),
    "室外温度":    () => 10 + 20 * Math.random(),
    "相对湿度":    () => 40 + 45 * Math.random(),
    "CO₂浓度":    () => 400 + 600 * Math.random(),
    "光照强度":    () => 100 + 900 * Math.random(),
    "1#空调启停":  () => Math.random() > .5 ? 1 : 0,
    "2#空调启停":  () => Math.random() > .5 ? 1 : 0,
    "照明开关":    () => Math.random() > .4 ? 1 : 0,
    "新风机开关":  () => Math.random() > .6 ? 1 : 0,
    "风机盘管阀":  () => 100 * Math.random(),
    "供水温度":    () => 5 + 10 * Math.random(),
    "回水温度":    () => 8 + 12 * Math.random(),
    "水泵状态":    () => Math.random() > .3 ? 1 : 0,
    "房间设定温度": () => 22 + 4 * Math.random()
  }[e];
  return t ? t() : 100 * Math.random()
}

// ─── 条件模拟判断 ─────────────────────────────────────────────────────────────

/**
 * 模拟执行条件配置，返回 true（满足）/ false（不满足）/ null（无效配置）
 * @param {Object} config - 节点 config 对象
 */
function xt(e) {
  if ("script" === e.condMode) return Math.random() > .3; // 脚本模式：70% 概率通过
  if (!e.param || !e.op) return null;
  const t = wt(e.param), n = e.op;
  if ("范围内" === n) {
    const n = parseFloat(e.min), a = parseFloat(e.max);
    return !(isNaN(n) || isNaN(a) || n > t || t > a)
  }
  const a = parseFloat(e.threshold);
  return isNaN(a) ? null :
    ">" === n ? t > a :
    "<" === n ? a > t :
    "=" === n ? .001 > Math.abs(t - a) :
    "≠" === n ? Math.abs(t - a) >= .001 :
    "≥" === n ? t >= a :
    "≤" === n ? a >= t : null
}

/**
 * 模拟执行定时条件，返回当前时间是否在配置的时间窗口内
 * @param {Object} timerConfig - timer 节点 config
 */
function Bt(e) {
  if (!e.kind || !e.groups || !e.groups.length) return null;
  const t = new Date;
  return e.groups.some(n => kt(e.kind, n, t))
}

/**
 * 检查单个时段配置在给定时刻是否激活
 * @param {string} kind  - 触发类型
 * @param {Object} group - 时段数据
 * @param {Date}   now
 */
function kt(e, t, n) {
  // 检查时间范围 HH:MM[:SS] 是否包含当前时刻
  function a(e) {
    if (!e || !e.start || !e.end) return !1;
    const [t, a, d] = e.start.split(":").map(Number),
      [s, l, o] = e.end.split(":").map(Number),
      i = 3600 * n.getHours() + 60 * n.getMinutes() + n.getSeconds();
    return i >= 3600 * t + 60 * a + (d || 0) && 3600 * s + 60 * l + (o || 0) >= i
  }
  if ("specific" === e) return !!(t.dateRange && t.dateRange.start && t.dateRange.end) && n >= new Date(t.dateRange.start) && n <= new Date(t.dateRange.end);
  if ("daily" === e) return a(t.timeRange);
  if ("weekly" === e) { const e = n.getDay() || 7; return (t.days || []).includes(e) && a(t.timeRange) }
  if ("monthly" === e) {
    const e = n.getDate(), d = parseInt(t.dayRange?.start), s = parseInt(t.dayRange?.end);
    return e >= d && s >= e && a(t.timeRange)
  }
  if ("yearly" === e) {
    const e = n.getMonth() + 1, d = n.getDate(),
      s = parseInt(t.dateRange?.startMonth), l = parseInt(t.dateRange?.startDay),
      o = parseInt(t.dateRange?.endMonth), i = parseInt(t.dateRange?.endDay),
      r = 100 * e + d;
    return r >= 100 * s + l && 100 * o + i >= r && a(t.timeRange)
  }
  return !1
}

// ─── 流程模拟引擎 ─────────────────────────────────────────────────────────────

/**
 * 模拟执行整个流程，返回每个节点和分支的执行状态
 * 状态值：'pass' / 'fail' / 'pending'（前序节点失败，未执行）
 * @param {Object} flow - 规则 flow 对象
 * @returns {{ nodeStatuses: Object, branchStatuses: Object }}
 */
function Ct(e) {
  const t = {}, n = {};
  if (!e || !e.mainFlow || !e.nodes) return { nodeStatuses: t, branchStatuses: n };
  // 初始化所有节点为 pending
  Object.values(e.nodes).forEach(e => {
    t[e.id] = "pending";
    e.branches && e.branches.forEach(e => n[e.id] = "pending")
  });
  let a = !1; // 是否已有节点失败（后续节点标为 pending）
  for (const d of e.mainFlow) {
    const s = e.nodes[d];
    if (!s) { a = !0; break }
    if (a) { t[d] = "pending"; continue }
    const l = $t(s, e.nodes);
    !0 === l ? t[d] = "pass" : !1 === l ? (t[d] = "fail", a = !0) : t[d] = "pass";
    // 同步更新分支状态
    "and_branch" !== s.type && "or_branch" !== s.type || !s.branches || s.branches.forEach(t => {
      const a = Mt(t, e.nodes);
      n[t.id] = !1 === a ? "fail" : "pass"
    })
  }
  return { nodeStatuses: t, branchStatuses: n }
}

/**
 * 模拟单个节点的执行结果
 * @param {Object} node  - 节点对象
 * @param {Object} nodes - 所有节点的 map
 */
function $t(e, t) {
  return "rule" === e.type ? xt(e.config) :
    "timer" === e.type ? Bt(e.config) :
    "delay" === e.type || "modify" === e.type ? true : // 延时器和修改节点默认 pass
    "route" === e.type ? !1 !== xt(e.config) :
    "and_branch" !== e.type && "or_branch" !== e.type ? undefined :
    !e.branches || !e.branches.length ? undefined :
    "and_branch" === e.type ? e.branches.every(e => Mt(e, t)) : e.branches.some(e => Mt(e, t))
}

/**
 * 模拟分支的执行结果（含嵌套节点）
 */
function Mt(e, t) {
  const n = xt(e.config);
  return !1 !== n && (e.nested && e.nested.length ?
    e.nested.every(e => { const n = t[e]; return !n || !1 !== $t(n, t) }) :
    !1 !== n)
}

/**
 * 获取快照状态（不追踪流程中断，所有节点独立计算）
 * 用于预览模式初始渲染
 */
function Tt(e) {
  const t = {}, n = {};
  return e && e.nodes ? (
    Object.values(e.nodes).forEach(a => {
      const d = $t(a, e.nodes);
      t[a.id] = !1 === d ? "fail" : "pass";
      a.branches && a.branches.forEach(t => {
        n[t.id] = !1 === Mt(t, e.nodes) ? "fail" : "pass"
      })
    }),
    { nodeStatuses: t, branchStatuses: n }
  ) : { nodeStatuses: t, branchStatuses: n }
}

// ─── 预览状态 DOM 渲染 ────────────────────────────────────────────────────────

/**
 * 将执行状态渲染到画布节点 DOM（添加 rs-pass / rs-fail / rs-pending 类）
 * @param {{ nodeStatuses, branchStatuses }} statuses
 */
function St({ nodeStatuses: e, branchStatuses: t }) {
  const n = document.getElementById("canvas");
  n && (
    n.querySelectorAll("[data-node-id]").forEach(t => {
      const n = t.dataset.nodeId;
      if (!n) return;
      t.classList.remove("rs-pass", "rs-fail", "rs-pending");
      const a = e[n];
      "pass" === a ? t.classList.add("rs-pass") : "fail" === a ? t.classList.add("rs-fail") : t.classList.add("rs-pending")
    }),
    n.querySelectorAll("[data-branch-id]").forEach(e => {
      const n = e.dataset.branchId;
      if (!n) return;
      e.classList.remove("rs-pass", "rs-fail", "rs-pending");
      const a = t[n];
      "pass" === a ? e.classList.add("rs-pass") : "fail" === a ? e.classList.add("rs-fail") : e.classList.add("rs-pending")
    })
  )
}

/** 清除所有节点的预览状态样式类 */
function Nt() {
  document.querySelectorAll(".node,.bcd").forEach(e => {
    e.classList.remove("rs-pass", "rs-fail", "rs-pending")
  })
}

// ─── 预览模式控制 ─────────────────────────────────────────────────────────────

/** 预览模式定时器 ID */
let Rt = null;
/** 是否处于预览模式 */
let qt = !1;

/**
 * 启动预览模式
 * 每 2 秒重新模拟一次流程并渲染状态
 */
function At() {
  Ht(), qt = !0;
  document.getElementById("runtime-legend").classList.add("show");
  const e = document.getElementById("btn-preview-rule");

  function tick() {
    const e = r(a);
    e && St(Tt(e.flow || U))
  }
  e && (e.textContent = "退出预览", e.style.background = "#f5f3ff", e.style.color = "#5b21b6");
  tick();
  Rt = setInterval(tick, 2e3)
}

/**
 * 停止预览模式，清除状态样式，还原按钮文字
 */
function Ht() {
  Rt && (clearInterval(Rt), Rt = null);
  qt = !1;
  Nt();
  document.getElementById("runtime-legend").classList.remove("show");
  const e = document.getElementById("btn-preview-rule");
  e && (e.textContent = "预览", e.style.background = "", e.style.color = "#7c3aed")
}

// ─── 规则运行轮询 ─────────────────────────────────────────────────────────────

/** 规则轮询定时器 ID */
let _t = null;

/**
 * 为指定规则启动持续轮询
 * 每 2 秒模拟执行一次，将结果写入日志
 * @param {Object} rule - 规则对象
 */
function Ot(e) {
  Dt();
  if (!e || !e.enabled) return;
  const n = t.find(t => t.rules.some(t => t.id === e.id));
  Jt(e.id, e.name, n?.name || "未知分组", "info", `规则「${e.name}」已启用，开始实时监测`);
  _t = setInterval(() => {
    const t = r(e.id);
    t && t.enabled ? Zt(t, Ct(t.flow)) : Dt()
  }, 2e3)
}

/** 停止当前规则的轮询 */
function Dt() {
  _t && (clearInterval(_t), _t = null)
}
