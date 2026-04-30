/**
 * state.js — 全局状态 & 核心数据层
 *
 * 职责：
 *   - 维护所有运行时状态变量（分组列表、当前激活项、编辑状态）
 *   - 提供对状态的基础读取方法（不涉及 DOM 渲染）
 *   - 提供轮询时间的计算与格式化工具
 *
 * 被以下模块依赖：tabs.js / rules.js / canvas.js / drawer.js / preview.js / logger.js
 */

// ─── DOM 工具函数 ─────────────────────────────────────────────────────────────

/**
 * 快速创建 DOM 元素
 * @param {string} tag  - 标签名
 * @param {string} cls  - className（可选）
 * @param {string} html - innerHTML（可选）
 */
function e(e, t, n) {
  var a = document.createElement(e);
  return t && (a.className = t), void 0 !== n && (a.innerHTML = n), a
}

// ─── 初始数据（演示用） ────────────────────────────────────────────────────────

/**
 * 分组（Tab）列表，每个分组包含若干规则
 * 数据结构：{ id, name, rules: [{ id, name, desc, enabled, drafted, poll, flow }] }
 */
let t = [{
  id: "tab_default",
  name: "默认规则",
  rules: [{
    id: "rule_demo1",
    name: "空调自动开启",
    desc: "当办公室的室内温度和相对湿度过高时，可以自动开启空调",
    enabled: !0,
    poll: {
      d: 0,
      h: 0,
      m: 0,
      s: 30
    },
    flow: s()
  }, {
    id: "rule_demo2",
    name: "夜间安防模式",
    desc: "每晚22:00至次日6:00启用安防系统",
    enabled: !1,
    poll: {
      d: 0,
      h: 0,
      m: 0,
      s: 30
    },
    flow: s()
  }]
}],
  /** 当前激活的分组 ID */
  n = "tab_default",
  /** 当前激活的规则 ID（null 表示未选中任何规则） */
  a = null,
  /** 是否处于编辑模式（有未保存的修改） */
  d = !1;

// ─── 核心数据方法 ──────────────────────────────────────────────────────────────

/** 创建空的规则流程对象 */
function s() {
  return {
    nodes: {},
    mainFlow: []
  }
}

/**
 * 生成带前缀的唯一 ID
 * @param {string} prefix - 例如 "tab" / "rule" / "nd" / "br"
 */
function l(e) {
  return e + "_" + Math.random().toString(36).slice(2, 9)
}

/** 返回当前激活的分组对象 */
function o() {
  return t.find(e => e.id === n)
}

/** 返回当前激活分组下的所有规则 */
function i() {
  return o()?.rules || []
}

/**
 * 在当前分组中按 ID 查找规则
 * @param {string} id - 规则 ID
 */
function r(e) {
  return i().find(t => t.id === e)
}

/**
 * 对规则数组按名称排序（中文排序）
 * @param {Array} rules
 */
function c(e) {
  return [...e].sort((e, t) => e.name.localeCompare(t.name, "zh"))
}

/**
 * 将轮询间隔对象转换为总秒数
 * @param {{d,h,m,s}} poll
 */
function u(e) {
  return 86400 * (e.d || 0) + 3600 * (e.h || 0) + 60 * (e.m || 0) + (e.s || 0)
}

/**
 * 将轮询间隔对象格式化为可读字符串，例如 "1天2时30秒"
 * @param {{d,h,m,s}} poll
 */
function m(e) {
  const t = [];
  return e.d && t.push(e.d + "天"), e.h && t.push(e.h + "时"), e.m && t.push(e.m + "分"), !e.s && (e.d || e.h || e.m) || t.push((e.s || 0) + "秒"), t.join("")
}
