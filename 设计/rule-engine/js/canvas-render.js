/**
 * canvas-render.js — 流程画布渲染
 *
 * 职责：
 *   - 将 U（工作区流程数据）渲染为可视化节点 DOM 树
 *   - 渲染连接线、加号按钮、开始/结束终止符
 *   - 渲染分支节点布局（AND/OR 多列）
 *   - 绘制路由节点的 SVG 跳转箭头
 *   - 处理画布缩放（滚轮）和平移（拖拽）
 *   - 管理节点选择弹出菜单（+ 按钮菜单）
 *
 * 依赖：canvas-config.js, drawer.js(_e/Oe/De/xe), utils.js
 */

// ─── 主渲染入口 ────────────────────────────────────────────────────────────────

/**
 * 完整重绘整个流程画布
 * 每次流程数据变化（增删节点、修改配置）后调用
 */
function we() {
  if (!a) return;
  const e = document.getElementById("canvas");
  e.innerHTML = "";
  const t = document.createElement("div");
  // 从开始节点 → 主流程节点序列 → 结束节点
  t.className = "flow",
    t.appendChild(Be("start", "开始")),
    ke(t, U.mainFlow, null),
    t.appendChild(Be("end", "结束")),
    e.appendChild(t),
    dt(); // 应用缩放/平移变换

  // 标记路由目标非法的节点（跳转指向已删除的节点）
  Object.values(U.nodes).forEach(e => {
    if ("route" === e.type && e.config.targetId && (!U.nodes[e.config.targetId] || !tt(e.id, e.config.targetId))) {
      const t = document.querySelector(`[data-node-id="${e.id}"]`);
      t && t.classList.add("ivt")
    }
  });

  ft();  // 均衡分支列高度
  mt();  // 绘制路由 SVG 箭头
  xe();  // 同步抽屉标题
  Q || (Q = !0, requestAnimationFrame(pt)); // 首次渲染居中
  k()    // 调整画布 top 偏移
}

/**
 * 当抽屉已打开时，同步更新抽屉标题文字
 * 避免节点重命名后标题显示旧名称
 */
function xe() {
  if (G)
    if ("node" === G.kind) {
      const e = U.nodes[G.nodeId];
      if (!e) return;
      document.getElementById("dh-title").textContent = W[e.type].label + " · " + e.name
    } else if ("branch_group" === G.kind) {
      const e = U.nodes[G.nodeId];
      if (!e) return;
      document.getElementById("dh-title").textContent = ("and_branch" === e.type ? "AND" : "OR") + " 分支配置";
      document.getElementById("pin").textContent = "所属节点：" + e.name;
      const t = document.getElementById("dts");
      t.innerHTML = "", e.branches.forEach(n => {
        const a = document.createElement("div");
        a.className = "tab" + (n.id === G.branchId ? " active" : "");
        a.textContent = n.name;
        a.addEventListener("click", () => { G.branchId = n.id, Oe(e.id, n.id) });
        t.appendChild(a)
      })
    }
}

// ─── 流程节点列表渲染 ─────────────────────────────────────────────────────────

/**
 * 创建开始/结束终止符节点
 * 开始节点下方追加第一个 + 按钮
 * @param {"start"|"end"} type
 * @param {string} label
 */
function Be(e, t) {
  const n = document.createElement("div");
  n.style.display = "flex", n.style.flexDirection = "column", n.style.alignItems = "center";
  const a = document.createElement("div");
  a.className = "term " + e, a.textContent = t, n.appendChild(a);
  "start" === e && n.appendChild(Ce(() => Ae(0, null, !0, !0)));
  return n
}

/**
 * 遍历节点 ID 列表，依次渲染节点 + 节点间连接线（含 + 按钮）
 * @param {HTMLElement} container - 父容器
 * @param {string[]} ids          - 节点 ID 列表
 * @param {Object|null} ctx       - 若在分支中: { parentNodeId, branchId }
 */
