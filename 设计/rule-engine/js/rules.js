/**
 * rules.js — 规则列表 & 规则编辑器状态管理
 *
 * 职责：
 *   - 渲染左侧规则列表（含筛选、排序、启停开关）
 *   - 管理规则选中状态与编辑模式（锁定/编辑态）
 *   - 响应工具栏按钮（保存、暂存、删除、批量操作）
 *   - 规则头部信息栏的展示与隐藏
 *
 * 依赖：state.js, canvas.js(we, g), preview.js(Ht), logger.js(Ot, Dt, Jt, Ut)
 */

// ─── 规则列表渲染 ──────────────────────────────────────────────────────────────

/**
 * 重新渲染规则列表
 * 读取筛选条件（名称、描述、状态），按筛选结果展示规则卡片
 */
function y() {
  const e = document.getElementById("filter-name").value.trim().toLowerCase(),
    t = document.getElementById("filter-desc").value.trim().toLowerCase(),
    n = document.getElementById("filter-status").value,
    d = c(i()).filter(a => {
      const d = !e || a.name.toLowerCase().includes(e),
        s = !t || (a.desc || "").toLowerCase().includes(t),
        l = !n || ("on" === n ? a.enabled : "draft" === n ? a.drafted : !a.enabled && !a.drafted);
      return d && s && l
    });
  document.getElementById("rule-count").textContent = `共 ${i().length} 个`;
  const s = document.getElementById("check-all");
  s.checked = !1, s.indeterminate = !1;
  const l = document.getElementById("rls");
  if (l.innerHTML = "", 0 === d.length) {
    const a = e || t || n;
    return void(l.innerHTML = `<div class="eps"><div class="esi">📭</div><p>${a?"无匹配规则":"暂无规则"}</p></div>`)
  }

  // 遍历过滤后的规则，生成规则卡片
  d.forEach(e => {
    const t = document.createElement("div");
    t.className = "rit" + (e.id === a ? " active" : ""), t.dataset.ruleId = e.id;
    const n = m(e.poll || {
        s: 30
      }),
      d = e.drafted ? "draft" : e.enabled ? "on" : "off",
      s = e.drafted ? "暂存中" : e.enabled ? "启用中" : "已停用";
    t.innerHTML = `
 <div class="rio">
 <input type="checkbox" class="ric" data-id="${e.id}" onclick="event.stopPropagation()">
 <div class="rin">${yt(e.name)}</div>
 <div class="rie" title="${e.enabled?"启用中不可编辑":"编辑信息"}" data-edit="${e.id}" style="${e.enabled?"color:#ccc;cursor:not-allowed":""}">✎</div>
 </div>
 <div class="rid">${yt(e.desc||"")}</div>
 <div class="rif">
 <span class="rst ${d}">${s}</span>
 <span style="font-size:10px;color:var(--muted);margin-left:4px">⏱ ${n}</span>
 <span class="ri-log-btn" data-log="${e.id}" title="查看日志">📋</span>
 <label class="rit2" ${e.drafted?'title="请完成规则配置后再开启规则"':""}>
 <input type="checkbox" ${e.enabled?"checked":""} ${e.drafted?'data-toggle-draft="1"':'data-toggle="'+e.id+'"'}>
 <span class="slider" style="${e.drafted?"opacity:.45":""}"></span>
 </label>
 </div>
 `;

    // 点击卡片主体 → 切换激活规则
    t.addEventListener("click", t => {
      t.target.closest(".ric") || t.target.closest(".rie") || t.target.closest(".rit2") || t.target.closest(".ri-log-btn") || E(e.id)
    });

    // 查看日志按钮
    t.querySelector("[data-log]").addEventListener("click", t => {
      t.stopPropagation(), Ut(e.id)
    });

    // 编辑信息按钮（铅笔图标）
    t.querySelector("[data-edit]").addEventListener("click", t => {
      t.stopPropagation(), e.enabled ? Et("规则启用中，不可编辑，请先停用后再操作") : q(e.id)
    });

    // 启停开关（非暂存规则）
    t.querySelector("[data-toggle]") && t.querySelector("[data-toggle]").addEventListener("change", t => {
      t.stopPropagation();
      const n = t.target.checked;
      t.target.checked = !n; // 先还原，等用户确认后再改
      const d = m(e.poll || {
          s: 30
        }),
        s = n ? "启用后，该规则将按设定的轮询间隔自动运行，可能对项目数据产生实际影响。" : "停用后，该规则将立即停止执行，请确认当前无依赖此规则的关键业务正在运行。";
      bt(`<strong>确认${n?"启用":"停用"}规则？</strong><br><br><span style="color:var(--muted)">规则名称：</span>${yt(e.name)}<br><span style="color:var(--muted)">规则描述：</span>${yt(e.desc||"暂无描述")}<br><span style="color:var(--muted)">轮询间隔：</span>${d}<br><br>⚠️ ${s}<br>请确认操作符合预期后再继续。`, () => {
        e.enabled = n, e.id === a && v(e);
        const t = o();
        n ? (Jt(e.id, e.name, t?.name || "未知分组", "info", `规则「${e.name}」已启用，开始实时监测`), Ot(e)) : (Dt(), Jt(e.id, e.name, t?.name || "未知分组", "info", `规则「${e.name}」已停用，实时监测终止`)), y()
      }, () => {})
    });

    // 暂存规则的开关点击提示
    t.querySelector("[data-toggle-draft]") && t.querySelector("[data-toggle-draft]").addEventListener("change", e => {
      e.stopPropagation(), e.target.checked = !1, Et("请完成规则配置后再开启规则")
    }), l.appendChild(t)
  }), h()
}

