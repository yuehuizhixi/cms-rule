/**
 * canvas-config.js — 画布配置、流程数据模型 & 节点操作
 *
 * 职责：
 *   - 定义节点类型元数据（标签、颜色、描述）
 *   - 维护画布运行时状态（工作流副本、缩放、位移、抽屉状态）
 *   - 提供节点 CRUD 操作（增删改查）
 *   - 提供节点/分支配置完整性校验
 *   - 提供节点摘要文字生成（用于卡片预览）
 *
 * 依赖：state.js
 * 被以下模块调用：canvas-render.js, drawer.js, preview.js, import-export.js
 */

// ─── 节点类型元数据 ────────────────────────────────────────────────────────────

/**
 * 所有支持的节点类型定义
 * color: 卡片色标（左侧条）颜色
 * label: 显示名称
 * desc:  节点功能简述
 */
const W = {
  rule: { label: "规则判断", color: "#e8631c", desc: "单条件判断" },
  and_branch: { label: "AND判断分支", color: "#ff8a3d", desc: "全部满足才通过" },
  or_branch: { label: "OR判断分支", color: "#22b573", desc: "任意满足即通过" },
  timer: { label: "定时条件", color: "#8b5cf6", desc: "指定时间触发" },
  delay: { label: "延时器", color: "#0ea5e9", desc: "延时后进入下一节点" },
  modify: { label: "修改点值", color: "#52c41a", desc: "赋值/表达式" },
  route: { label: "动态路由", color: "#1f5fb8", desc: "条件跳转" }
};

/** 规则判断/分支支持的运算符列表 */
const Z = [">", "<", "=", "≠", "≥", "≤", "范围内"];

// ─── 画布运行时状态 ────────────────────────────────────────────────────────────

/** 各节点类型已创建的计数（用于自动命名，如"规则1"、"规则2"） */
let X = {};

/** 当前工作区的流程副本（编辑时修改此对象，保存时同步到规则） */
let U = s();

/** 当前画布缩放比例 */
let Y = 1;

/** 画布内容的平移偏移量 {x, y} */
let V = { x: 60, y: 40 };

/**
 * 当前打开的抽屉上下文
 * 结构：{ kind: "node"|"branch_group", nodeId, branchId? }
 */
let G = null;

/** 路由目标选择时，被高亮的节点 ID */
let K = null;

/** 是否已触发过初始居中动画（防止重复触发） */
let Q = !1;

// ─── 节点 ID 生成 & 命名 ───────────────────────────────────────────────────────

/** 生成带前缀的节点/分支唯一 ID */
function ee(e = "n") {
  return e + "_" + Math.random().toString(36).slice(2, 9)
}

/**
 * 生成新节点的默认名称（"规则1"、"AND分支3" 等）
 * 同时递增对应类型的计数器
 */
function te(e) {
  return X[e] = (X[e] || 0) + 1, W[e].label.replace("判断", "") + X[e]
}

/**
 * 创建新节点对象（含默认空 config）
 * 分支类节点自动附带两条初始分支
 * @param {string} type - 节点类型
 */
function ne(e) {
  const t = { id: ee("nd"), type: e, name: te(e), config: {} };
  return "and_branch" !== e && "or_branch" !== e || (t.branches = [ae("分支1"), ae("分支2")]), t
}

/**
 * 创建新分支对象（用于 AND/OR 分支节点）
 * @param {string} name - 分支名称
 */
function ae(e) {
  return {
    id: ee("br"),
    name: e || "分支1",
    config: { param: "", op: "", threshold: "", min: "", max: "" },
    nested: [] // 嵌套在此分支下的节点 ID 列表
  }
}

// ─── 节点查询工具 ──────────────────────────────────────────────────────────────

/** 返回当前流程中所有节点名称列表 */
function de() {
  return Object.values(U.nodes).map(e => e.name)
}

/**
 * 检查节点名称是否与其他节点重复
 * @param {string} id   - 当前节点 ID（排除自身）
 * @param {string} name - 待检查的名称
 */
function se(e, t) {
  return Object.values(U.nodes).some(n => n.id !== e && n.name === t)
}

// ─── 节点 CRUD 操作 ────────────────────────────────────────────────────────────

/**
 * 在主流程的指定位置插入新节点
 * @param {number} index - 插入位置（splice index）
 * @param {string} type  - 节点类型
 */