function ke(e, t, n) {
  for (let a = 0; a < t.length; a++) {
    const d = U.nodes[t[a]];
    d && (
      e.appendChild($e(d, n)),
      e.appendChild(Ce(() => { n ? Ae(a + 1, n, !1) : Ae(a + 1, null, !0) }))
    )
  }
  // 空列表时也要渲染一个 + 按钮（占位）
  0 === t.length && e.appendChild(Ce(() => { n ? Ae(0, n, !1) : Ae(0, null, !0) }))
}

/**
 * 创建两节点之间的连接元素（竖线 + + 按钮 + 箭头）
 * @param {Function} onClick - 点击 + 时触发的回调
 */
function Ce(e) {
  const t = document.createElement("div");
  t.className = "conn";
  const n = document.createElement("div");
  n.className = "line", t.appendChild(n);
  const a = document.createElement("div");
  // + 按钮：根据当前缩放比例反向缩放，保持视觉大小一致
  a.className = "plus", a.textContent = "+",
    a.style.transform = "scale(" + 1 / Y + ")",
    a.dataset.plus = "1",
    a.addEventListener("click", t => { t.stopPropagation(), d && e(t, a) });
  t.appendChild(a);
  const s = document.createElement("div");
  s.className = "line", t.appendChild(s);
  const l = document.createElement("div");
  l.className = "arrow-down", t.appendChild(l);
  return t
}

/**
 * 根据节点类型分派到对应的渲染函数
 * 分支类型 → Se()，其他类型 → Me()
 */
function $e(e, t) {
  return "and_branch" === e.type || "or_branch" === e.type ? Se(e, t) : Me(e, t)
}

// ─── 普通节点渲染 ─────────────────────────────────────────────────────────────

/**
 * 渲染普通节点卡片（rule / timer / delay / modify / route）
 * 含：色标条、节点类型标签、名称（双击可改名）、摘要/未配置提示、删除按钮
 * 点击卡片 → 打开抽屉配置
 */
function Me(e, t) {
  const n = document.createElement("div");
  n.className = "node t-" + e.type, n.dataset.nodeId = e.id;
  n.innerHTML = `
 <div class="tbs"></div>
 <div class="head">
 <div style="display:flex;flex-direction:column">
 <div class="typename">${W[e.type].label}</div>
 </div>
 <div class="title" data-name>${yt(e.name)}</div>
 <div class="del" title="删除">×</div>
 </div>
 <div class="body"></div>
 `;
  const a = n.querySelector(".body");
  if (he(e)) {
    // 配置完整：显示摘要文字
    const t = Re(e), d = document.createElement("div");
    d.className = "summary", d.textContent = t, a.appendChild(d), n.dataset.fullSummary = t
  } else {
    a.innerHTML = '<div class="unconfigured">请完善节点配置</div>'
  }

  // 双击名称 → 内联改名
  const s = n.querySelector("[data-name]");
  s.addEventListener("click", e => e.stopPropagation());
  s.addEventListener("mousedown", e => e.stopPropagation());
  s.addEventListener("dblclick", t => {
    t.stopPropagation(),
      d && ht(s, e.name, t => !!t && (se(e.id, t) ? (vt(s), !1) : (e.name = t, we(), !0)))
  });

  // 删除按钮
  n.querySelector(".del").addEventListener("click", n => {
    n.stopPropagation(), d && (t ? me(t.parentNodeId, t.branchId, e.id) : oe(e.id))
  });

  // 点击卡片 → 打开抽屉
  n.addEventListener("click", t => {
    t.target.closest(".del") || t.target.closest("[data-name][contenteditable=true]") || d && _e(e.id)
  });

  It(n, () => n.dataset.fullSummary || "未配置"); // 悬停 Tooltip
  return n
}

// ─── 分支节点渲染 ─────────────────────────────────────────────────────────────

/**
 * 渲染 AND/OR 分支节点容器（横向多列布局）
 * 包含：顶部标题栏（改名、添加分支、删除节点）、多列分支内容
 */
