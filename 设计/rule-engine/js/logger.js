/**
 * logger.js — 运行日志系统
 *
 * 职责：
 *   - 维护内存日志队列（最多 2000 条）
 *   - 提供日志写入接口（Jt）
 *   - 渲染日志列表（支持按时间、级别、规则筛选）
 *   - 处理规则轮询执行结果并生成日志条目
 *   - 日志弹窗的打开/关闭逻辑
 *
 * 依赖：state.js, preview.js(xt/Ct)
 */

// ─── 日志存储 ──────────────────────────────────────────────────────────────────

/** 内存日志队列（最新的在前） */
const Ft = [];
/** 最大保留条数 */
const jt = 2e3;
let Pt = null; // 预留：历史分页游标

// ─── 日志渲染 ──────────────────────────────────────────────────────────────────

/**
 * 根据当前筛选条件过滤并渲染日志列表
 * 筛选条件：日志级别 / 规则 / 时间范围（起止）
 */
function zt() {
  const e = document.getElementById("lm-filter-level")?.value || "",
    t = document.getElementById("lm-filter-rule")?.value || "",
    n = document.getElementById("lm-filter-ts-start")?.value || "",
    a = document.getElementById("lm-filter-ts-end")?.value || "",
    d = n ? new Date(n) : null,
    s = a ? new Date(a) : null;
  let l = Ft;
  e && (l = l.filter(t => t.level === e));
  t && (l = l.filter(e => e.ruleId === t));
  d && (l = l.filter(e => e.ts >= d));
  s && (l = l.filter(e => e.ts <= s));

  const o = document.getElementById("lm-body"),
    i = document.getElementById("lm-footer");
  o && (
    i.textContent = `共 ${l.length} 条日志`,
    l.length ? o.innerHTML = l.map(e => `
 <div class="log-row">
 <span class="log-time">${Wt(e.ts)}</span>
 <span class="log-level ${e.level}">${{ info: "信息", success: "成功", error: "错误" }[e.level] || e.level}</span>
 <span class="log-rule">${yt(e.ruleName)}<br><span class="log-group">${yt(e.groupName)}</span></span>
 <span class="log-msg">${yt(e.msg)}</span>
 </div>
 `).join("") :
      o.innerHTML = '<div class="log-empty"><div class="le-icon">📭</div><p>暂无日志记录</p></div>'
  )
}

// ─── 日志写入 ──────────────────────────────────────────────────────────────────

/**
 * 向日志队列中插入一条记录（插入到头部，最新日志在最上方）
 * 超过上限时自动截断
 *
 * @param {string} ruleId    - 规则 ID
 * @param {string} ruleName  - 规则名称
 * @param {string} groupName - 所属分组名称
 * @param {'info'|'success'|'error'} level - 日志级别
 * @param {string} msg       - 日志内容
 */
function Jt(e, t, n, a, d) {
  const s = {
    id: Math.random().toString(36).slice(2),
    ts: new Date,
    ruleId: e, ruleName: t, groupName: n,
    level: a, msg: d
  };
  Ft.unshift(s);
  Ft.length > jt && (Ft.length = jt);
  // 若日志弹窗当前处于打开状态，实时追加
  document.getElementById("log-modal-mask").classList.contains("show") && zt()
}

// ─── 时间格式化 ────────────────────────────────────────────────────────────────

/**
 * 将 Date 对象格式化为 "YYYY-MM-DD HH:MM:SS"
 * @param {Date} date
 */
