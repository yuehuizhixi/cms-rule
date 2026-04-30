/**
 * tabs.js — 分组标签管理
 *
 * 职责：
 *   - 渲染顶部分组标签栏
 *   - 处理分组的新增、切换、重命名、删除
 *
 * 依赖：state.js（读写全局状态 t, n, a, d）
 */

// ─── 标签渲染 ──────────────────────────────────────────────────────────────────

/**
 * 重新渲染整个标签栏
 * 遍历所有分组，生成 .tit 元素，绑定点击/双击/关闭事件
 */
function p() {
  const e = document.getElementById("tsc");
  e.innerHTML = "", t.forEach(s => {
    const l = document.createElement("div");
    l.className = "tit" + (s.id === n ? " active" : ""), l.dataset.tabId = s.id, l.innerHTML = `<span class="tnm">${yt(s.name)}</span><span class="tcl" title="删除分组">×</span>`;

    // 点击切换分组（脏检查：编辑中会弹确认框）
    l.addEventListener("click", e => {
      e.target.classList.contains("tcl") || e.target.classList.contains("tnm") && "true" === e.target.contentEditable || s.id !== n && (d ? Lt("切换分组将丢失修改，确认？", () => f(s.id)) : f(s.id))
    });

    // 双击进入分组名称内联编辑
    const o = l.querySelector(".tnm");
    o.addEventListener("dblclick", e => {
      e.stopPropagation(), o.contentEditable = "true", o.focus();
      const t = document.createRange();
      t.selectNodeContents(o), window.getSelection().removeAllRanges(), window.getSelection().addRange(t);
      let n = !1;
      o.addEventListener("blur", function() {
        if (n) return;
        n = !0, o.contentEditable = "false";
        const e = o.textContent.trim();
        e ? s.name = e : o.textContent = s.name, p()
      }, {
        once: !0
      }), o.addEventListener("keydown", e => {
        "Enter" === e.key && (e.preventDefault(), o.blur()), "Escape" === e.key && (n = !0, o.textContent = s.name, o.contentEditable = "false")
      })
    });

    // 关闭按钮：删除分组（至少保留一个）
    l.querySelector(".tcl").addEventListener("click", e => {
      e.stopPropagation(), 1 !== t.length ? Lt(`确认删除分组「${s.name}」？`, () => {
        t = t.filter(e => e.id !== s.id), n === s.id && (n = t[0].id, a = null, d = !1, g()), p(), y()
      }) : Et("至少保留一个分组")
    }), e.appendChild(l)
  })
}

// ─── 分组切换 ──────────────────────────────────────────────────────────────────

/**
 * 切换激活分组
 * 重置激活规则、编辑状态，刷新画布与规则列表
 * @param {string} id - 目标分组 ID
 */
function f(e) {
  n = e, a = null, d = !1, Ht(), Dt(), g(), p(), y()
}

// ─── 事件绑定 ──────────────────────────────────────────────────────────────────

// 新增分组按钮
document.getElementById("btn-add-tab").addEventListener("click", () => {
  const e = "分组" + (t.length + 1);
  t.push({
    id: l("tab"),
    name: e,
    rules: []
  }), n = t[t.length - 1].id, a = null, d = !1, g(), p(), y()
});

// 全选复选框
document.getElementById("check-all").addEventListener("change", e => {
  const t = e.target.checked;
  document.querySelectorAll(".ric").forEach(e => e.checked = t), h()
});