function Se(e, t) {
  const n = document.createElement("div");
  n.style.display = "flex", n.style.flexDirection = "column", n.style.alignItems = "center";
  const a = document.createElement("div");
  a.className = "bx " + ("and_branch" === e.type ? "t-and" : "t-or"), a.dataset.nodeId = e.id;
  const s = document.createElement("div");
  s.className = "bh2";
  s.innerHTML = `
 <span class="ptag">${"and_branch" === e.type ? "AND" : "OR"}</span>
 <span class="pname" data-pname>${yt(e.name)}</span>
 <div class="bhs"></div>
 <button class="bhb" data-add>+ 添加分支</button>
 <button class="bhb danger" data-delnode>删除节点</button>
 `;

  // 双击节点名称 → 内联改名
  const l = s.querySelector("[data-pname]");
  l.addEventListener("click", e => e.stopPropagation());
  l.addEventListener("mousedown", e => e.stopPropagation());
  l.addEventListener("dblclick", t => {
    t.stopPropagation(), d && ht(l, e.name, t => !!t && (se(e.id, t) ? (vt(l), !1) : (e.name = t, we(), !0)))
  });

  s.querySelector("[data-add]").addEventListener("click", t => { t.stopPropagation(), d && ce(e.id) });
  s.querySelector("[data-delnode]").addEventListener("click", n => {
    n.stopPropagation(), d && Lt(`确认删除「${e.name}」及其所有子分支？`, () => pe(e.id, t))
  });
  a.appendChild(s);

  // 渲染每条分支列
  const o = document.createElement("div");
  o.className = "bsr";
  e.branches.forEach(n => o.appendChild(Ne(e, n, t)));
  a.appendChild(o), n.appendChild(a);
  return n
}

/**
 * 渲染单条分支列
 * 包含：顶部分支头（条件摘要、改名、删除分支）、分支内的嵌套节点序列
 */
function Ne(e, t, n) {
  const a = document.createElement("div");
  a.className = "bcl";
  const s = document.createElement("div");
  s.className = "bcd", s.dataset.branchId = t.id, s.dataset.parentNodeId = e.id;
  s.innerHTML = `
 <div class="bc-stripe"></div>
 <div class="bch">
 <span class="bct">${"and_branch" === e.type ? "AND 判断分支" : "OR 判断分支"}</span>
 <span class="bcn" data-bname>${yt(t.name)}</span>
 <div class="bce">×</div>
 </div>
 <div class="bcb"></div>
 `;

  // 分支条件摘要
  const l = s.querySelector(".bcb");
  if (ve(t)) {
    const e = qe(t);
    l.innerHTML = `<div class="summary" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${yt(e)}</div>`;
    s.dataset.fullSummary = e
  } else {
    l.innerHTML = '<div class="unconfigured">请正确设置分支条件</div>'
  }

  // 双击分支名称 → 改名
  const o = s.querySelector("[data-bname]");
  o.addEventListener("click", e => e.stopPropagation());
  o.addEventListener("mousedown", e => e.stopPropagation());
  o.addEventListener("dblclick", n => {
    n.stopPropagation(), d && ht(o, t.name, n => !!n && (
      e.branches.some(e => e.id !== t.id && e.name === n) ? (vt(o), !1) : (t.name = n, we(), !0)
    ))
  });

  // 删除分支按钮
  s.querySelector(".bce").addEventListener("click", a => {
    a.stopPropagation(), d && ue(e.id, t.id, n)
  });

  // 点击分支头 → 打开分支配置抽屉
  s.addEventListener("click", n => {
    n.target.closest(".bce") || n.target.closest("[data-bname][contenteditable=true]") || d && Oe(e.id, t.id)
  });
  It(s, () => s.dataset.fullSummary || "未配置");

  // 分支内部嵌套节点序列
  const i = document.createElement("div");
  i.className = "cst", a.appendChild(i), a.appendChild(s);
  for (let n = 0; n < t.nested.length; n++) {
    a.appendChild(Ce(() => { Ae(n, { parentNodeId: e.id, branchId: t.id }, !1) }));
    const d = U.nodes[t.nested[n]];
    d && a.appendChild($e(d, { parentNodeId: e.id, branchId: t.id }))
  }
  const r = document.createElement("div");
  r.className = "csp", a.appendChild(r);
  a.appendChild(Ce(() => { Ae(t.nested.length, { parentNodeId: e.id, branchId: t.id }, !1) }));
  const c = document.createElement("div");
  c.className = "csb", a.appendChild(c);
  return a
}