function le(e, t) {
  if (!d) return;
  const n = ne(t);
  U.nodes[n.id] = n, U.mainFlow.splice(e, 0, n.id), we()
}

/**
 * 从主流程删除节点（同时清理路由引用）
 * @param {string} id - 节点 ID
 */
function oe(e) {
  d && (ie(e), U.mainFlow = U.mainFlow.filter(t => t !== e),
    Object.values(U.nodes).forEach(t => {
      "route" === t.type && t.config.targetId === e && (t.config.targetId = "")
    }), we())
}

/**
 * 递归删除节点及其所有嵌套子节点（深度清理）
 * @param {string} id - 节点 ID
 */
function ie(e) {
  const t = U.nodes[e];
  t && (t.branches && t.branches.forEach(e => e.nested.forEach(e => ie(e))), delete U.nodes[e])
}

/**
 * 在分支的 nested 列表中插入嵌套节点
 * 仅允许插入 rule / and_branch / or_branch 类型
 */
function re(e, t, n, a) {
  if (!d) return;
  if ("and_branch" !== a && "or_branch" !== a && "rule" !== a) return;
  const s = U.nodes[e].branches.find(e => e.id === t),
    l = ne(a);
  U.nodes[l.id] = l, s.nested.splice(n, 0, l.id), we()
}

/**
 * 为分支节点添加一条新分支
 * @param {string} nodeId - 分支节点 ID
 */
function ce(e) {
  if (!d) return;
  const t = U.nodes[e];
  t && t.branches && (t.branches.push(ae("分支" + (t.branches.length + 1))), we())
}

/**
 * 删除分支节点的某条分支（最少保留 2 条）
 * @param {string} nodeId   - 分支节点 ID
 * @param {string} branchId - 分支 ID
 */
function ue(e, t, n) {
  if (!d) return;
  const a = U.nodes[e];
  if (2 >= a.branches.length) return void Et("至少2条分支");
  const s = a.branches.find(e => e.id === t);
  s && s.nested.forEach(e => ie(e)),
    a.branches = a.branches.filter(e => e.id !== t),
    G && G.nodeId === e && De(!1), we()
}

/**
 * 删除分支下的嵌套节点
 * @param {string} parentNodeId - 所属分支节点 ID
 * @param {string} branchId     - 所属分支 ID
 * @param {string} nodeId       - 待删除的嵌套节点 ID
 */
function me(e, t, n) {
  if (!d) return;
  const a = U.nodes[e].branches.find(e => e.id === t);
  ie(n), a.nested = a.nested.filter(e => e !== n),
    Object.values(U.nodes).forEach(e => {
      "route" === e.type && e.config.targetId === n && (e.config.targetId = "")
    }), De(!0), we()
}

/**
 * 删除任意位置的节点（主流程或分支 nested 中）
 * @param {string} id     - 节点 ID
 * @param {Object|null} ctx - 若在分支中: { parentNodeId, branchId }，否则为 null
 */
function pe(e, t) {
  if (!d) return;
  const n = U.nodes[e];
  if (n) {
    if (n.branches && n.branches.forEach(e => e.nested.forEach(e => ie(e))), t) {
      const n = U.nodes[t.parentNodeId].branches.find(e => e.id === t.branchId);
      n.nested = n.nested.filter(t => t !== e)
    } else U.mainFlow = U.mainFlow.filter(t => t !== e);
    delete U.nodes[e],
      Object.values(U.nodes).forEach(t => {
        "route" === t.type && t.config.targetId === e && (t.config.targetId = "")
      }), De(!0), we()
  }
}

// ─── 定时条件校验 ──────────────────────────────────────────────────────────────

/**
 * 校验特定触发类型下的时间分组是否完整
 * @param {string} kind  - 触发类型: specific/daily/weekly/monthly/yearly
 * @param {Object} group - 对应的时间配置对象
 */
function fe(e, t) {
  function n(e) {
    return e && e.start && e.end && e.start <= e.end
  }
  if ("specific" === e) return n(t.dateRange);
  if ("daily" === e) return n(t.timeRange);
  if ("weekly" === e) return !(!t.days || !t.days.length) && n(t.timeRange);
  if ("monthly" === e) {
    if (!t.dayRange || !t.dayRange.start || !t.dayRange.end) return !1;
    const e = parseInt(t.dayRange.start), a = parseInt(t.dayRange.end);
    return !(isNaN(e) || isNaN(a) || 1 > e || e > 31 || 1 > a || a > 31 || e > a) && n(t.timeRange)
  }
  return "yearly" === e && !!(t.dateRange && t.dateRange.startMonth && t.dateRange.startDay && t.dateRange.endMonth && t.dateRange.endDay) && n(t.timeRange)
}