// ─── 复选框全选状态同步 ────────────────────────────────────────────────────────

/**
 * 根据各行复选框状态，更新全选框的 checked / indeterminate 状态
 */
function h() {
  const e = Array.from(document.querySelectorAll(".ric")),
    t = document.getElementById("check-all");
  if (!e.length) return t.checked = !1, void(t.indeterminate = !1);
  const n = e.filter(e => e.checked).length;
  t.indeterminate = n > 0 && n < e.length, t.checked = n === e.length
}

// ─── 规则编辑器工具栏状态 ─────────────────────────────────────────────────────

/**
 * 根据当前规则的启用状态，切换工具栏按钮的 disabled 样式
 * @param {Object} rule - 规则对象
 */
function v(e) {
  const t = document.getElementById("btn-draw-rule-lock"),
    n = document.getElementById("btn-del-rule");
  document.getElementById("btn-save-rule"),
    e && (e.enabled ? (t.classList.add("disabled"), n.classList.add("disabled"), d && B()) : (t.classList.remove("disabled"), n.classList.remove("disabled")))
}

// ─── 规则切换（含脏检查）────────────────────────────────────────────────────────

/**
 * 尝试切换到指定规则
 * 若当前有未保存修改，弹确认框后再切换
 * @param {string} id - 目标规则 ID
 */
function E(e) {
  d && a && a !== e ? Lt("切换规则将丢失修改，确认？", () => {
    B(), b(e)
  }) : b(e)
}

/**
 * 正式激活一条规则：加载流程、更新头部信息、渲染画布
 * @param {string} id - 规则 ID
 */
function b(e) {
  a = e, d = !1;
  const t = r(e);
  L(t), y(), I(t), we(), w(), Ht()
}

/**
 * 将规则的 flow 数据深拷贝到工作区状态 U，重置节点计数和缩放
 * @param {Object} rule - 规则对象
 */
function L(e) {
  U = JSON.parse(JSON.stringify(e.flow)),
    X = {},
    Object.values(U.nodes).forEach(e => {
      X[e.type] = (X[e.type] || 0) + 1
    }),
    Q = !1,
    Y = 1,
    V = { x: 60, y: 40 }
}

/**
 * 更新规则头部信息栏（名称、描述、按钮可见性）
 * @param {Object} rule - 规则对象
 */
function I(e) {
  document.getElementById("rhd").style.display = "flex",
    document.getElementById("rhn").textContent = e.name,
    document.getElementById("rhd2").textContent = e.desc || "暂无描述",
    document.getElementById("btn-del-rule").style.display = "inline-flex",
    document.getElementById("btn-save-rule").style.display = "none",
    document.getElementById("btn-draft-rule").style.display = "none",
    document.getElementById("zgp").style.display = "none",
    document.getElementById("nrp").style.display = "none",
    document.getElementById("cbg").style.display = "block",
    v(e)
}

/**
 * 根据编辑状态切换工具栏与画布的显示模式（锁定 / 编辑中）
 */