// ─── 节点摘要（卡片 body 文字）─────────────────────────────────────────────────

/**
 * 为普通节点生成摘要文字（显示在节点卡片 body 区）
 */
function Re(e) {
  if ("rule" === e.type) return Le(e.config);
  if ("and_branch" === e.type || "or_branch" === e.type) return e.branches.length + " 条子分支";
  if ("timer" === e.type) return Ie(e.config);
  if ("delay" === e.type) {
    const t = "秒" === e.config.unit ? "秒" : "分钟";
    return `延时 ${e.config.value} ${t} 后继续`
  }
  if ("modify" === e.type) return `${e.config.param} = ${e.config.value}`;
  if ("route" === e.type) {
    const t = e.config, n = U.nodes[t.targetId]?.name || "?";
    return `${Le(t)} → ${n}`
  }
  return ""
}

/** 为分支对象生成条件摘要文字 */
function qe(e) {
  return Le(e.config)
}

// ─── 添加节点弹出菜单 ─────────────────────────────────────────────────────────

/** 当前加号菜单的上下文（待插入位置等信息） */
let Te = null;

/**
 * 显示节点类型选择浮层（点击 + 按钮后弹出）
 * @param {number}      index    - 插入位置
 * @param {Object|null} ctx      - 分支上下文（null 表示主流程）
 * @param {boolean}     allowAll - true 允许全部节点类型，false 只允许判断类
 * @param {boolean}     forStart - 是否是开始节点后的第一个位置
 */
function Ae(e, t, n, a) {
  if (!d) return;
  const s = (window.event && window.event.target).getBoundingClientRect();
  Te = { ctx: t, index: e, allowAll: n, forStart: !!a };
  const l = document.getElementById("pmg");
  l.innerHTML = "";
  // 主流程可选全部类型；分支 nested 只允许 rule/and_branch/or_branch
  const o = n ? ["rule", "and_branch", "or_branch", "timer", "delay", "modify", "route"] : ["rule", "and_branch", "or_branch"];
  // 定时器节点只能作为主流程第一个节点，且只允许一个
  const i = U.mainFlow.some(e => { const t = U.nodes[e]; return t && "timer" === t.type });
  const r = null === t && 0 === e; // 是否是主流程第 0 位

  o.forEach(e => {
    const t = document.createElement("div");
    t.className = "pmi";
    let n = !1;
    "timer" === e && (r && !i || (n = !0)); // 不符合条件时禁用定时器选项
    n && t.classList.add("disabled");
    t.innerHTML = `<div class="ic" style="background:${W[e].color}">${W[e].label[0]}</div><div class="nm">${W[e].label}</div><div class="ds">${W[e].desc}</div>`;
    t.addEventListener("click", () => {
      n || (He(), Te.ctx ? re(Te.ctx.parentNodeId, Te.ctx.branchId, Te.index, e) : le(Te.index, e))
    });
    l.appendChild(t)
  });

  // 定位浮层（防止超出屏幕边缘）
  const c = document.getElementById("plu");
  c.classList.add("show"), c.style.left = s.left + 22 + "px", c.style.top = s.top + 22 + "px";
  setTimeout(() => {
    const e = c.getBoundingClientRect();
    e.right > window.innerWidth - 10 && (c.style.left = window.innerWidth - e.width - 10 + "px");
    e.bottom > window.innerHeight - 10 && (c.style.top = window.innerHeight - e.height - 10 + "px")
  }, 0)
}