/**
 * 为不同触发类型生成空的时间分组模板
 * @param {string} kind
 */
function ge(e) {
  return "specific" === e ? { dateRange: { start: "", end: "" } } :
    "daily" === e ? { timeRange: { start: "", end: "" } } :
    "weekly" === e ? { days: [], timeRange: { start: "", end: "" } } :
    "monthly" === e ? { dayRange: { start: "", end: "" }, timeRange: { start: "", end: "" } } :
    "yearly" === e ? { dateRange: { startMonth: "", startDay: "", endMonth: "", endDay: "" }, timeRange: { start: "", end: "" } } : {}
}

// ─── 条件配置完整性校验 ────────────────────────────────────────────────────────

/**
 * 检查条件配置对象是否已完整填写
 * 兼容"自选参数"和"脚本配置"两种模式
 * @param {Object} config - 节点 config 对象
 */
function ye(e) {
  if ("script" === e.condMode) return !!(e.script || "").trim();
  if (!e.param || !e.op) return !1;
  if ("范围内" === e.op) {
    if ("" === e.min || "" === e.max || void 0 === e.min || void 0 === e.max) return !1;
    if (parseFloat(e.min) >= parseFloat(e.max)) return !1
  } else if ("" === e.threshold || void 0 === e.threshold) return !1;
  return !0
}

/**
 * 检查节点是否已完整配置（各类型有不同规则）
 * @param {Object} node - 节点对象
 */
function he(e) {
  if ("and_branch" === e.type || "or_branch" === e.type) return e.branches.every(e => Ee(e));
  if ("rule" === e.type) return ye(e.config);
  if ("route" === e.type) { const t = e.config; return !!ye(t) && !!t.targetId }
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

/** 检查分支主条件配置是否完整 */
function ve(e) {
  return ye(e.config)
}

/**
 * 检查分支是否完整配置（含所有 nested 嵌套节点）
 * @param {Object} branch - 分支对象
 */
function Ee(e) {
  return !!ve(e) && e.nested.every(e => {
    const t = U.nodes[e];
    return !!t && he(t)
  })
}

/**
 * 遍历整个流程，找到第一个未完整配置的节点 ID
 * 用于保存前校验
 * @returns {string|null} - 未配置节点的 ID，null 表示全部完整
 */
function be() {
  return function e(t) {
    for (const n of t) {
      const t = U.nodes[n];
      if (t)
        if (t.branches)
          for (const a of t.branches) {
            if (!Ee(a)) return e(a.nested) || n;
            const t = e(a.nested);
            if (t) return t
          }
        else if (!he(t)) return n
    }
    return null
  }(U.mainFlow)
}

// ─── 节点摘要文字生成 ─────────────────────────────────────────────────────────

/**
 * 将条件配置格式化为单行摘要文字
 * 例如："室内温度 > 26"、"脚本：return 1 if..."
 */
function Le(e) {
  return "script" === e.condMode ?
    "脚本：" + (e.script || "").slice(0, 20) :
    `${e.param} ${e.op} ${"范围内" === e.op ? `[${e.min},${e.max}]` : e.threshold}`
}

/**
 * 将定时条件配置格式化为摘要文字
 * 例如："每天 08:00~18:00"、"每周一三五 (+1组)"
 */
function Ie(e) {
  if (!e.kind || !e.groups || !e.groups.length) return "";
  const t = e.groups[0],
    n = e.groups.length > 1 ? ` (+${e.groups.length - 1}组)` : "";
  if ("specific" === e.kind) return "指定时间" + n;
  if ("daily" === e.kind) return `每天 ${t.timeRange?.start || ""}~${t.timeRange?.end || ""}${n}`;
  if ("weekly" === e.kind) return `每周${(t.days || []).map(e => "周" + "一二三四五六日"[e - 1]).join("")}${n}`;
  if ("monthly" === e.kind) return `每月${t.dayRange?.start || ""}~${t.dayRange?.end || ""}日${n}`;
  if ("yearly" === e.kind) {
    const e = t.dateRange || {};
    return `每年${e.startMonth || "?"}月${e.startDay || "?"}日至${e.endMonth || "?"}月${e.endDay || "?"}日${n}`
  }
  return ""
}
