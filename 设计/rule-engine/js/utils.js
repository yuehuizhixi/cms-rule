/**
 * utils.js — 公共工具函数
 *
 * 职责：
 *   - HTML 转义（防 XSS）
 *   - 内联可编辑（节点/分支改名）
 *   - Toast 通知
 *   - 确认弹窗
 *   - Tooltip（悬停提示）
 *   - 重复名称闪烁动画
 *
 * 本文件被所有其他模块调用，须最先加载（在 state.js 之后）。
 */

// ─── HTML 安全转义 ─────────────────────────────────────────────────────────────

/**
 * 转义 HTML 特殊字符，防止 XSS
 * 在所有将用户输入插入 innerHTML 的地方使用
 * @param {string} str
 * @returns {string}
 */
function yt(e) {
  return ((e || "") + "").replace(/[&<>"']/g, e => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[e]))
}

// ─── 内联编辑（节点/分支改名）─────────────────────────────────────────────────

/**
 * 将 DOM 元素切换为 contentEditable 内联编辑状态
 * 回车确认、Esc 取消、失焦自动确认
 * 字数上限 20 字符
 *
 * @param {HTMLElement} el       - 要编辑的 DOM 元素
 * @param {string}      original - 原始名称（取消时还原）
 * @param {Function}    onCommit - 提交回调 (newName) => boolean
 *                                 返回 false 表示提交失败（保持原值）
 */
function ht(e, t, n) {
  e.contentEditable = "true", e.textContent = t, e.focus();
  const a = document.createRange();
  a.selectNodeContents(e);
  const d = window.getSelection();
  d.removeAllRanges(), d.addRange(a);
  let s = !1;
  e.addEventListener("blur", function() {
    if (s) return;
    s = !0;
    let a = e.textContent.trim();
    if (a.length > 20 && (a = a.slice(0, 20)), !a) return e.textContent = t, void(e.contentEditable = "false");
    const d = n(a);
    e.contentEditable = "false", d || (e.textContent = t)
  }, { once: !0 });
  e.addEventListener("keydown", n => {
    "Enter" === n.key && (n.preventDefault(), e.blur()),
      "Escape" === n.key && (s = !0, e.textContent = t, e.contentEditable = "false", e.blur())
  })
}

// ─── 名称重复闪烁提示 ──────────────────────────────────────────────────────────

/**
 * 对元素施加 .dup 动画类（红色边框闪烁），并弹 Toast 提示
 * @param {HTMLElement} el
 */
function vt(e) {
  e.classList.add("dup"), Et("名称重复"), setTimeout(() => e.classList.remove("dup"), 1200)
}

// ─── Toast 通知 ────────────────────────────────────────────────────────────────

/**
 * 在屏幕底部中央显示临时 Toast 提示，2.2 秒后自动消失
 * @param {string} msg
 */
function Et(e) {
  const t = document.getElementById("toast");
  t.textContent = e, t.classList.add("show"),
    clearTimeout(t._tm),
    t._tm = setTimeout(() => t.classList.remove("show"), 2200)
}

// ─── 确认弹窗 ──────────────────────────────────────────────────────────────────

/**
 * 显示确认弹窗（HTML 内容版）
 * @param {string}   html      - 弹窗正文（可含 HTML）
 * @param {Function} onConfirm - 点击"确认"的回调
 * @param {Function} onCancel  - 点击"取消"的回调（可选）
 */
function bt(e, t, n) {
  const a = document.getElementById("modal");
  a.innerHTML = `<h3>确认</h3><p style="line-height:1.8">${e}</p><div class="actions"><button class="btn" data-no>取消</button><button class="btn primary" data-yes>确认</button></div>`;
  document.getElementById("mma").classList.add("show");
  a.querySelector("[data-no]").onclick = () => {
    document.getElementById("mma").classList.remove("show"), n && n()
  };
  a.querySelector("[data-yes]").onclick = () => {
    document.getElementById("mma").classList.remove("show"), t()
  }
}

/**
 * 显示确认弹窗（纯文本内容版，自动转义）
 * @param {string}   text      - 弹窗正文（会被 HTML 转义）
 * @param {Function} onConfirm
 * @param {Function} onCancel
 */
function Lt(e, t, n) {
  bt(yt(e), t, n)
}

// ─── Tooltip 悬停提示 ──────────────────────────────────────────────────────────

/**
 * 为元素绑定悬停 Tooltip，内容由 getContent 回调动态提供
 * Tooltip 定位在元素正下方居中
 * @param {HTMLElement} el
 * @param {Function}    getContent - () => string，返回 null/'' 则不显示
 */
function It(e, t) {
  e.addEventListener("mouseenter", n => {
    const a = t();
    if (!a) return;
    const d = document.getElementById("tip");
    d.textContent = a, d.classList.add("show");
    const s = e.getBoundingClientRect();
    d.style.left = s.left + s.width / 2 - 80 + "px";
    d.style.top = s.bottom + 6 + "px"
  });
  e.addEventListener("mouseleave", () => document.getElementById("tip").classList.remove("show"))
}