/** 关闭节点类型选择浮层 */
function He() {
  document.getElementById("plu").classList.remove("show")
}

// ─── 画布变换（缩放 / 平移）─────────────────────────────────────────────────────

const rt = document.getElementById("cw");

/**
 * 将当前 Y（缩放）和 V（平移）应用到画布元素的 transform
 */
function dt() {
  const e = document.getElementById("canvas");
  e.style.transform = `scale(${Y}) translate(${V.x / Y}px, ${V.y / Y}px)`
}

// 滚轮缩放
rt.addEventListener("wheel", e => {
  if (!a) return;
  e.preventDefault();
  const t = e.deltaY > 0 ? 0.9 : 1.1;
  Y = Math.min(2, Math.max(0.3, Y * t)), dt()
}, { passive: false });

// 拖拽平移（鼠标按下）
let st = !1, it = !1, lt, ot;
rt.addEventListener("mousedown", e => {
  a && (
    e.target.closest(".node") || e.target.closest(".bcd") || e.target.closest(".plus") || e.target.closest(".bh2") ||
    (st = !0, it = !1, lt = { x: e.clientX, y: e.clientY }, ot = { ...V }, rt.classList.add("grabbing"))
  )
});
window.addEventListener("mousemove", e => {
  if (!st) return;
  const t = e.clientX - lt.x, n = e.clientY - lt.y;
  Math.abs(t) + Math.abs(n) > 5 && (it = !0);
  V = { x: ot.x + t, y: ot.y + n }, dt()
});
window.addEventListener("mouseup", () => { st = !1, rt.classList.remove("grabbing") });

// 点击空白区域关闭加号菜单
window.addEventListener("mousedown", e => {
  e.target.closest(".plu") || e.target.closest(".plus") || He()
});

// ─── 画布辅助工具 ─────────────────────────────────────────────────────────────

/** 拖动路由线中间控制点时的状态 */
let ct = null;

/**
 * 获取节点 DOM 元素在画布坐标系中的位置和尺寸（已考虑缩放）
 */
function ut(e) {
  const t = e.getBoundingClientRect(),
    n = document.getElementById("canvas").getBoundingClientRect();
  return {
    left: (t.left - n.left) / Y,
    top: (t.top - n.top) / Y,
    width: t.width / Y,
    height: t.height / Y
  }
}

/**
 * 绘制所有路由节点的 SVG 跳转箭头
 * 箭头从路由节点右侧引出，绕到目标节点右侧
 * 中间的蓝色矩形控制柄可左右拖动调整弧度偏移量
 */
