import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import * as api from './api';
import './styles.css';
import { RuleCanvas, ConfigDrawer, ParamPicker } from './components/canvas';

// ============ Types ============
interface PollInterval { d: number; h: number; m: number; s: number }
interface Flow { nodes: Record<string, any>; mainFlow: string[] }
interface Rule { id: string; name: string; description: string; enabled: boolean; drafted: boolean; poll: PollInterval; flow: Flow }
interface Group { id: string; name: string; rules: Rule[] }

interface LogEntry { id: string; ts: Date; ruleId: string; ruleName: string; groupName: string; level: string; msg: string }

// ============ Utilities ============
function uid(prefix: string): string { return prefix + "_" + Math.random().toString(36).slice(2, 9); }
function escHtml(s: string): string { return ((s || "") + "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)); }
function pollToSeconds(p: PollInterval): number { return 86400 * (p.d || 0) + 3600 * (p.h || 0) + 60 * (p.m || 0) + (p.s || 0); }
function pollToDisplay(p: PollInterval): string {
  const parts: string[] = [];
  if (p.d) parts.push(p.d + "天");
  if (p.h) parts.push(p.h + "时");
  if (p.m) parts.push(p.m + "分");
  if (!p.s && (p.d || p.h || p.m)) parts.push("0秒");
  else if (p.s !== undefined) parts.push(p.s + "秒");
  return parts.join("") || "30秒";
}
function pollToStr(p: PollInterval): string {
  const parts: string[] = [];
  if (p.d) parts.push(p.d + "天");
  if (p.h) parts.push(p.h + "时");
  if (p.m) parts.push(p.m + "分");
  if (!p.s && (p.d || p.h || p.m)) {} else parts.push((p.s || 0) + "秒");
  return parts.join("");
}
function createEmptyFlow(): Flow { return { nodes: {}, mainFlow: [] }; }
function sortRules(rules: Rule[]): Rule[] { return [...rules].sort((a, b) => a.name.localeCompare(b.name, "zh")); }
function fmtTime(d: Date): string {
  const p = (n: number) => (n + "").padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ============ Node Type Config ============
const NODE_TYPES: Record<string, { label: string; color: string; desc: string }> = {
  rule: { label: "规则判断", color: "#e8631c", desc: "单条件判断" },
  and_branch: { label: "AND判断分支", color: "#ff8a3d", desc: "全部满足才通过" },
  or_branch: { label: "OR判断分支", color: "#22b573", desc: "任意满足即通过" },
  timer: { label: "定时条件", color: "#8b5cf6", desc: "指定时间触发" },
  delay: { label: "延时器", color: "#0ea5e9", desc: "延时后进入下一节点" },
  modify: { label: "修改点值", color: "#52c41a", desc: "赋值/表达式" },
  route: { label: "动态路由", color: "#1f5fb8", desc: "条件跳转" },
};
const OPERATORS = [">", "<", "=", "≠", "≥", "≤", "范围内"];

const POINTS = [
  { name: "室内温度", unit: "°C" }, { name: "室外温度", unit: "°C" },
  { name: "相对湿度", unit: "%RH" }, { name: "CO₂浓度", unit: "ppm" },
  { name: "光照强度", unit: "lux" }, { name: "1#空调启停", unit: "" },
  { name: "2#空调启停", unit: "" }, { name: "照明开关", unit: "" },
  { name: "新风机开关", unit: "" }, { name: "风机盘管阀", unit: "%" },
  { name: "供水温度", unit: "°C" }, { name: "回水温度", unit: "°C" },
  { name: "水泵状态", unit: "" }, { name: "房间设定温度", unit: "°C" },
];

// ============ App ============
export default function App() {
  // --- State ---
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentTabId, setCurrentTabId] = useState<string>("");
  const [currentRuleId, setCurrentRuleId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  // Canvas state (mirrored from prototype)
  const [canvasFlow, setCanvasFlow] = useState<Flow>(createEmptyFlow());
  const [nodeCounters, setNodeCounters] = useState<Record<string, number>>({});
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 60, y: 40 });
  // UI state
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [tabEditing, setTabEditing] = useState<string | null>(null);
  // Filters
  const [filterName, setFilterName] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  // Modals
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logRuleId, setLogRuleId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ ok: string[]; drafted: string[]; skipped: { name: string; reason: string }[] } | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalContent, setConfirmModalContent] = useState<{
    title: string;
    body: React.ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  } | null>(null);
  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCtx, setDrawerCtx] = useState<{ kind: "node" | "branch_group"; nodeId: string; branchId?: string } | null>(null);
  const [paramPickerOpen, setParamPickerOpen] = useState(false);
  // Preview
  const [previewMode, setPreviewMode] = useState(false);
  const [previewInterval, setPreviewInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, string>>({});
  const [branchStatuses, setBranchStatuses] = useState<Record<string, string>>({});
  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilterLevel, setLogFilterLevel] = useState("");
  const [logFilterRule, setLogFilterRule] = useState("");
  const [logFilterTsStart, setLogFilterTsStart] = useState("");
  const [logFilterTsEnd, setLogFilterTsEnd] = useState("");
  // Canvas scroll
  const [scrollToNodeId, setScrollToNodeId] = useState<string | null>(null);
  // Node type menu
  const [nodeMenuVisible, setNodeMenuVisible] = useState(false);
  const [nodeMenuPos, setNodeMenuPos] = useState({ x: 0, y: 0 });
  const [nodeMenuCtx, setNodeMenuCtx] = useState<null | { index: number; ctx: null | { parentNodeId: string; branchId: string } }>(null);
  const nodeMenuRef = useRef<HTMLDivElement>(null);
  const NODE_TYPE_KEYS = React.useMemo(() => Object.keys(NODE_TYPES), []);
  const hasTimerNode = useMemo(() => Object.values(canvasFlow.nodes).some(n => n.type === 'timer'), [canvasFlow.nodes]);
  const selectNodeType = useCallback((type: string) => {
    setNodeMenuVisible(false);
    if (!nodeMenuCtx) return;
    const { index, ctx } = nodeMenuCtx;
    const newId = uid("nd");
    const typeInfo = NODE_TYPES[type];
    const newCounter = (nodeCounters[type] || 0) + 1;
    setNodeCounters(prev => ({ ...prev, [type]: newCounter }));
    const defaultName = typeInfo.label.replace("判断", "") + newCounter;
    const newNode: FlowNode = { id: newId, type: type as any, name: defaultName, config: {} };
    if (type === 'and_branch' || type === 'or_branch') {
      newNode.branches = [
        { id: uid("br"), name: "分支1", config: {}, nested: [] },
        { id: uid("br"), name: "分支2", config: {}, nested: [] }
      ];
    }
    setCanvasFlow(prev => {
      const next = JSON.parse(JSON.stringify(prev)) as Flow;
      next.nodes[newId] = newNode as any;
      if (ctx) {
        const branch = next.nodes[ctx.parentNodeId]?.branches?.find(b => b.id === ctx.branchId);
        if (branch) branch.nested.splice(index, 0, newId);
      } else {
        next.mainFlow.splice(index, 0, newId);
      }
      return next;
    });
    setIsDirty(true);
  }, [nodeMenuCtx, nodeCounters]);
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const routeHandle = useRef<{ id: string; startX: number; startOff: number } | null>(null);

  // --- Derived ---
  const currentGroup = groups.find(g => g.id === currentTabId);
  function showConfirmModal(opts: {
    title: string;
    body: React.ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
  }) {
    setConfirmModalContent(opts);
    setConfirmModalVisible(true);
  }

  const currentRule = currentGroup?.rules.find(r => r.id === currentRuleId);
  const allRules = groups.flatMap(g => g.rules);
  const filteredRules = sortRules(
    (currentGroup?.rules || []).filter(r => {
      const nm = !filterName || r.name.toLowerCase().includes(filterName.toLowerCase());
      const dc = !filterDesc || (r.description || "").toLowerCase().includes(filterDesc.toLowerCase());
      const st = !filterStatus || (filterStatus === "on" ? r.enabled : filterStatus === "draft" ? r.drafted : !r.enabled && !r.drafted);
      return nm && dc && st;
    })
  );

  // --- Toast ---
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  }, []);

  // --- Load Data ---
  const loadData = useCallback(async () => {
    try {
      const resp = await api.getGroups();
      const data = resp.data;
      const loadedGroups: Group[] = (data?.groups || []).map((g: any) => ({
        id: g.id, name: g.name,
        rules: (data?.rules || []).filter((r: any) => r.groupId === g.id).map((r: any) => ({
          id: r.id, name: r.name, description: r.description || "",
          enabled: r.status === "ACTIVE", drafted: r.status === "DRAFT",
          poll: secondsToPoll(r.pollInterval),
          flow: parseFlow(r.flow),
        }))
      }));
      setGroups(loadedGroups);
      if (!currentTabId && loadedGroups.length > 0) {
        setCurrentTabId(loadedGroups[0].id);
        if (loadedGroups[0].rules.length > 0) {
          selectRule(loadedGroups[0].rules[0].id, loadedGroups);
        }
      }
    } catch { showToast("加载数据失败"); }
  }, [currentTabId, showToast]);

  useEffect(() => { loadData(); }, []);

  // 全局点击关闭节点类型菜单
  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('.nmm') && !target.closest('.plus') && nodeMenuVisible) {
        setNodeMenuVisible(false);
      }
    }
    document.addEventListener('mousedown', handleGlobalClick, true);
    return () => document.removeEventListener('mousedown', handleGlobalClick, true);
  }, [nodeMenuVisible]);

  // --- Poll Interval Helpers ---
  function secondsToPoll(s: number): PollInterval {
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return { d, h, m, s };
  }
  function pollToSecondsInput(p: PollInterval): number {
    return 86400 * (p.d || 0) + 3600 * (p.h || 0) + 60 * (p.m || 0) + (p.s || 0);
  }

  // --- Flow Parse ---
  function parseFlow(flowStr: string | undefined): Flow {
    if (!flowStr) return createEmptyFlow();
    try {
      const parsed = typeof flowStr === "string" ? JSON.parse(flowStr) : flowStr;
      return parsed && typeof parsed === "object" ? parsed : createEmptyFlow();
    } catch { return createEmptyFlow(); }
  }

  // --- Tab Operations ---
  function switchTab(tabId: string) {
    if (tabId === currentTabId) return;
    if (isDirty && currentRuleId) {
      if (!confirm("切换分组将丢失修改，确认？")) return;
    }
    setCurrentTabId(tabId);
    setCurrentRuleId(null);
    setIsDirty(false);
    setDrawerOpen(false);
    setPreviewMode(false);
    stopPreview();
    setCanvasFlow(createEmptyFlow());
    // 重置全选状态
    const checkAll = document.getElementById('check-all') as HTMLInputElement | null;
    if (checkAll) checkAll.checked = false;
    document.querySelectorAll<HTMLInputElement>('.ric').forEach(el => { el.checked = false; });
  }

  async function addTab() {
    const name = "分组" + (groups.length + 1);
    try {
      const resp = await api.createGroup(name);
      const realId = resp.data?.id;
      if (!realId) { showToast("创建分组失败：未获取到ID"); return; }
      const newGroup: Group = { id: realId, name, rules: [] };
      setGroups(prev => [...prev, newGroup]);
      setCurrentTabId(realId);
      setCurrentRuleId(null);
      setIsDirty(false);
      showToast("已创建分组");
    } catch { showToast("创建分组失败"); }
  }

  async function deleteTab(tabId: string) {
    if (isDirty && currentRuleId) { showToast("当前规则有未保存的流程修改，请先保存或暂存后再操作"); return; }
    if (groups.length <= 1) { showToast("至少保留一个分组"); return; }
    if (!confirm(`确认删除分组「${groups.find(g => g.id === tabId)?.name}」？`)) return;
    try {
      await api.deleteGroup(tabId);
      setGroups(prev => prev.filter(g => g.id !== tabId));
      if (currentTabId === tabId) {
        const remaining = groups.filter(g => g.id !== tabId);
        if (remaining.length > 0) switchTab(remaining[0].id);
      }
      showToast("分组已删除");
    } catch { showToast("删除分组失败"); }
  }

  async function renameTab(tabId: string, newName: string) {
    if (!newName.trim()) { setTabEditing(null); return; }
    try {
      await api.updateGroup(tabId, newName.trim());
      await loadData();
      setTabEditing(null);
    } catch { showToast("重命名失败"); }
  }

  // --- Rule Operations ---
  function selectRule(ruleId: string, grps?: Group[]) {
    const grpList = grps || groups;
    const grp = grpList.find(g => g.id === currentTabId);
    const rule = grp?.rules.find(r => r.id === ruleId);
    if (!rule) return;
    setCurrentRuleId(ruleId);
    setIsDirty(false);
    setDrawerOpen(false);
    stopPreview();
    // Load flow into canvas
    const flow = rule.flow || createEmptyFlow();
    setCanvasFlow(JSON.parse(JSON.stringify(flow)));
    // Count node types
    const counters: Record<string, number> = {};
    Object.values(flow.nodes).forEach((n: any) => { counters[n.type] = (counters[n.type] || 0) + 1; });
    setNodeCounters(counters);
    setCanvasScale(1);
    setCanvasOffset({ x: 60, y: 40 });
  }

  function handleSwitchRule(ruleId: string) {
    if (ruleId === currentRuleId) return; // 已经在当前规则，无需重复加载
    if (isDirty && currentRuleId) {
      if (!confirm("当前规则有未保存的流程修改，切换将丢失修改，确认？")) return;
    }
    selectRule(ruleId);
  }

  function hasRealFlowNodes(rule: Rule): boolean {
    if (!rule.flow) return false;
    const mf = rule.flow.mainFlow;
    return !!mf && mf.length > 0;
  }

  async function toggleRuleEnabled(rule: Rule, checked: boolean) {
    // 有未保存的编辑时提示先保存
    if (isDirty && currentRuleId === rule.id) {
      showToast("当前规则有未保存的流程修改，请先保存后再切换状态");
      return;
    }
    if (checked && rule.drafted) { showToast("请完成规则配置后再开启规则"); return; }
    const isEnable = checked;
    // 启用时检查当前画布流程是否有实际节点
    if (isEnable) {
      const currentFlow = canvasFlow;
      const hasNodes = currentFlow.mainFlow && currentFlow.mainFlow.length > 0;
      if (!hasNodes) {
        showToast("规则流程不完整，不可启用: 主流程为空");
        return;
      }
    }
    const pollStr = pollToDisplay(rule.poll);
    const warning = isEnable
      ? "启用后，该规则将按设定的轮询间隔自动运行，可能对项目数据产生实际影响。"
      : "停用后，该规则将立即停止执行，请确认当前无依赖此规则的关键业务正在运行。";
    showConfirmModal({
      title: `确认${isEnable ? "启用" : "停用"}规则？`,
      confirmText: isEnable ? "确认启用" : "确认停用",
      danger: !isEnable,
      onConfirm: async () => {
        try {
          await api.updateRuleStatus(rule.id, isEnable ? "ACTIVE" : "INACTIVE");
          await loadData();
          showToast(isEnable ? "规则已启用" : "规则已停用");
        } catch (e: any) {
          const msg = e?.response?.data?.message || e?.response?.data?.msg || "操作失败";
          showToast(msg);
        }
      },
      body: (
        <div>
          <div style={{ marginBottom: 16, lineHeight: 1.8 }}>
            <div><span style={{ color: "var(--muted)" }}>规则名称：</span>{escHtml(rule.name)}</div>
            <div><span style={{ color: "var(--muted)" }}>规则描述：</span>{escHtml(rule.description || "暂无描述")}</div>
            <div><span style={{ color: "var(--muted)" }}>轮询间隔：</span>{pollStr}</div>
          </div>
          <div style={{ color: "var(--warn)", fontSize: 12, lineHeight: 1.6 }}>
            ⚠️ {warning}
            <br />
            请确认操作符合预期后再继续。
          </div>
        </div>
      ),
    });
    // 注意：确认框 onConfirm 中已处理状态变更，此处不再重复调用
  }

  async function deleteRule(ruleId: string) {
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) return;
    if (isDirty && currentRuleId === ruleId) { showToast("当前规则有未保存的流程修改，请先保存或暂存后再删除"); return; }
    if (rule.enabled) { showToast("规则启用中，停用后可删除"); return; }
    if (!confirm(`确认删除规则「${rule.name}」？此操作不可撤销。`)) return;
    try {
      await api.deleteRule(ruleId);
      await loadData();
      if (currentRuleId === ruleId) { setCurrentRuleId(null); setCanvasFlow(createEmptyFlow()); }
      showToast("已删除");
    } catch { showToast("删除失败"); }
  }

  async function batchDelete() {
    const checked = document.querySelectorAll<HTMLInputElement>(".ric:checked");
    const ids = Array.from(checked).map(el => el.dataset.id!).filter(Boolean);
    if (!ids.length) { showToast("请先勾选"); return; }
    if (isDirty && currentRuleId && ids.includes(currentRuleId)) { showToast("当前规则有未保存的流程修改，请先保存或暂存后再删除"); return; }
    const enabled = allRules.filter(r => ids.includes(r.id) && r.enabled);
    if (enabled.length) { showToast("启用中不可删除：" + enabled.map(r => r.name).join(",")); return; }
    if (!confirm(`确认批量删除 ${ids.length} 条规则？此操作不可撤销。`)) return;
    try {
      await api.batchDeleteRules(ids);
      await loadData();
      if (ids.includes(currentRuleId || "")) { setCurrentRuleId(null); setCanvasFlow(createEmptyFlow()); }
      showToast(`已删除${ids.length}条`);
    } catch { showToast("批量删除失败"); }
  }

  // --- Canvas Operations ---
  function genNodeId() { return uid("nd"); }
  function genBranchId() { return uid("br"); }

  function nextNodeName(type: string): string {
    const counters = { ...nodeCounters };
    counters[type] = (counters[type] || 0) + 1;
    setNodeCounters(counters);
    const label = NODE_TYPES[type]?.label.replace("判断", "") || type;
    return label + counters[type];
  }

  function openNodeMenu(index: number, ctx: { parentNodeId: string; branchId: string } | null) {
    if (!isDirty) return;
    setNodeMenuCtx({ index, ctx });
    setNodeMenuPos({ x: window.event instanceof MouseEvent ? window.event.clientX : 300, y: window.event instanceof MouseEvent ? window.event.clientY : 200 });
    setNodeMenuVisible(true);
  }

  function deleteNode(nodeId: string, ctx: { parentNodeId: string; branchId: string } | null) {
    if (!isDirty) return;
    const flow = JSON.parse(JSON.stringify(canvasFlow));
    const node = flow.nodes[nodeId];
    if (node?.branches) node.branches.forEach((b: any) => b.nested.forEach((nid: string) => deleteNodeDeep(flow, nid)));
    if (ctx) {
      const branch = flow.nodes[ctx.parentNodeId]?.branches?.find((b: any) => b.id === ctx.branchId);
      if (branch) branch.nested = branch.nested.filter((nid: string) => nid !== nodeId);
    } else {
      flow.mainFlow = flow.mainFlow.filter((nid: string) => nid !== nodeId);
    }
    delete flow.nodes[nodeId];
    // Clean up route targets
    Object.values(flow.nodes).forEach((n: any) => {
      if (n.type === "route" && n.config?.targetId === nodeId) n.config.targetId = "";
    });
    setCanvasFlow(flow);
    if (drawerCtx?.nodeId === nodeId) setDrawerOpen(false);
  }

  function deleteNodeDeep(flow: Flow, nodeId: string) {
    const node = flow.nodes[nodeId];
    if (!node) return;
    if (node.branches) node.branches.forEach((b: any) => b.nested.forEach((nid: string) => deleteNodeDeep(flow, nid)));
    delete flow.nodes[nodeId];
  }

  function addBranch(nodeId: string) {
    if (!isDirty) return;
    const flow = JSON.parse(JSON.stringify(canvasFlow));
    const node = flow.nodes[nodeId];
    if (!node?.branches) return;
    const newBranch = { id: genBranchId(), name: "分支" + (node.branches.length + 1), config: { param: "", op: "", threshold: "", min: "", max: "" }, nested: [] };
    node.branches.push(newBranch);
    setCanvasFlow(flow);
  }

  function renameBranch(nodeId: string, branchId: string, newName: string) {
    if (!isDirty || !newName.trim()) return;
    const flow = JSON.parse(JSON.stringify(canvasFlow));
    const node = flow.nodes[nodeId];
    if (!node?.branches) return;
    const branch = node.branches.find((b: any) => b.id === branchId);
    if (branch) { branch.name = newName.trim(); setCanvasFlow(flow); }
  }

  function deleteBranch(nodeId: string, branchId: string, ctx: { parentNodeId: string; branchId: string } | null) {
    if (!isDirty) return;
    const flow = JSON.parse(JSON.stringify(canvasFlow));
    const node = flow.nodes[nodeId];
    if (!node?.branches || node.branches.length <= 2) { showToast("至少2条分支"); return; }
    const branch = node.branches.find((b: any) => b.id === branchId);
    if (branch) branch.nested.forEach((nid: string) => deleteNodeDeep(flow, nid));
    node.branches = node.branches.filter((b: any) => b.id !== branchId);
    setCanvasFlow(flow);
  }

  // --- Edit Mode ---
  function enterEditMode() {
    if (!currentRule) return;
    if (currentRule.enabled) { showToast("规则启用中，停用后可编辑"); return; }
    setIsDirty(true);
    stopPreview();
  }

  function exitEditMode(discard = false) {
    if (!discard && currentRule) {
      const flow = currentRule.flow || createEmptyFlow();
      setCanvasFlow(JSON.parse(JSON.stringify(flow)));
      const counters: Record<string, number> = {};
      Object.values(flow.nodes).forEach((n: any) => { counters[n.type] = (counters[n.type] || 0) + 1; });
      setNodeCounters(counters);
    }
    setIsDirty(false);
    setDrawerOpen(false);
  }

  // --- 全量刷新（保存/暂存后，从后端重新加载） ---
  async function fullRefresh() {
    try {
      const resp = await api.getGroups();
      const data = resp.data;
      const loadedGroups: Group[] = (data?.groups || []).map((g: any) => ({
        id: g.id, name: g.name,
        rules: (data?.rules || []).filter((r: any) => r.groupId === g.id).map((r: any) => ({
          id: r.id, name: r.name, description: r.description || "",
          enabled: r.status === "ACTIVE", drafted: r.status === "DRAFT",
          poll: secondsToPoll(r.pollInterval),
          flow: parseFlow(r.flow),
        }))
      }));
      setGroups(loadedGroups);
      // 重新选中当前规则并刷新画布
      const grp = loadedGroups.find(g => g.id === currentTabId);
      const fresh = grp?.rules.find(r => r.id === currentRuleId);
      if (fresh) {
        const flow = fresh.flow || createEmptyFlow();
        setCanvasFlow(JSON.parse(JSON.stringify(flow)));
        const counters: Record<string, number> = {};
        Object.values(flow.nodes).forEach((n: any) => { counters[n.type] = (counters[n.type] || 0) + 1; });
        setNodeCounters(counters);
        setCanvasScale(1);
        setCanvasOffset({ x: 60, y: 40 });
      }
      setIsDirty(false);
      setDrawerOpen(false);
    } catch { showToast("刷新失败"); }
  }

  // --- Save / Draft ---
  async function saveRule() {
    if (!currentRule) return;
    const unconfigured = findUnconfigured(canvasFlow);
    if (unconfigured) {
      scrollToNode(unconfigured);
      showToast("有节点未配置");
      return;
    }
    const invalidRoute = Object.values(canvasFlow.nodes).find((n: any) =>
      n.type === "route" && n.config?.targetId && !isRouteTargetValid(canvasFlow, n.id, n.config.targetId)
    );
    if (invalidRoute) {
      scrollToNode((invalidRoute as any).id);
      showToast("路由目标不合法");
      return;
    }
    try {
      await api.saveRuleFlow(currentRule.id, JSON.stringify(canvasFlow));
      // 保存后从后端重新加载完整数据，刷新页面
      await fullRefresh();
      showToast("已保存✓");
    } catch { showToast("保存失败"); }
  }

  async function draftRule() {
    if (!currentRule) return;
    try {
      await api.saveRuleFlow(currentRule.id, JSON.stringify(canvasFlow), true);
      await fullRefresh();
      showToast("规则已暂存，完成配置后可正式保存并启用");
    } catch { showToast("暂存失败"); }
  }

  function findUnconfigured(flow: Flow): string | null {
    for (const nodeId of flow.mainFlow) {
      const node = flow.nodes[nodeId];
      if (!node) continue;
      if (node.branches) {
        for (const branch of node.branches) {
          if (!isBranchConfigured(flow, branch)) return nodeId;
          for (const nestedId of branch.nested) {
            const inner = findUnconfigured({ ...flow, mainFlow: [nestedId] });
            if (inner) return nestedId;
          }
        }
      } else if (!isNodeConfigured(node)) {
        return nodeId;
      }
    }
    return null;
  }

  function isNodeConfigured(node: any): boolean {
    if (node.type === "rule") return isCondConfigured(node.config);
    if (node.type === "route") return isCondConfigured(node.config) && !!node.config?.targetId;
    if (node.type === "timer") return !!node.config?.kind && !!(node.config?.groups?.length);
    if (node.type === "modify") return !!(node.config?.param && node.config?.value !== undefined);
    if (node.type === "delay") {
      const v = parseInt(node.config?.value);
      return !!(v && v > 0 && node.config?.unit);
    }
    return true;
  }

  function isCondConfigured(cfg: any): boolean {
    if (!cfg) return false;
    if (cfg.condMode === "script") return !!(cfg.script || "").trim();
    if (!cfg.param || !cfg.op) return false;
    if (cfg.op === "范围内") return cfg.min !== "" && cfg.max !== "" && parseFloat(cfg.min) < parseFloat(cfg.max);
    return cfg.threshold !== "";
  }

  function isBranchConfigured(flow: Flow, branch: any): boolean {
    if (!isCondConfigured(branch.config)) return false;
    return branch.nested.every((nid: string) => {
      const node = flow.nodes[nid];
      if (!node) return false;
      if (node.branches) return node.branches.every((b: any) => isBranchConfigured(flow, b));
      return isNodeConfigured(node);
    });
  }

  function isRouteTargetValid(flow: Flow, fromId: string, toId: string): boolean {
    if (fromId === toId) return false;
    const target = flow.nodes[toId];
    return !!(target && target.type !== "route" && flow.mainFlow.includes(toId));
  }

  function scrollToNode(nodeId: string) {
    // Trigger scroll via RuleCanvas prop
    setScrollToNodeId(nodeId);
    // Clear after animation completes
    setTimeout(() => setScrollToNodeId(null), 1600);
  }

  // --- Drawer ---
  function openDrawer(nodeId: string, branchId?: string) {
    if (!isDirty) return;
    const node = canvasFlow.nodes[nodeId];
    if (!node) return;
    if (node.type === "and_branch" || node.type === "or_branch") {
      setDrawerCtx({ kind: "branch_group", nodeId, branchId: branchId || node.branches[0]?.id });
    } else {
      setDrawerCtx({ kind: "node", nodeId });
    }
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerCtx(null);
    closeParamPicker();
  }

  // --- Param Picker ---
  const [paramPickerCallback, setParamPickerCallback] = useState<((name: string) => void) | null>(null);
  const [pickerCurrentParam, setPickerCurrentParam] = useState<string | undefined>(undefined);

  function openParamPicker(current: string | undefined, cb: (name: string) => void) {
    setParamPickerCallback(() => cb);
    setPickerCurrentParam(current);
    setParamPickerOpen(true);
  }

  function closeParamPicker() {
    setParamPickerOpen(false);
    setParamPickerCallback(null);
    setPickerCurrentParam(undefined);
  }

  // --- Preview ---
  function startPreview() {
    if (!currentRule) return;
    setPreviewMode(true);
    tickPreview();
    const iv = setInterval(tickPreview, 2000);
    setPreviewInterval(iv);
  }

  function stopPreview() {
    if (previewInterval) clearInterval(previewInterval);
    setPreviewInterval(null);
    setPreviewMode(false);
    setNodeStatuses({});
    setBranchStatuses({});
  }

  function tickPreview() {
    const statuses = simulateFlow(canvasFlow);
    setNodeStatuses(statuses.nodeStatuses);
    setBranchStatuses(statuses.branchStatuses);
  }

  function simulateFlow(flow: Flow) {
    const ns: Record<string, string> = {};
    const bs: Record<string, string> = {};
    if (!flow || !flow.mainFlow) return { nodeStatuses: ns, branchStatuses: bs };
    Object.values(flow.nodes).forEach((n: any) => {
      ns[n.id] = "pending";
      if (n.branches) n.branches.forEach((b: any) => { bs[b.id] = "pending"; });
    });
    let failed = false;
    for (const nodeId of flow.mainFlow) {
      const node = flow.nodes[nodeId];
      if (!node) { failed = true; break; }
      if (failed) { ns[nodeId] = "pending"; continue; }
      const result = simulateNode(node, flow);
      ns[nodeId] = result ? "pass" : "fail";
      if (result === false) failed = true;
      if (node.branches) {
        node.branches.forEach((b: any) => {
          bs[b.id] = simulateBranch(b, flow) ? "pass" : "fail";
        });
      }
    }
    return { nodeStatuses: ns, branchStatuses: bs };
  }

  function simulateNode(node: any, flow: Flow): boolean | null {
    if (node.type === "rule") return Math.random() > 0.3;
    if (node.type === "timer") return Math.random() > 0.5;
    if (node.type === "delay" || node.type === "modify") return true;
    if (node.type === "route") return Math.random() > 0.3;
    if (node.type === "and_branch" || node.type === "or_branch") {
      if (!node.branches?.length) return null;
      return node.type === "and_branch"
        ? node.branches.every((b: any) => simulateBranch(b, flow))
        : node.branches.some((b: any) => simulateBranch(b, flow));
    }
    return true;
  }

  function simulateBranch(branch: any, flow: Flow): boolean {
    const cond = Math.random() > 0.3;
    if (!cond) return false;
    return branch.nested.every((nid: string) => {
      const n = flow.nodes[nid];
      if (!n) return false;
      const r = simulateNode(n, flow);
      return r !== false;
    });
  }

  // --- Canvas Pan/Zoom ---
  function onCanvasWheel(e: React.WheelEvent) {
    if (!currentRuleId) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setCanvasScale(s => Math.min(2, Math.max(0.3, s * delta)));
  }

  function onCanvasMouseDown(e: React.MouseEvent) {
    if (!currentRuleId) return;
    const target = e.target as HTMLElement;
    if (target.closest(".node") || target.closest(".bcd") || target.closest(".plus") || target.closest(".bh2") || target.closest(".nmm")) return;
    // 点击视图空白处关闭节点类型菜单
    if (nodeMenuVisible) setNodeMenuVisible(false);
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { ...canvasOffset };
  }

  function onCanvasMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setCanvasOffset({ x: dragOffset.current.x + dx, y: dragOffset.current.y + dy });
  }

  function onCanvasMouseUp() { isDragging.current = false; }

  function zoomIn() { setCanvasScale(s => Math.min(2, s + 0.1)); }
  function zoomOut() { setCanvasScale(s => Math.max(0.25, s - 0.1)); }
  function resetZoom() {
    setCanvasScale(1);
    setCanvasOffset({ x: 60, y: 40 });
  }

  // --- Import/Export ---
  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    showToast("正在处理文件…");
    const results = { ok: [] as string[], drafted: [] as string[], skipped: [] as { name: string; reason: string }[] };

    for (const file of files) {
      try {
        if (file.name.toLowerCase().endsWith(".zip")) {
          // Use JSZip dynamically
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(file);
          const jsonFiles = Object.entries(zip.files).filter(([name, f]: [string, any]) => !f.dir && name.toLowerCase().endsWith(".json"));
          for (const [fname, zipEntry] of jsonFiles) {
            const text = await (zipEntry as any).async("text");
            processImportedJson(fname, text, results);
          }
        } else if (file.name.toLowerCase().endsWith(".json")) {
          const text = await file.text();
          processImportedJson(file.name, text, results);
        } else {
          results.skipped.push({ name: file.name, reason: "不支持的文件格式（仅支持 .json 和 .zip）" });
        }
      } catch (err: any) {
        results.skipped.push({ name: file.name, reason: err.message || "文件处理失败" });
      }
    }

    await loadData();
    setImportResult(results);
    if (e.target) e.target.value = "";
  }

  async function processImportedJson(filename: string, text: string, results: { ok: string[]; drafted: string[]; skipped: { name: string; reason: string }[] }) {
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { results.skipped.push({ name: filename, reason: "JSON 解析失败" }); return; }
    if (!parsed.name || !parsed.flow) { results.skipped.push({ name: filename, reason: "缺少必填字段：name 或 flow" }); return; }
    const targetGroupId = currentTabId || groups[0]?.id;
    if (!targetGroupId) return;
    // Check completeness
    const isComplete = checkFlowComplete(parsed.flow);
    let name = parsed.name.trim();
    const grp = groups.find(g => g.id === targetGroupId);
    while (grp?.rules.some(r => r.name === name)) name += "New";
    const poll = parsed.pollInterval ? secondsToPoll(parsed.pollInterval) : { d: 0, h: 0, m: 0, s: 30 };
    try {
      await api.importRule(targetGroupId, { name, description: parsed.description || "", pollInterval: pollToSecondsInput(poll), flow: JSON.stringify(parsed.flow) });
      (isComplete ? results.ok : results.drafted).push(name);
    } catch { results.skipped.push({ name: filename, reason: "导入失败" }); }
  }

  function checkFlowComplete(flow: any): boolean {
    if (!flow?.mainFlow?.length) return false;
    return flow.mainFlow.every((nid: string) => {
      const node = flow.nodes?.[nid];
      if (!node) return false;
      if (node.type === "rule") return isCondConfigured(node.config);
      if (node.type === "timer") return !!node.config?.kind && !!(node.config?.groups?.length);
      if (node.type === "modify") return !!(node.config?.param && node.config?.value !== undefined);
      if (node.type === "delay") { const v = parseInt(node.config?.value); return !!(v && v > 0 && node.config?.unit); }
      if (node.type === "route") return isCondConfigured(node.config) && !!node.config?.targetId;
      return true;
    });
  }

  async function exportRules() {
    const checked = document.querySelectorAll<HTMLInputElement>(".ric:checked");
    const ids = Array.from(checked).map(el => el.dataset.id!).filter(Boolean);
    const rulesToExport = ids.length > 0 ? allRules.filter(r => ids.includes(r.id)) : (currentGroup?.rules || []);
    if (!rulesToExport.length) { showToast("当前分组暂无规则可导出"); return; }
    if (rulesToExport.length === 1) {
      const r = rulesToExport[0];
      const blob = new Blob([JSON.stringify({ name: r.name, description: r.description, poll: r.poll, flow: r.flow }, null, 2)], { type: "application/json" });
      downloadBlob(blob, (r.name || "rule") + ".json");
      showToast("已导出 1 条规则");
    } else {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const nameCount: Record<string, number> = {};
      rulesToExport.forEach(r => {
        let base = (r.name || "rule").replace(/[\\/:*?"<>|]/g, "_").trim();
        nameCount[base] = (nameCount[base] || 0) + 1;
        const fname = nameCount[base] > 1 ? `${base}_${nameCount[base]}.json` : `${base}.json`;
        zip.file(fname, JSON.stringify({ name: r.name, description: r.description, poll: r.poll, flow: r.flow }, null, 2));
      });
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(blob, (currentGroup?.name || "规则") + "_规则导出.zip");
      showToast(`已导出 ${rulesToExport.length} 条`);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  // --- Logs ---
  function openLogModal(ruleId?: string) {
    setLogRuleId(ruleId || null);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    setLogFilterTsStart(dateStr + "T00:00");
    setLogFilterTsEnd(dateStr + "T23:59");
    setLogFilterLevel("");
    setLogFilterRule(ruleId || "");
    loadLogs();
    setLogModalOpen(true);
  }

  async function loadLogs() {
    try {
      const params: any = { limit: 200 };
      if (logFilterRule) params.ruleId = logFilterRule;
      if (logFilterLevel) params.level = logFilterLevel;
      const resp = await api.getLogs(params);
      let items = resp.data?.items || [];
      if (logFilterTsStart) items = items.filter((l: any) => new Date(l.ts) >= new Date(logFilterTsStart));
      if (logFilterTsEnd) items = items.filter((l: any) => new Date(l.ts) <= new Date(logFilterTsEnd));
      setLogs(items.map((l: any) => ({ ...l, ts: new Date(l.ts) })));
    } catch { setLogs([]); }
  }

  // --- Render Node Summary ---
  function getNodeSummary(node: any): string {
    if (node.type === "rule") {
      const cfg = node.config || {};
      if (cfg.condMode === "script") return "脚本：" + (cfg.script || "").slice(0, 20);
      return `${cfg.param || ""} ${cfg.op || ""} ${cfg.op === "范围内" ? `[${cfg.min || ""},${cfg.max || ""}]` : cfg.threshold || ""}`;
    }
    if (node.type === "timer") {
      const cfg = node.config || {};
      if (!cfg.kind || !cfg.groups?.length) return "";
      const g = cfg.groups[0];
      if (cfg.kind === "specific") return "指定时间";
      if (cfg.kind === "daily") return `每天 ${g.timeRange?.start || ""}~${g.timeRange?.end || ""}`;
      if (cfg.kind === "weekly") return `每周${(g.days || []).map((d: number) => "一二三四五六日"[d-1]).join("")}`;
      if (cfg.kind === "monthly") return `每月${g.dayRange?.start || ""}~${g.dayRange?.end || ""}日`;
      if (cfg.kind === "yearly") return `每年${g.dateRange?.startMonth || ""}月${g.dateRange?.startDay || ""}日`;
      return "";
    }
    if (node.type === "delay") return `延时 ${node.config?.value || 0} ${node.config?.unit || "秒"}后继续`;
    if (node.type === "modify") return `${node.config?.param || ""} = ${node.config?.value || ""}`;
    if (node.type === "route") {
      const tgt = canvasFlow.nodes[node.config?.targetId]?.name || "?";
      const src = getNodeSummary({ config: node.config });
      return `${src} → ${tgt}`;
    }
    if (node.type === "and_branch" || node.type === "or_branch") return (node.branches?.length || 0) + " 条子分支";
    return "";
  }

  function getBranchSummary(branch: any): string {
    const cfg = branch.config || {};
    if (cfg.condMode === "script") return "脚本：" + (cfg.script || "").slice(0, 20);
    return `${cfg.param || ""} ${cfg.op || ""} ${cfg.op === "范围内" ? `[${cfg.min || ""},${cfg.max || ""}]` : cfg.threshold || ""}`;
  }

  function isNodeComplete(node: any): boolean {
    if (node.type === "rule") return isCondConfigured(node.config);
    if (node.type === "timer") return !!node.config?.kind && !!(node.config?.groups?.length);
    if (node.type === "modify") return !!(node.config?.param && node.config?.value !== undefined);
    if (node.type === "delay") { const v = parseInt(node.config?.value); return !!(v && v > 0 && node.config?.unit); }
    if (node.type === "route") return isCondConfigured(node.config) && !!node.config?.targetId;
    return true;
  }

  function isBranchComplete(branch: any): boolean {
    if (!isCondConfigured(branch.config)) return false;
    return branch.nested.every((nid: string) => {
      const n = canvasFlow.nodes[nid];
      if (!n) return false;
      if (n.branches) return n.branches.every((b: any) => isBranchComplete(b));
      return isNodeComplete(n);
    });
  }

  // --- Render Canvas ---
  function renderNode(node: any, ctx: { parentNodeId: string; branchId: string } | null) {
    const isComplete = isNodeComplete(node);
    const status = nodeStatuses[node.id];
    const typeClass = `t-${node.type}`;
    const statusClass = status ? `rs-${status}` : "";
    return (
      <div key={node.id} className={`node ${typeClass} ${statusClass}`} data-node-id={node.id}
        onClick={() => isDirty && openDrawer(node.id)}>
        <div className="tbs" />
        <div className="head">
          <div>
            <div className="typename">{NODE_TYPES[node.type]?.label}</div>
          </div>
          <div className="title" data-name>{escHtml(node.name)}</div>
          <div className="del" onClick={(e) => { e.stopPropagation(); deleteNode(node.id, ctx); }}>×</div>
        </div>
        <div className="body">
          {isComplete
            ? <div className="summary">{escHtml(getNodeSummary(node))}</div>
            : <div className="unconfigured">请完善节点配置</div>
          }
        </div>
      </div>
    );
  }

  function renderBranchCard(node: any, branch: any, ctx: { parentNodeId: string; branchId: string } | null) {
    const isComplete = isBranchComplete(branch);
    const status = branchStatuses[branch.id];
    const statusClass = status ? `rs-${status}` : "";
    return (
      <div key={branch.id} className={`bcd ${statusClass}`} data-branch-id={branch.id} data-parent-node-id={node.id}
        onClick={() => { if (isDirty) { setDrawerCtx({ kind: "branch_group", nodeId: node.id, branchId: branch.id }); setDrawerOpen(true); } }}>
        <div className="bc-stripe" />
        <div className="bch">
          <span className="bct">{node.type === "and_branch" ? "AND 判断分支" : "OR 判断分支"}</span>
          <span className="bcn" data-bname>{escHtml(branch.name)}</span>
          <div className="bce" onClick={(e) => { e.stopPropagation(); deleteBranch(node.id, branch.id, ctx); }}>×</div>
        </div>
        <div className="bcb">
          {isComplete
            ? <div className="summary" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{escHtml(getBranchSummary(branch))}</div>
            : <div className="unconfigured">请正确设置分支条件</div>
          }
        </div>
      </div>
    );
  }

  function getClickHandler(index: number, ctx: { parentNodeId: string; branchId: string } | null, e: React.MouseEvent) {
    if (!isDirty) return;
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    showNodeMenu(index, ctx, rect.left - 100, rect.top + 25);
  }

  function renderConnector(onClick: () => void, scale: number, index: number, ctx: { parentNodeId: string; branchId: string } | null) {
    return (
      <div className="conn">
        <div style={{ width: "2px", minHeight: "22px", background: "#c8cfdc", flex: 1 }} />
        <div className="plus" style={{ transform: `scale(${1/scale})` }} onClick={(e) => getClickHandler(index, ctx, e)}>+</div>
        <div style={{ width: "2px", minHeight: "22px", background: "#c8cfdc", flex: 1 }} />
        <div className="arrow-down" />
      </div>
    );
  }

  function renderFlow() {
    const flow = canvasFlow;
    const elements: React.ReactNode[] = [];

    // Start terminal
    elements.push(
      <div key="start" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="term start">开始</div>
        {isDirty && renderConnector(() => {}, canvasScale, 0, null)}
      </div>
    );

    // Main flow
    flow.mainFlow.forEach((nodeId, idx) => {
      const node = flow.nodes[nodeId];
      if (!node) return;
      if (node.type === "and_branch" || node.type === "or_branch") {
        // Branch container
        elements.push(
          <div key={nodeId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className={`bx t-${node.type}`} data-node-id={nodeId}>
              <div className="bh2">
                <span className="ptag">{node.type === "and_branch" ? "AND" : "OR"}</span>
                <span className="pname" data-pname>{escHtml(node.name)}</span>
                <div className="bhs" />
                {isDirty && <button className="bhb" onClick={() => addBranch(nodeId)}>+ 添加分支</button>}
                {isDirty && <button className="bhb danger" onClick={() => deleteNode(nodeId, null)}>删除节点</button>}
              </div>
              <div className="bsr">
                {node.branches.map((branch: any, bIdx: number) => (
                  <div key={branch.id} className="bcl" style={{ position: "relative" }}>
                    <div className="csb" />
                    {renderBranchCard(node, branch, { parentNodeId: node.id, branchId: branch.id })}
                    {branch.nested.map((nestedId: string, nIdx: number) => {
                      const nestedNode = flow.nodes[nestedId];
                      if (!nestedNode) return null;
                      return (
                        <div key={nestedId} style={{ display: "contents" }}>
                          <div className="cst" />
                          {renderConnector(() => {}, canvasScale, 0, null)}
                          {renderNode(nestedNode, { parentNodeId: node.id, branchId: branch.id })}
                        </div>
                      );
                    })}
                    {isDirty && <div className="csp" />}
                    {isDirty && branch.nested.length === 0 && <div className="csp" />}
                    {isDirty && renderConnector(() => {}, canvasScale, 0, null)}
                    <div className="csb" />
                  </div>
                ))}
              </div>
            </div>
            {isDirty && renderConnector(() => {}, canvasScale, idx + 1, null)}
          </div>
        );
      } else {
        elements.push(
          <div key={nodeId} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {renderNode(node, null)}
            {isDirty && renderConnector(() => {}, canvasScale, idx + 1, null)}
          </div>
        );
      }
    });

    // Empty main flow
    if (flow.mainFlow.length === 0) {
      elements.push(
        <div key="empty-main" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {isDirty && renderConnector(() => {}, canvasScale, 0, null)}
        </div>
      );
    }

    // End terminal
    elements.push(
      <div key="end" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="term end">结束</div>
      </div>
    );

    return (
      <div className="flow">
        {elements}
      </div>
    );
  }

  // --- Rule Form Modal ---
  const [ruleFormName, setRuleFormName] = useState("");
  const [ruleFormDesc, setRuleFormDesc] = useState("");
  const [ruleFormPoll, setRuleFormPoll] = useState<PollInterval>({ d: 0, h: 0, m: 0, s: 30 });

  function handlePollChange(field: keyof PollInterval, raw: number) {
    setRuleFormPoll(prev => {
      const next = { ...prev, [field]: raw };
      // 超限自动向大单位进位
      let total = pollToSeconds(next);
      // 不超过30天
      if (total > 2592000) total = 2592000;
      const d = Math.floor(total / 86400); total %= 86400;
      const h = Math.floor(total / 3600); total %= 3600;
      const m = Math.floor(total / 60);
      const s = total % 60;
      return { d, h, m, s };
    });
  }

  function openNewRuleModal() {
    setEditRuleId(null);
    setRuleFormName("");
    setRuleFormDesc("");
    setRuleFormPoll({ d: 0, h: 0, m: 0, s: 30 });
    setRuleModalOpen(true);
  }

  function openEditRuleModal(ruleId: string) {
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) return;
    setEditRuleId(ruleId);
    setRuleFormName(rule.name);
    setRuleFormDesc(rule.description);
    setRuleFormPoll(rule.poll || { d: 0, h: 0, m: 0, s: 30 });
    setRuleModalOpen(true);
  }

  async function submitRuleForm() {
    const name = ruleFormName.trim();
    if (!name) { showToast("请输入规则名称"); return; }
    const pollSecs = pollToSeconds(ruleFormPoll);
    if (pollSecs <= 0) { showToast("轮询间隔必须大于0"); return; }
    if (pollSecs > 2592000) { showToast("轮询间隔不能超过30天"); return; }
    const grp = groups.find(g => g.id === currentTabId);
    if ((grp?.rules || []).some(r => r.name === name && r.id !== editRuleId)) {
      showToast("同一分组下已存在同名规则，请修改规则名称"); return;
    }
    try {
      if (editRuleId) {
        await api.updateRule(editRuleId, { name, description: ruleFormDesc, pollInterval: pollSecs });
        await loadData();
        showToast("已更新");
      } else {
        const targetGroupId = currentTabId || groups[0]?.id;
        if (!targetGroupId) return;
        const resp = await api.createRule({ groupId: targetGroupId, name, description: ruleFormDesc, pollInterval: pollSecs });
        await loadData();
        showToast("已创建");
        if (resp.data?.id) selectRule(resp.data.id);
      }
      setRuleModalOpen(false);
    } catch (e: any) {
      if (e?.response?.data?.code === 4001) showToast("规则名称已存在");
      else showToast(editRuleId ? "更新失败" : "创建失败");
    }
  }

  // --- Drawer Body Renderer ---
  function renderDrawerBody() {
    if (!drawerCtx) return null;
    const { kind, nodeId, branchId } = drawerCtx;
    if (kind === "branch_group") {
      const node = canvasFlow.nodes[nodeId];
      const branch = node?.branches?.find((b: any) => b.id === branchId);
      if (!branch) return null;
      return (
        <ConditionBuilder
          key={`branch-${branchId}`}
          config={branch.config}
          onChange={(cfg) => {
            const flow = JSON.parse(JSON.stringify(canvasFlow));
            const b = flow.nodes[nodeId].branches.find((br: any) => br.id === branchId);
            if (b) b.config = cfg;
            setCanvasFlow(flow);
          }}
          onOpenParamPicker={openParamPicker}
        />
      );
    } else {
      const node = canvasFlow.nodes[nodeId];
      if (!node) return null;
      return (
        <NodeConfig
          node={node}
          flow={canvasFlow}
          onChange={(updated) => {
            const flow = JSON.parse(JSON.stringify(canvasFlow));
            flow.nodes[nodeId] = updated;
            setCanvasFlow(flow);
          }}
          onOpenParamPicker={openParamPicker}
        />
      );
    }
  }

  // --- Log Filtered ---
  const filteredLogs = logs.filter(l => {
    if (logFilterLevel && l.level !== logFilterLevel) return false;
    if (logFilterRule && l.ruleId !== logFilterRule) return false;
    if (logFilterTsStart && new Date(l.ts) < new Date(logFilterTsStart)) return false;
    if (logFilterTsEnd && new Date(l.ts) > new Date(logFilterTsEnd)) return false;
    return true;
  });

  // =====================
  // =====================
  //   RENDER
  // =====================
  // =====================
  return (
    <div id="app" onMouseMove={onCanvasMouseMove} onMouseUp={onCanvasMouseUp} onMouseLeave={onCanvasMouseUp}>
      {/* Toast */}
      <div id="toast" className={`toast ${toastVisible ? "show" : ""}`}>{toastMsg}</div>

      {/* Tooltip */}
      <div id="tip" className="tip" />

      {/* ===== Tab Bar ===== */}
      <div className="tabbar">
        <div className="tadd" id="btn-add-tab" onClick={addTab}>
          <span className="tab-add-icon">+</span> 新增分组
        </div>
        <div className="tsc" id="tsc">
          {groups.map(g => (
            <div key={g.id} className={`tit ${g.id === currentTabId ? "active" : ""}`}
              onClick={() => switchTab(g.id)}>
              {tabEditing === g.id ? (
                <input className="tnm" defaultValue={g.name} autoFocus
                  onBlur={(e) => renameTab(g.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") renameTab(g.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setTabEditing(null); }}
                  onClick={(e) => e.stopPropagation()} />
              ) : (
                <span className="tnm" onDoubleClick={(e) => { e.stopPropagation(); setTabEditing(g.id); }}>
                  {escHtml(g.name)}
                </span>
              )}
              <span className="tcl" onClick={(e) => { e.stopPropagation(); deleteTab(g.id); }}>×</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Top Bar ===== */}
      <div className="topbar">
        <div className="fgp">
          <span className="flb">规则名称</span>
          <input id="filter-name" placeholder="搜索…" value={filterName}
            onChange={e => setFilterName(e.target.value)} />

          <span className="flb">描述</span>
          <input id="filter-desc" placeholder="搜索…" value={filterDesc}
            onChange={e => setFilterDesc(e.target.value)} />

          <span className="flb">状态</span>
          <select id="filter-status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="on">启用中</option>
            <option value="draft">暂存中</option>
            <option value="off">已停用</option>
          </select>
        </div>

        <div className="spacer" />

        <button className="btn primary" id="btn-new-rule" onClick={openNewRuleModal}>＋ 新建规则</button>
        <button className="btn danger" id="btn-batch-del" onClick={batchDelete}>批量删除</button>
        <button className="btn" id="btn-batch-import" onClick={triggerImport}>批量导入</button>
        <button className="btn" id="btn-batch-export" onClick={exportRules}>批量导出</button>
        <button className="btn" id="btn-view-all-logs" onClick={() => openLogModal()} style={{gap:4}}>📋 查看日志</button>
      </div>

      {/* ===== Main Layout ===== */}
      <div className="layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="shd">
            <span className="title" id="rule-count">共 {currentGroup?.rules.length || 0} 个</span>
            <label className="saw">
              <input type="checkbox" id="check-all" onChange={(e) => {
                document.querySelectorAll<HTMLInputElement>(".ric").forEach(el => { el.checked = e.target.checked; });
              }} />
              全选
            </label>
          </div>

          <div className="rls" id="rls">
            {filteredRules.length === 0 ? (
              <div className="eps">
                <div className="esi">📭</div>
                <p>{filterName || filterDesc || filterStatus ? "无匹配规则" : "暂无规则"}</p>
              </div>
            ) : filteredRules.map(rule => (
              <div key={rule.id} className={`rit ${rule.id === currentRuleId ? "active" : ""}`}
                data-rule-id={rule.id}
                onClick={() => handleSwitchRule(rule.id)}>
                <div className="rio">
                  <input type="checkbox" className="ric" data-id={rule.id}
                    onClick={e => e.stopPropagation()} />
                  <div className="rin">{escHtml(rule.name)}</div>
                  <div className="rie" title="编辑信息"
                    style={rule.enabled ? { color: "#ccc", cursor: "not-allowed" } : {}}
                    onClick={(e) => { e.stopPropagation(); rule.enabled ? showToast("规则启用中，不可编辑，请先停用后再操作") : openEditRuleModal(rule.id); }}>
                    ✎
                  </div>
                </div>
                <div className="rid">{rule.description ? escHtml(rule.description) : <span style={{ color: "#b0b7c8" }}>暂无描述</span>}</div>
                <div className="rif">
                  <span className={`rst ${rule.drafted ? "draft" : rule.enabled ? "on" : "off"}`}>
                    {rule.drafted ? "暂存中" : rule.enabled ? "启用中" : "已停用"}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted)", marginLeft: "4px" }}>
                    ⏱ {pollToStr(rule.poll)}
                  </span>
                  <span className="ri-log-btn" title="查看日志"
                    onClick={(e) => { e.stopPropagation(); openLogModal(rule.id); }}>📋</span>
                  <label className="rit2" title={rule.drafted ? "请完成规则配置后再开启规则" : ""}
                    onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={rule.enabled}
                      onClick={e => e.stopPropagation()}
                      onChange={e => toggleRuleEnabled(rule, e.target.checked)} />
                    <span className="slider" style={rule.drafted ? { opacity: 0.45 } : {}} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="ca">
          {/* Rule Header */}
          {currentRule && (
            <div className="rhd" id="rhd">
              <div className="rhi">
                <div className="rhn" id="rhn">{escHtml(currentRule.name)}</div>
                <div className="rhd2" id="rhd2">{escHtml(currentRule.description) || "暂无描述"}</div>
              </div>
              <div className="rha" style={{ position: "relative" }}>
                <div className="zgp" style={{ display: isDirty ? "flex" : "none" }} id="zgp">
                  <button id="btn-zout" onClick={zoomOut}>−</button>
                  <span className="zvl" id="zvl" onDoubleClick={resetZoom}>{Math.round(canvasScale * 100)}%</span>
                  <button id="btn-zin" onClick={zoomIn}>+</button>
                  <button id="btn-zreset" onClick={resetZoom}>⟲</button>
                </div>
                <button className="btn" id="btn-save-rule" style={{ display: isDirty ? "inline-flex" : "none" }}
                  onClick={saveRule}>保存</button>
                <button className="btn btn-draft" id="btn-draft-rule" style={{ display: isDirty ? "inline-flex" : "none" }}
                  onClick={draftRule}>暂存</button>
                <button className="btn" id="btn-preview-rule" style={{ display: isDirty ? "inline-flex" : "none", color: "#7c3aed", borderColor: "#ddd6fe" }}
                  onClick={() => previewMode ? stopPreview() : startPreview()}>
                  {previewMode ? "退出预览" : "预览"}
                </button>
                <button className="btn danger" id="btn-del-rule"
                  disabled={!!currentRule.enabled}
                  onClick={() => deleteRule(currentRuleId!)}>删除</button>
                {previewMode && (
                  <div className="runtime-legend" id="runtime-legend" style={{ position: "absolute", top: "100%", right: 0, display: "block", marginTop: 4, pointerEvents: "all" }}>
                    <div className="rl-title rl-pulse">👁 预览状态</div>
                    <div className="rl-row"><span className="rl-dot green"></span>条件满足</div>
                    <div className="rl-row"><span className="rl-dot red"></span>条件不满足</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Canvas Wrapper - Using custom DOM canvas */}
          {currentRule ? (
            <RuleCanvas
              flow={canvasFlow as Flow}
              isDirty={isDirty}
              scale={canvasScale}
              offset={canvasOffset}
              nodeStatuses={nodeStatuses}
              branchStatuses={branchStatuses}
              scrollToNodeId={scrollToNodeId}
              onAddNode={openNodeMenu}
              onDeleteNode={deleteNode}
              onDeleteBranch={deleteBranch}
              onAddBranch={addBranch}
              onRenameBranch={renameBranch}
              onNodeNameChange={(nid, newName) => {
                const flow = JSON.parse(JSON.stringify(canvasFlow));
                if (flow.nodes[nid]) { flow.nodes[nid].name = newName; setCanvasFlow(flow); }
              }}
              onOpenDrawer={openDrawer}
              onScaleChange={(delta) => setCanvasScale(s => Math.min(2, Math.max(0.3, s * delta)))}
              onOffsetChange={setCanvasOffset}
              onRouteLineOffsetChange={(nodeId, newOffset) => {
                const flow = JSON.parse(JSON.stringify(canvasFlow));
                if (flow.nodes[nodeId]) {
                  flow.nodes[nodeId].config = { ...flow.nodes[nodeId].config, lineOffset: newOffset };
                  setCanvasFlow(flow);
                  setIsDirty(true);
                }
              }}
            />
          ) : (
            <div className="cw" style={{ top: 0 }}>
              <div className="cbg" />
              <div className="nrp" id="nrp">
                <div className="nri">📋</div>
                <p>请在左侧选择或新建规则</p>
              </div>
            </div>
          )}

          {/* Lock overlay for non-editing mode */}
          {!isDirty && currentRule && !previewMode && (
            <div className="lko" id="lko" style={{ top: "var(--rule-header-h)" }}>
              <div className="lkc">
                <span className="lci">🔒</span>
                <p>点击按钮开始编辑规则流程</p>
                <button className="btn primary" id="btn-draw-rule-lock" style={{whiteSpace:"nowrap",height:"28px",padding:"0 12px",fontSize:"12px"}}
                  onClick={() => { if (currentRule) { if (currentRule.enabled) { showToast("规则启用中，停用后可编辑"); return; } setIsDirty(true); stopPreview(); } }}>绘制规则</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===== Drawer - Using ConfigDrawer component ===== */}
      <ConfigDrawer
        open={drawerOpen}
        ctx={drawerCtx}
        flow={canvasFlow as Flow}
        onClose={closeDrawer}
        onChange={(nodeId, updates) => {
          const flow = JSON.parse(JSON.stringify(canvasFlow));
          flow.nodes[nodeId] = { ...flow.nodes[nodeId], ...updates };
          setCanvasFlow(flow);
          setIsDirty(true);
        }}
        onBranchChange={(nodeId, branchId, updates) => {
          const flow = JSON.parse(JSON.stringify(canvasFlow));
          const branch = flow.nodes[nodeId]?.branches?.find((b: any) => b.id === branchId);
          if (branch) {
            Object.assign(branch, updates);
            setCanvasFlow(flow);
            setIsDirty(true);
          }
        }}
        onOpenParamPicker={openParamPicker}
      />

      {/* ===== Param Picker - Using ParamPicker component ===== */}
      <ParamPicker
        open={paramPickerOpen}
        currentParam={pickerCurrentParam}
        onSelect={(param) => {
          if (paramPickerCallback) {
            paramPickerCallback(param.ref);
          }
          closeParamPicker();
        }}
        onClose={closeParamPicker}
      />

      {/* ===== Rule Form Modal ===== */}
      <div className={`mma ${ruleModalOpen ? "show" : ""}`} id="rule-modal-mask">
        <div className="rule-form-modal">
          <h3 id="rft">{editRuleId ? "编辑规则" : "新建规则"}</h3>

          <div className="rff">
            <label>规则名称 <span className="req">*</span></label>
            <input id="rf-name" value={ruleFormName}
              onChange={e => setRuleFormName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitRuleForm(); if (e.key === "Escape") setRuleModalOpen(false); }}
              placeholder="请输入规则名称" maxLength={50} />
          </div>

          <div className="rff">
            <label>规则描述</label>
            <textarea id="rf-desc" value={ruleFormDesc}
              onChange={e => setRuleFormDesc(e.target.value)}
              placeholder="请输入规则描述（可选）" maxLength={200} />
          </div>

          <div className="rff">
            <label>轮询间隔</label>
            <div className="poll-row">
              <input type="number" min={0} max={30} value={ruleFormPoll.d}
                onChange={e => handlePollChange('d', parseInt(e.target.value) || 0)}
                placeholder="天" /> <span className="poll-unit">天</span>
              <input type="number" min={0} max={23} value={ruleFormPoll.h}
                onChange={e => handlePollChange('h', parseInt(e.target.value) || 0)}
                placeholder="时" /> <span className="poll-unit">时</span>
              <input type="number" min={0} max={59} value={ruleFormPoll.m}
                onChange={e => handlePollChange('m', parseInt(e.target.value) || 0)}
                placeholder="分" /> <span className="poll-unit">分</span>
              <input type="number" min={0} max={59} value={ruleFormPoll.s}
                onChange={e => handlePollChange('s', parseInt(e.target.value) || 0)}
                placeholder="秒" /> <span className="poll-unit">秒</span>
            </div>
            <div id="rph" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
              当前：{pollToStr(ruleFormPoll)}（上限30天）<br />
              上一次执行未结束时，等其完成后再计时
            </div>
          </div>

          <div className="rma">
            <button className="btn" id="rf-cancel" onClick={() => setRuleModalOpen(false)}>取消</button>
            <button className="btn primary" id="rf-confirm" onClick={submitRuleForm}>确认</button>
          </div>
        </div>
      </div>

      {/* ===== Log Modal ===== */}
      <div className={`mma ${logModalOpen ? "show" : ""}`} id="log-modal-mask">
        <div className="log-modal">
          <div className="lm-header">
            <span className="lm-title" id="lm-title">全部日志</span>
            <div className="lm-filters">
              <select id="lm-filter-level" value={logFilterLevel}
                onChange={e => { setLogFilterLevel(e.target.value); }}>
                <option value="">全部级别</option>
                <option value="info">信息</option>
                <option value="success">成功</option>
                <option value="error">错误</option>
              </select>
              <select id="lm-filter-rule" value={logFilterRule}
                onChange={e => setLogFilterRule(e.target.value)}>
                <option value="">全部规则</option>
                {allRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input type="datetime-local" id="lm-filter-ts-start" value={logFilterTsStart}
                onChange={e => setLogFilterTsStart(e.target.value)} />
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>至</span>
              <input type="datetime-local" id="lm-filter-ts-end" value={logFilterTsEnd}
                onChange={e => setLogFilterTsEnd(e.target.value)} />
            </div>
            <button className="btn" id="lm-close" onClick={() => setLogModalOpen(false)}>关闭</button>
          </div>
          <div className="lm-body" id="lm-body">
            {filteredLogs.length === 0 ? (
              <div className="log-empty"><div className="le-icon">📭</div><p>暂无日志记录</p></div>
            ) : filteredLogs.map(l => (
              <div key={l.id} className="log-row">
                <span className="log-time">{fmtTime(l.ts)}</span>
                <span className={`log-level ${l.level}`}>
                  {{ info: "信息", success: "成功", error: "错误" }[l.level] || l.level}
                </span>
                <span className="log-rule">{escHtml(l.ruleName)}<br /><span className="log-group">{escHtml(l.groupName)}</span></span>
                <span className="log-msg">{escHtml(l.msg)}</span>
              </div>
            ))}
          </div>
          <div className="lm-footer" id="lm-footer">共 {filteredLogs.length} 条日志</div>
        </div>
      </div>

      {/* ===== Import Result Modal ===== */}
      <div className={`mma ${importResult ? "show" : ""}`} id="import-result-mask">
        <div className="imp-modal">
          <h3>导入结果</h3>
          {importResult?.ok.length ? (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontWeight: 600, color: "var(--green)", marginBottom: "6px" }}>
                ✓ 成功导入 {importResult.ok.length} 条规则（已停用）
              </div>
              {importResult.ok.map(name => (
                <div key={name} style={{ fontSize: "12px", color: "var(--muted)", paddingLeft: "14px" }}>· {escHtml(name)}</div>
              ))}
            </div>
          ) : null}
          {importResult?.drafted.length ? (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontWeight: 600, color: "#b45309", marginBottom: "6px" }}>
                ⚠ 导入 {importResult.drafted.length} 条规则（暂存中，配置不完整）
              </div>
              {importResult.drafted.map(name => (
                <div key={name} style={{ fontSize: "12px", color: "var(--muted)", paddingLeft: "14px" }}>· {escHtml(name)}</div>
              ))}
            </div>
          ) : null}
          {importResult?.skipped.length ? (
            <div style={{ marginBottom: "4px" }}>
              <div style={{ fontWeight: 600, color: "var(--red)", marginBottom: "6px" }}>
                ✕ 跳过 {importResult.skipped.length} 个文件（格式或内容错误）
              </div>
              {importResult.skipped.map(s => (
                <div key={s.name} style={{ fontSize: "12px", color: "var(--muted)", paddingLeft: "14px" }}>
                  · <b>{escHtml(s.name)}</b>：{escHtml(s.reason)}
                </div>
              ))}
            </div>
          ) : null}
          {!importResult?.ok.length && !importResult?.drafted.length && !importResult?.skipped.length ? (
            <div style={{ color: "var(--muted)", fontSize: "13px" }}>未处理任何规则文件。</div>
          ) : null}
          <div className="rma" style={{ marginTop: "20px" }}>
            <button className="btn primary" id="import-result-ok" onClick={() => setImportResult(null)}>确定</button>
          </div>
        </div>
      </div>

      {/* ===== Node Type Menu ===== */}
      {nodeMenuVisible && (
        <div ref={nodeMenuRef} className="nmm" id="nmm"
          style={{
            position: 'fixed',
            left: nodeMenuPos.x,
            top: nodeMenuPos.y,
            zIndex: 250,
          }}
        >
          <div className="nmm-title">选择节点类型</div>
          {NODE_TYPE_KEYS.map(key => {
            const nt = NODE_TYPES[key];
            const inBranch = !!nodeMenuCtx?.ctx;
            // 仅在 mainFlow 的 index=0 处的加号（开始下方的首个加号）允许添加定时器
            const isFirstSlot = !nodeMenuCtx?.ctx && nodeMenuCtx?.index === 0;
            const hasTimerInFlow = canvasFlow.mainFlow.some(id => canvasFlow.nodes[id]?.type === 'timer');
            // 分支内部: 仅可添加 rule/and_branch/or_branch
            // mainFlow 首个加号（mainFlow 为空或仅有 timer）: 所有类型可选
            // mainFlow 非首个加号: timer 不可选（只能一个 timer 且必须在开头）
            const disabled = inBranch
              ? (key === 'timer' || key === 'delay' || key === 'modify' || key === 'route')
              : (key === 'timer' && (!isFirstSlot || hasTimerInFlow));
            return (
              <div key={key}
                className={`nmm-item ${disabled ? 'disabled' : ''}`}
                onClick={() => { if (!disabled) { setNodeMenuVisible(false); selectNodeType(key); } }}
              >
                <div className="nmm-dot" style={{ background: nt.color }} />
                <div className="nmm-label">{nt.label}</div>
                <div className="nmm-desc">{nt.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== Hidden File Input ===== */}
      <input type="file" ref={fileInputRef} id="import-file-input" style={{ display: "none" }}
        accept=".json,.zip" multiple onChange={handleFileImport} />

      {/* ===== Confirm Modal ===== */}
      <div className={`mma ${confirmModalVisible ? "show" : ""}`} onClick={(e) => {
        if (e.target === e.currentTarget) {
          setConfirmModalVisible(false);
          confirmModalContent?.onCancel?.();
        }
      }}>
        {confirmModalContent && (
          <div className="modal" style={{ maxWidth: 520 }}>
            <h3>{confirmModalContent.title}</h3>
            {typeof confirmModalContent.body === "string"
              ? <p>{confirmModalContent.body}</p>
              : <div style={{ marginBottom: 18, lineHeight: 1.6, fontSize: 13, color: "#5a6378" }}>{confirmModalContent.body}</div>}
            <div className="actions">
              <button className="btn" onClick={() => {
                setConfirmModalVisible(false);
                confirmModalContent?.onCancel?.();
              }}>{confirmModalContent.cancelText || "取消"}</button>
              <button className={`btn ${confirmModalContent.danger ? "danger" : "primary"}`} onClick={() => {
                setConfirmModalVisible(false);
                confirmModalContent.onConfirm();
              }}>{confirmModalContent.confirmText || "确认"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================
// ============================
//   Node Config Component
// ============================
// ============================
function NodeConfig({ node, flow, onChange, onOpenParamPicker }: {
  node: any; flow: Flow; onChange: (n: any) => void; onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}) {
  const cfg = node.config || {};

  function updateCfg(updates: Record<string, any>) {
    onChange({ ...node, config: { ...cfg, ...updates } });
  }

  if (node.type === "rule") {
    return (
      <ConditionBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
        onOpenParamPicker={onOpenParamPicker}
      />
    );
  }

  if (node.type === "timer") {
    return (
      <TimerBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
      />
    );
  }

  if (node.type === "delay") {
    return (
      <DelayBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
      />
    );
  }

  if (node.type === "modify") {
    return (
      <ModifyBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
        onOpenParamPicker={onOpenParamPicker}
      />
    );
  }

  if (node.type === "route") {
    return (
      <div>
        <ConditionBuilder
          config={cfg}
          onChange={(c) => onChange({ ...node, config: c })}
          onOpenParamPicker={onOpenParamPicker}
        />
        <div className="field" style={{ marginTop: "14px" }}>
          <label>目标节点<span className="req">*</span></label>
          <select value={cfg.targetId || ""}
            onChange={(e) => updateCfg({ targetId: e.target.value })}>
            <option value="">请选择目标节点</option>
            {flow.mainFlow.map(nid => {
              const n = flow.nodes[nid];
              if (!n || nid === node.id) return null;
              const isLegal = n.type !== "route" && nid !== node.id;
              return <option key={nid} value={nid} disabled={!isLegal}>{n.name}{!isLegal ? " （不可选）" : ""}</option>;
            })}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="warn">该节点类型暂不支持配置。</div>
  );
}

// ============================
// ============================
//   Condition Builder
// ============================
// ============================
function ConditionBuilder({ config, onChange, onOpenParamPicker }: {
  config: any; onChange: (c: any) => void; onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}) {
  const condMode = config.condMode || "param";

  return (
    <div>
      {/* Mode Tabs */}
      <div className="ctb">
        <div className={`ctv ${condMode === "param" ? "active" : ""}`}
          onClick={() => onChange({ ...config, condMode: "param" })}>自选参数</div>
        <div className={`ctv ${condMode === "script" ? "active" : ""}`}
          onClick={() => onChange({ ...config, condMode: "script" })}>脚本配置</div>
      </div>

      {condMode === "param" ? (
        <>
          {/* Param Name */}
          <div className="field">
            <label>参数名<span className="req">*</span></label>
            <button type="button" className="psb"
              onClick={() => onOpenParamPicker(config.param, (name) => onChange({ ...config, param: name }))}>
              <span className="psv" style={config.param ? {} : { color: "#b0b7c8" }}>
                {config.param || "选择参数"}
              </span>
              <span className="psa">▼</span>
            </button>
          </div>

          {/* Operator */}
          <div className="field">
            <label>运算符<span className="req">*</span></label>
            <select value={config.op || ""}
              onChange={e => onChange({ ...config, op: e.target.value })}>
              <option value="">请选择</option>
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>

          {/* Threshold / Range */}
          {config.op === "范围内" ? (
            <div className="field">
              <label>取值范围<span className="req">*</span><span className="hint" style={{ display: "inline" }}>闭区间</span></label>
              <div className="bdr">
                <input type="number" placeholder="最小值" value={config.min || ""}
                  onChange={e => onChange({ ...config, min: e.target.value })} />
                <input type="number" placeholder="最大值" value={config.max || ""}
                  onChange={e => onChange({ ...config, max: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="field">
              <label>阈值<span className="req">*</span></label>
              <input type="text" placeholder="阈值" value={config.threshold || ""}
                onChange={e => onChange({ ...config, threshold: e.target.value })} />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="script-rules">
            <div className="sr-title">📋 脚本编写规则</div>
            <div className="sr-section">
              <div className="sr-label">写法 1：<code>return</code> + Python 逻辑表达式</div>
              <div className="sr-hint">规则前需加 <code>return </code>（return + 一个空格）</div>
              <pre className="sr-code">{`return 1 if <%PriChWTempSupply01%> > 12 else 0`}</pre>
            </div>
            <div className="sr-section">
              <div className="sr-label">写法 2：多行 Python if 判断语句</div>
              <pre className="sr-code">{`if <%PriChWTempSupply01%> > 12:\n    return True\nelse:\n    return False`}</pre>
            </div>
            <div className="sr-hint" style={{ marginTop: "6px" }}>
              参数引用格式：<code>{`<%参数名%>`}</code>　　返回 <code>1</code>/<code>True</code> 表示条件成立，<code>0</code>/<code>False</code> 表示不成立
            </div>
          </div>
          <div className="field">
            <label>脚本内容<span className="req">*</span></label>
            <textarea placeholder={`示例：\nreturn 1 if <%参数名%> > 12 else 0`}
              value={config.script || ""}
              onChange={e => onChange({ ...config, script: e.target.value })}
              style={{ height: "130px", fontFamily: "'Courier New', monospace", fontSize: "12px", lineHeight: "1.6" }} />
          </div>
        </>
      )}
    </div>
  );
}

// ============================
// ============================
//   Timer Builder
// ============================
// ============================
function TimerBuilder({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const kind = config.kind || "";
  const groups = config.groups || [];

  function addGroup() {
    const newGroup = createEmptyGroup(kind);
    onChange({ ...config, groups: [...groups, newGroup] });
  }

  function removeGroup(idx: number) {
    onChange({ ...config, groups: groups.filter((_: any, i: number) => i !== idx) });
  }

  function updateGroup(idx: number, updates: any) {
    onChange({ ...config, groups: groups.map((g: any, i: number) => i === idx ? { ...g, ...updates } : g) });
  }

  return (
    <div>
      <div className="field">
        <label>触发类型<span className="req">*</span></label>
        <select value={kind}
          onChange={e => onChange({ kind: e.target.value, groups: [createEmptyGroup(e.target.value)] })}>
          <option value="">请选择</option>
          <option value="specific">指定时间范围</option>
          <option value="daily">每天</option>
          <option value="weekly">每周几</option>
          <option value="monthly">每月第N天</option>
          <option value="yearly">每年第N天</option>
        </select>
      </div>

      {kind && groups.map((group: any, idx: number) => (
        <div key={idx} className="tgc">
          <div className="tgi">时段 {idx + 1}</div>
          {groups.length > 1 && (
            <div className="tgd" onClick={() => removeGroup(idx)}>×</div>
          )}
          <TimerGroupFields kind={kind} group={group} onChange={(u) => updateGroup(idx, u)} />
        </div>
      ))}

      {kind && (
        <button type="button" className="agb" onClick={addGroup}>＋ 添加时段</button>
      )}
    </div>
  );
}

function createEmptyGroup(kind: string): any {
  if (kind === "specific") return { dateRange: { start: "", end: "" } };
  if (kind === "daily") return { timeRange: { start: "", end: "" } };
  if (kind === "weekly") return { days: [], timeRange: { start: "", end: "" } };
  if (kind === "monthly") return { dayRange: { start: "", end: "" }, timeRange: { start: "", end: "" } };
  if (kind === "yearly") return { dateRange: { startMonth: "", startDay: "", endMonth: "", endDay: "" }, timeRange: { start: "", end: "" } };
  return {};
}

function TimerGroupFields({ kind, group, onChange }: { kind: string; group: any; onChange: (u: any) => void }) {
  if (kind === "specific") return (
    <div className="field">
      <label>时间范围<span className="req">*</span></label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input type="datetime-local" placeholder="开始" value={group.dateRange?.start || ""}
          onChange={e => onChange({ dateRange: { ...group.dateRange, start: e.target.value } })} />
        <input type="datetime-local" placeholder="结束" value={group.dateRange?.end || ""}
          onChange={e => onChange({ dateRange: { ...group.dateRange, end: e.target.value } })} />
      </div>
    </div>
  );

  if (kind === "daily") return (
    <div className="field">
      <label>时间范围<span className="req">*</span></label>
      <div className="row2">
        <input type="time" step="1" placeholder="开始" value={group.timeRange?.start || ""}
          onChange={e => onChange({ timeRange: { ...group.timeRange, start: e.target.value } })} />
        <input type="time" step="1" placeholder="结束" value={group.timeRange?.end || ""}
          onChange={e => onChange({ timeRange: { ...group.timeRange, end: e.target.value } })} />
      </div>
    </div>
  );

  if (kind === "weekly") return (
    <>
      <div className="field">
        <label>选择星期<span className="req">*</span></label>
        <div className="wdr">
          {["一二三四五六日"].map((_, dayIdx) => {
            const d = dayIdx + 1;
            const active = (group.days || []).includes(d);
            return (
              <button key={d} type="button" className={`dbt ${active ? "active" : ""}`}
                onClick={() => {
                  const days = active ? group.days.filter((x: number) => x !== d) : [...(group.days || []), d].sort();
                  onChange({ days });
                }}>
                {"一二三四五六日"[dayIdx]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field">
        <label>时间范围<span className="req">*</span></label>
        <div className="row2">
          <input type="time" step="1" placeholder="开始" value={group.timeRange?.start || ""}
            onChange={e => onChange({ timeRange: { ...group.timeRange, start: e.target.value } })} />
          <input type="time" step="1" placeholder="结束" value={group.timeRange?.end || ""}
            onChange={e => onChange({ timeRange: { ...group.timeRange, end: e.target.value } })} />
        </div>
      </div>
    </>
  );

  if (kind === "monthly") return (
    <>
      <div className="field">
        <label>日期范围<span className="req">*</span><span className="hint" style={{ display: "inline" }}>1~31</span></label>
        <div className="row2">
          <input type="number" min={1} max={31} placeholder="起始日" value={group.dayRange?.start || ""}
            onChange={e => onChange({ dayRange: { ...group.dayRange, start: e.target.value } })} />
          <input type="number" min={1} max={31} placeholder="结束日" value={group.dayRange?.end || ""}
            onChange={e => onChange({ dayRange: { ...group.dayRange, end: e.target.value } })} />
        </div>
      </div>
      <div className="field">
        <label>时间范围<span className="req">*</span></label>
        <div className="row2">
          <input type="time" step="1" placeholder="开始" value={group.timeRange?.start || ""}
            onChange={e => onChange({ timeRange: { ...group.timeRange, start: e.target.value } })} />
          <input type="time" step="1" placeholder="结束" value={group.timeRange?.end || ""}
            onChange={e => onChange({ timeRange: { ...group.timeRange, end: e.target.value } })} />
        </div>
      </div>
    </>
  );

  if (kind === "yearly") {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return (
      <>
        <div className="field">
          <label>日期范围<span className="req">*</span></label>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <select style={{ flex: 1, height: "32px", border: "1px solid var(--line)", borderRadius: "5px", padding: "0 6px", fontSize: "12px" }}
                value={group.dateRange?.startMonth || ""}
                onChange={e => onChange({ dateRange: { ...group.dateRange, startMonth: e.target.value } })}>
                <option value="">月</option>
                {months.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
              <input type="number" min={1} max={31} placeholder="日" style={{ width: "60px", height: "32px", border: "1px solid var(--line)", borderRadius: "5px", padding: "0 6px", fontSize: "12px" }}
                value={group.dateRange?.startDay || ""}
                onChange={e => onChange({ dateRange: { ...group.dateRange, startDay: e.target.value } })} />
              <span style={{ color: "var(--muted)", fontSize: "12px", flexShrink: 0 }}>至</span>
              <select style={{ flex: 1, height: "32px", border: "1px solid var(--line)", borderRadius: "5px", padding: "0 6px", fontSize: "12px" }}
                value={group.dateRange?.endMonth || ""}
                onChange={e => onChange({ dateRange: { ...group.dateRange, endMonth: e.target.value } })}>
                <option value="">月</option>
                {months.map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
              <input type="number" min={1} max={31} placeholder="日" style={{ width: "60px", height: "32px", border: "1px solid var(--line)", borderRadius: "5px", padding: "0 6px", fontSize: "12px" }}
                value={group.dateRange?.endDay || ""}
                onChange={e => onChange({ dateRange: { ...group.dateRange, endDay: e.target.value } })} />
            </div>
          </div>
        </div>
        <div className="field">
          <label>时间范围<span className="req">*</span></label>
          <div className="row2">
            <input type="time" step="1" placeholder="开始" value={group.timeRange?.start || ""}
              onChange={e => onChange({ timeRange: { ...group.timeRange, start: e.target.value } })} />
            <input type="time" step="1" placeholder="结束" value={group.timeRange?.end || ""}
              onChange={e => onChange({ timeRange: { ...group.timeRange, end: e.target.value } })} />
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ============================
// ============================
//   Delay Builder
// ============================
// ============================
function DelayBuilder({ config, onChange }: { config: any; onChange: (c: any) => void }) {
  const value = config.value || "";
  const unit = config.unit || "秒";
  const numVal = parseInt(value);
  const totalSecs = unit === "秒" ? numVal : (numVal || 0) * 60;
  const isInvalid = numVal && numVal > 0 && totalSecs > 900;

  let hint = "";
  if (numVal && numVal > 0) {
    hint = isInvalid
      ? (unit === "秒" ? "最多 900 秒" : "最多 15 分钟")
      : `延时 ${totalSecs} 秒后进入下一节点`;
  }

  return (
    <div>
      <div className="field">
        <label>延时时间<span className="req">*</span></label>
        <div className="row2">
          <input type="number" min={1} placeholder="数值" style={{ flex: 1 }}
            value={value} onChange={e => onChange({ ...config, value: e.target.value })} />
          <select style={{ width: "90px" }}
            value={unit}
            onChange={e => onChange({ ...config, unit: e.target.value })}>
            <option value="秒">秒</option>
            <option value="分钟">分钟</option>
          </select>
        </div>
        <div className="hint" style={{ color: isInvalid ? "var(--red)" : "var(--muted)" }}>{hint}</div>
      </div>
    </div>
  );
}

// ============================
// ============================
//   Modify Builder
// ============================
// ============================
function ModifyBuilder({ config, onChange, onOpenParamPicker }: {
  config: any; onChange: (c: any) => void; onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}) {
  return (
    <div>
      <div className="field">
        <label>参数名<span className="req">*</span></label>
        <button type="button" className="psb"
          onClick={() => onOpenParamPicker(config.param, (name) => onChange({ ...config, param: name }))}>
          <span className="psv" style={config.param ? {} : { color: "#b0b7c8" }}>
            {config.param || "选择参数"}
          </span>
          <span className="psa">▼</span>
        </button>
      </div>
      <div style={{ fontSize: "11px", color: "var(--muted)", margin: "-6px 0 12px", lineHeight: "1.5" }}>
        固定值或表达式
      </div>
      <div className="field">
        <label>目标值<span className="req">*</span></label>
        <input type="text" placeholder="固定值或表达式"
          value={config.value || ""}
          onChange={e => onChange({ ...config, value: e.target.value })} />
        <div className="hint">表达式以 = 开头，引用参数：<code>{`<%参数名%>`}</code>，支持 +-*/</div>
      </div>
      <div className="field">
        <label>上下限 <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "11px" }}>（选填，不填则无限制）</span></label>
        <div className="bdr">
          <input type="number" placeholder="下限" value={config.limitMin || ""}
            onChange={e => onChange({ ...config, limitMin: e.target.value })} />
          <input type="number" placeholder="上限" value={config.limitMax || ""}
            onChange={e => onChange({ ...config, limitMax: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