function w() {
  const e = document.getElementById("cw"),
    t = document.getElementById("lko"),
    n = document.getElementById("btn-save-rule"),
    s = document.getElementById("btn-draft-rule"),
    l = document.getElementById("zgp");
  if (!a) return void(t.style.display = "none");
  const o = r(a);
  d ? (
    // 编辑模式
    t.style.display = "none",
    e.classList.remove("locked"),
    e.classList.add("editing"),
    n.style.display = "inline-flex",
    s.style.display = "inline-flex",
    document.getElementById("btn-preview-rule").style.display = "inline-flex",
    l.style.display = "flex"
  ) : (
    // 锁定模式
    t.style.display = "flex",
    e.classList.add("locked"),
    e.classList.remove("editing"),
    n.style.display = "none",
    s.style.display = "none",
    document.getElementById("btn-preview-rule").style.display = "none",
    l.style.display = "none"
  ), o && v(o)
}

/** 进入编辑模式 */
function x() {
  const e = r(a);
  e && (e.enabled ? Et("规则启用中，停用后可编辑") : (Ht(), d = !0, w(), Et("已进入编辑模式")))
}

/** 退出编辑模式（丢弃未保存修改） */
function B() {
  d = !1, De(!1), w()
}

/**
 * 根据规则头部是否显示，调整画布容器的 top 偏移
 * 防止头部与画布重叠
 */
function k() {
  const e = document.getElementById("rhd"),
    t = document.getElementById("cw");
  "none" !== e.style.display ? t.style.top = e.offsetHeight + "px" : t.style.top = "0"
}

// ─── 工具栏按钮事件绑定 ────────────────────────────────────────────────────────

// 删除当前规则
document.getElementById("btn-del-rule").addEventListener("click", () => {
  if (!a) return;
  const e = r(a);
  e && (e.enabled ? Et("规则启用中，停用后可删除") : Lt(`确认删除规则「${e.name}」？此操作不可撤销。`, () => {
    const e = o();
    e.rules = e.rules.filter(e => e.id !== a), a = null, d = !1, g(), y(), Et("已删除")
  }))
});

// 批量删除选中规则
document.getElementById("btn-batch-del").addEventListener("click", () => {
  const e = Array.from(document.querySelectorAll(".ric:checked")).map(e => e.dataset.id);
  if (!e.length) return void Et("请先勾选");
  const t = e.map(e => r(e)).filter(e => e && e.enabled).map(e => e.name);
  t.length ? Et("启用中不可删除：" + t.join(",")) : Lt(`确认批量删除 ${e.length} 条规则？此操作不可撤销。`, () => {
    const t = o();
    t.rules = t.rules.filter(t => !e.includes(t.id)), e.includes(a) && (a = null, d = !1, g()), y(), Et(`已删除${e.length}条`)
  })
});

// 锁定/解锁编辑按钮
document.getElementById("btn-draw-rule-lock").addEventListener("click", () => {
  const e = a ? r(a) : null;
  e && e.enabled ? Et("规则启用中，停用后可编辑") : x()
});

// 保存规则（校验节点完整性和路由合法性）
document.getElementById("btn-save-rule").addEventListener("click", () => {
  if (!a) return;
  Ht(), document.getElementById("cw").classList.add("editing");
  const e = be(); // 查找第一个未配置的节点
  if (e) return gt(e), void Et("有节点未配置");
  let t = null;
  if (Object.values(U.nodes).forEach(e => {
      "route" === e.type && e.config.targetId && !tt(e.id, e.config.targetId) && (t = e.id)
    }), t) return gt(t), void Et("路由目标不合法");
  const n = r(a);
  n.flow = JSON.parse(JSON.stringify(U)), n.drafted = !1, d = !1, De(!1), w(), y(), Et("已保存✓")
});

// 暂存规则（标记为 drafted，不校验完整性）
document.getElementById("btn-draft-rule").addEventListener("click", () => {
  if (!a) return;
  Ht(), document.getElementById("cw").classList.add("editing");
  const e = r(a);
  e.flow = JSON.parse(JSON.stringify(U)), e.drafted = !0, e.enabled = !1, d = !1, De(!1), w(), y(), Et("规则已暂存，完成配置后可正式保存并启用")
});

// 预览/退出预览
document.getElementById("btn-preview-rule").addEventListener("click", () => {
  qt ? (Ht(), document.getElementById("cw").classList.add("editing")) : (document.getElementById("cw").classList.remove("editing"), At())
});

// 筛选器实时联动
document.getElementById("filter-name").addEventListener("input", y);
document.getElementById("filter-desc").addEventListener("input", y);
document.getElementById("filter-status").addEventListener("change", y);
