/**
 * rule-modal.js — 新建 / 编辑规则弹窗
 *
 * 职责：
 *   - 管理新建规则和编辑规则信息的弹窗（名称、描述、轮询间隔）
 *   - 校验表单输入（同名检查、轮询间隔范围）
 *   - 确认后将规则写入数据状态并触发列表刷新
 *
 * 依赖：state.js, rules.js(y, b)
 */

// ─── 弹窗状态 ──────────────────────────────────────────────────────────────────

/** 当前编辑的规则 ID；null 表示新建模式 */
let C = null;

/** 轮询间隔上限（30天，单位：秒） */
const $ = 2592e3;

// ─── 轮询间隔 I/O ──────────────────────────────────────────────────────────────

/**
 * 将轮询对象填充到表单输入框
 * @param {{d,h,m,s}} poll
 */
function M(e) {
  document.getElementById("rf-poll-d").value = e.d || 0,
    document.getElementById("rf-poll-h").value = e.h || 0,
    document.getElementById("rf-poll-m").value = e.m || 0,
    document.getElementById("rf-poll-s").value = e.s || 0,
    N()
}

/** 从表单输入框读取轮询对象（含范围限制） */
function S() {
  return {
    d: Math.max(0, parseInt(document.getElementById("rf-poll-d").value) || 0),
    h: Math.max(0, Math.min(23, parseInt(document.getElementById("rf-poll-h").value) || 0)),
    m: Math.max(0, Math.min(59, parseInt(document.getElementById("rf-poll-m").value) || 0)),
    s: Math.max(0, Math.min(59, parseInt(document.getElementById("rf-poll-s").value) || 0))
  }
}

/**
 * 校验并更新轮询间隔提示文字
 * - 为 0 → 提示"至少1秒"
 * - 超过30天 → 提示"超过上限"
 * - 正常 → 显示格式化后的时长
 */
function N() {
  const e = S(),
    t = u(e),
    n = document.getElementById("rph");
  return t > 0 ?
    t > $ ?
    (n.textContent = "超过30天上限", void(n.style.color = "var(--red)")) :
    (n.style.color = "var(--muted)", void(n.textContent = "当前：" + m(e))) :
    (n.textContent = "至少1秒", void(n.style.color = "var(--warn)"))
}

// ─── 弹窗操作 ──────────────────────────────────────────────────────────────────

/** 打开"新建规则"弹窗，重置所有字段 */
function R() {
  C = null,
    document.getElementById("rft").textContent = "新建规则",
    document.getElementById("rf-name").value = "",
    document.getElementById("rf-desc").value = "",
    M({ d: 0, h: 0, m: 0, s: 30 }),
    document.getElementById("rule-modal-mask").classList.add("show"),
    setTimeout(() => document.getElementById("rf-name").focus(), 50)
}

/**
 * 打开"编辑规则"弹窗，预填已有规则的信息
 * @param {string} id - 规则 ID
 */
function q(e) {
  C = e;
  const t = r(e);
  document.getElementById("rft").textContent = "编辑规则",
    document.getElementById("rf-name").value = t.name,
    document.getElementById("rf-desc").value = t.desc || "",
    M(t.poll || { d: 0, h: 0, m: 0, s: 30 }),
    document.getElementById("rule-modal-mask").classList.add("show"),
    setTimeout(() => document.getElementById("rf-name").focus(), 50)
}

/** 关闭弹窗 */
function T() {
  document.getElementById("rule-modal-mask").classList.remove("show")
}

/**
 * 确认提交弹窗
 * - 新建：创建规则对象并激活
 * - 编辑：更新现有规则字段
 * 均包含同名校验和轮询区间校验
 */
function A() {
  const e = document.getElementById("rf-name").value.trim(),
    t = document.getElementById("rf-desc").value.trim();
  if (!e) return Et("请输入规则名称"), void document.getElementById("rf-name").focus();
  let n = S();
  if (u(n) > 0 || (n = { d: 0, h: 0, m: 0, s: 30 }), u(n) > $) return void Et("轮询间隔不能超过 30 天");
  const d = o();
  // 同名检查（编辑时排除自身）
  if ((d?.rules || []).some(t => t.name === e && t.id !== C)) {
    const e = document.getElementById("rf-name");
    return e.focus(), e.select(), void Et("同一分组下已存在同名规则，请修改规则名称")
  }
  if (!C) {
    // 新建模式：创建并激活新规则
    const a = {
      id: l("rule"),
      name: e,
      desc: t,
      enabled: !1,
      drafted: !1,
      poll: n,
      flow: s()
    };
    return d.rules.push(a), T(), y(), b(a.id), void Et("已创建")
  } {
    // 编辑模式：更新字段
    const d = r(C);
    d.name = e, d.desc = t, d.poll = n,
      a === C && (
        document.getElementById("rhn").textContent = e,
        document.getElementById("rhd2").textContent = t || "暂无描述"
      ),
      Et("已更新")
  }
  T(), y()
}

// ─── 事件绑定 ──────────────────────────────────────────────────────────────────

// 轮询间隔输入框实时校验
["rf-poll-d", "rf-poll-h", "rf-poll-m", "rf-poll-s"].forEach(e => {
  document.getElementById(e).addEventListener("input", N)
});

document.getElementById("btn-new-rule").addEventListener("click", R);
document.getElementById("rf-cancel").addEventListener("click", T);
document.getElementById("rf-confirm").addEventListener("click", A);

// 点击遮罩关闭弹窗
document.getElementById("rule-modal-mask").addEventListener("click", e => {
  e.target === document.getElementById("rule-modal-mask") && T()
});

// 名称输入框键盘快捷键
document.getElementById("rf-name").addEventListener("keydown", e => {
  "Enter" === e.key && A(), "Escape" === e.key && T()
});