function mt() {
  const e = document.getElementById("canvas"),
    t = e.querySelector(".rto");
  t && t.remove();
  const n = "http://www.w3.org/2000/svg",
    a = document.createElementNS(n, "svg");
  a.setAttribute("class", "rto");
  a.style.cssText = "position:absolute;top:0;left:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:5";
  const d = document.createElementNS(n, "defs");
  d.innerHTML = '<marker id="arr-route" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3b6ef5"/></marker>';
  a.appendChild(d), e.appendChild(a);

  Object.values(U.nodes).forEach(t => {
    if ("route" !== t.type || !t.config.targetId) return;
    const d = U.nodes[t.config.targetId];
    if (!d) return;
    const s = e.querySelector(`[data-node-id="${t.id}"]`),
      l = e.querySelector(`[data-node-id="${d.id}"]`);
    if (!s || !l) return;
    const o = ut(s), i = ut(l),
      r = o.left + o.width, c = o.top + o.height / 2,
      u = i.left + i.width, m = i.top + i.height / 2,
      p = null != t.config.routeOffset ? t.config.routeOffset : 70,
      f = Math.max(r, u) + p,
      g = `M ${r} ${c} L ${f} ${c} L ${f} ${m} L ${u + 4} ${m}`;

    // 箭头路径
    const y = document.createElementNS(n, "path");
    y.setAttribute("d", g), y.setAttribute("fill", "none"), y.setAttribute("stroke", "#3b6ef5"),
      y.setAttribute("stroke-width", "2"), y.setAttribute("marker-end", "url(#arr-route)");
    a.appendChild(y);

    // 路径上的文字标签
    const h = document.createElementNS(n, "text");
    h.setAttribute("x", f + 10), h.setAttribute("y", (c + m) / 2 - 4),
      h.setAttribute("fill", "#3b6ef5"), h.setAttribute("font-size", "11");
    h.textContent = "跳转至：" + d.name;
    a.appendChild(h);

    // 可拖拽的偏移控制柄（蓝色矩形）
    const v = (c + m) / 2,
      E = document.createElementNS(n, "rect");
    E.setAttribute("x", f - 5), E.setAttribute("y", v - 12),
      E.setAttribute("width", 10), E.setAttribute("height", 24), E.setAttribute("rx", 3),
      E.setAttribute("fill", "#3b6ef5"), E.setAttribute("stroke", "#fff"), E.setAttribute("stroke-width", "2"),
      E.setAttribute("class", "rth"), E.style.pointerEvents = "auto",
      E.setAttribute("data-route-node-id", t.id);
    E.addEventListener("mousedown", e => {
      e.stopPropagation(), e.preventDefault(),
        ct = { id: t.id, startClientX: e.clientX, startOffset: p }
    });
    a.appendChild(E)
  })
}

/**
 * 均衡同一分支节点下各列的最小高度（保持视觉对齐）
 * 从最深嵌套层级开始处理，避免父子叠加导致错误
 */
function ft() {
  const e = Array.from(document.querySelectorAll(".bsr"));
  e.sort((e, t) => {
    let n = 0, a = e.parentElement;
    for (; a;) a.classList && a.classList.contains("bsr") && n++, a = a.parentElement;
    let d = 0;
    for (a = t.parentElement; a;) a.classList && a.classList.contains("bsr") && d++, a = a.parentElement;
    return d - n
  });
  e.forEach(e => {
    const t = Array.from(e.children).filter(e => e.classList && e.classList.contains("bcl"));
    if (2 > t.length) return;
    t.forEach(e => e.style.minHeight = "");
    let n = 0;
    t.forEach(e => { e.offsetHeight > n && (n = e.offsetHeight) });
    t.forEach(e => e.style.minHeight = n + "px")
  })
}

/**
 * 将画布内容居中显示
 * 仅在首次渲染时通过 requestAnimationFrame 触发一次
 */
function pt() {
  const e = document.getElementById("cw"),
    t = document.getElementById("canvas"),
    n = e.clientWidth, a = e.clientHeight,
    d = t.scrollWidth, s = t.scrollHeight;
  V.x = Math.max(20, (n - d * Y) / 2);
  V.y = Math.max(20, (a - s * Y) / 2);
  dt()
}

/**
 * 高亮节点并滚动到可见区域（保存时发现未配置节点时使用）
 * 动画类 .scf 会触发 flash 动画
 * @param {string} nodeId
 */
function gt(e) {
  const t = document.querySelector(`[data-node-id="${e}"]`);
  t && (t.classList.add("scf"), t.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }),
    setTimeout(() => t.classList.remove("scf"), 1500))
}

// ─── 路由控制柄拖拽事件 ────────────────────────────────────────────────────────

window.addEventListener("mousemove", e => {
  if (!ct) return;
  const t = (e.clientX - ct.startClientX) / Y,
    n = U.nodes[ct.id];
  n && (n.config.routeOffset = Math.max(20, ct.startOffset + t), mt())
});
window.addEventListener("mouseup", () => { ct = null });

// 点击画布遮罩（透明区）关闭抽屉
document.getElementById("dma").addEventListener("click", () => De(!0));
document.getElementById("drawer-close").addEventListener("click", () => De(!0));