function Wt(e) {
  const t = e => (e + "").padStart(2, "0");
  return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`
}

// ─── 轮询结果日志 ──────────────────────────────────────────────────────────────

/**
 * 将一次轮询执行结果转换为日志条目
 * 统计各节点通过/失败/未执行数量，并随机模拟偶发系统错误
 *
 * @param {Object} rule     - 规则对象
 * @param {{ nodeStatuses }} statuses - 节点状态
 */
function Zt(e, n) {
  const a = t.find(t => t.rules.some(t => t.id === e.id)),
    d = a?.name || "未知分组",
    { nodeStatuses: s } = n,
    l = { rule: "规则判断", and_branch: "AND分支", or_branch: "OR分支", timer: "定时条件", delay: "延时器", modify: "修改点值", route: "动态路由" };
  let o = 0, i = 0, r = 0;

  (e.flow?.mainFlow || []).forEach(t => {
    const n = e.flow.nodes[t];
    if (!n) return;
    const a = s[t], c = l[n.type] || n.type;
    "pass" === a ? o++ : "fail" === a ? (i++, Jt(e.id, e.name, d, "error", `[${c}] 「${n.name}」— 条件不满足，中断`)) : r++
  });

  const c = i > 0 ? "error" : "success";
  Jt(e.id, e.name, d, c, `轮询完成：${o} 通过 / ${i} 不满足 / ${r} 未执行`);

  // 随机模拟偶发系统异常（3% 概率）
  if (Math.random() > .97) {
    const t = [
      ["ERR_TIMEOUT", "节点执行超时，已跳过本次轮询"],
      ["ERR_PARAM_NULL", "参数取值为空，无法完成条件判断"],
      ["ERR_CONN_LOST", "数据源连接中断，本次轮询终止"]
    ], [n, a] = t[Math.floor(Math.random() * t.length)];
    Jt(e.id, e.name, d, "error", `${n}：${a}`)
  }
}

// ─── 日志弹窗 ──────────────────────────────────────────────────────────────────

/**
 * 更新"规则"筛选下拉框（从日志中提取所有出现过的规则）
 * @param {string|null} defaultRuleId - 默认选中的规则 ID
 */
function Xt(e) {
  const t = document.getElementById("lm-filter-rule");
  if (!t) return;
  t.innerHTML = '<option value="">全部规则</option>';
  const n = new Set;
  Ft.forEach(e => {
    if (!n.has(e.ruleId)) {
      n.add(e.ruleId);
      const a = document.createElement("option");
      a.value = e.ruleId, a.textContent = `${e.ruleName}（${e.groupName}）`,
        t.appendChild(a)
    }
  });
  e && (t.value = e)
}

/**
 * 打开日志弹窗
 * 默认筛选今天的日志，并可预设规则过滤
 * @param {string|null} ruleId - 预选的规则 ID（null = 全部规则）
 */
function Ut(e) {
  document.getElementById("lm-title").textContent = "全部日志";
  document.getElementById("lm-filter-level").value = "";
  const t = new Date, n = e => (e + "").padStart(2, "0"),
    a = `${t.getFullYear()}-${n(t.getMonth() + 1)}-${n(t.getDate())}`;
  document.getElementById("lm-filter-ts-start").value = a + "T00:00";
  document.getElementById("lm-filter-ts-end").value = a + "T23:59";
  Xt(e), zt();
  document.getElementById("log-modal-mask").classList.add("show")
}

// ─── 日志事件绑定 ──────────────────────────────────────────────────────────────

document.getElementById("lm-close").addEventListener("click", () => {
  document.getElementById("log-modal-mask").classList.remove("show")
});
document.getElementById("log-modal-mask").addEventListener("click", e => {
  e.target === document.getElementById("log-modal-mask") && document.getElementById("log-modal-mask").classList.remove("show")
});
document.getElementById("lm-filter-level").addEventListener("change", zt);
document.getElementById("lm-filter-rule").addEventListener("change", zt);
document.getElementById("lm-filter-ts-start").addEventListener("change", zt);
document.getElementById("lm-filter-ts-end").addEventListener("change", zt);
document.getElementById("btn-view-all-logs").addEventListener("click", () => Ut(null));

// 规则列表中复选框变化时，同步全选状态
document.getElementById("rls").addEventListener("change", e => {
  e.target.classList.contains("ric") && h()
});

// ─── 应用初始化 ────────────────────────────────────────────────────────────────

/**
 * 页面加载完成后的初始化序列：
 * 1. 渲染标签栏
 * 2. 渲染规则列表
 * 3. 自动打开第一条规则（按名称排序）
 */
p(), y();
const Yt = i();
Yt.length > 0 && b(c(Yt)[0].id);
