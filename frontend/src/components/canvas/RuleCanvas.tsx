/**
 * RuleCanvas.tsx — 自定义 DOM 画布
 * 
 * 完全对齐原型 / 设计/rule-engine/index.html 的画布架构
 * 使用直接 DOM 操纵代替 React 虚拟 DOM 渲染
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ============ Types ============
export interface Flow {
  nodes: Record<string, FlowNode>;
  mainFlow: string[];
}

export interface FlowNode {
  id: string;
  type: 'rule' | 'and_branch' | 'or_branch' | 'timer' | 'delay' | 'modify' | 'route';
  name: string;
  config: NodeConfig;
  branches?: Branch[];
}

export interface Branch {
  id: string;
  name: string;
  config: BranchConfig;
  nested: string[];
}

export interface NodeConfig {
  condMode?: 'param' | 'script';
  param?: string;
  op?: string;
  threshold?: string;
  min?: string;
  max?: string;
  script?: string;
  targetId?: string;
  kind?: string;
  groups?: TimerGroup[];
  value?: string;
  unit?: string;
  limitMin?: string;
  limitMax?: string;
}

export interface TimerGroup {
  timeRange?: { start: string; end: string };
  dateRange?: { start: string; end: string; startMonth?: string; startDay?: string; endMonth?: string; endDay?: string };
  days?: number[];
  dayRange?: { start: string; end: string };
}

export interface BranchConfig {
  condMode?: 'param' | 'script';
  param?: string;
  op?: string;
  threshold?: string;
  min?: string;
  max?: string;
  script?: string;
}

// ============ Node Type Config ============
export const NODE_TYPES: Record<string, { label: string; color: string; desc: string }> = {
  rule: { label: "规则判断", color: "#e8631c", desc: "单条件判断" },
  and_branch: { label: "AND判断分支", color: "#ff8a3d", desc: "全部满足才通过" },
  or_branch: { label: "OR判断分支", color: "#22b573", desc: "任意满足即通过" },
  timer: { label: "定时条件", color: "#8b5cf6", desc: "指定时间触发" },
  delay: { label: "延时器", color: "#0ea5e9", desc: "延时后进入下一节点" },
  modify: { label: "修改点值", color: "#52c41a", desc: "赋值/表达式" },
  route: { label: "动态路由", color: "#1f5fb8", desc: "条件跳转" },
};

export const OPERATORS = [">", "<", "=", "≠", "≥", "≤", "范围内"];

// ============ Helpers ============
function uid(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function escHtml(s: string): string {
  return ((s || "") + "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

// ============ Canvas Props ============
export interface RuleCanvasProps {
  flow: Flow;
  isDirty: boolean;
  scale: number;
  offset: { x: number; y: number };
  nodeStatuses?: Record<string, string>;
  branchStatuses?: Record<string, string>;
  scrollToNodeId?: string | null;
  onAddNode: (index: number, ctx: { parentNodeId: string; branchId: string } | null) => void;
  onDeleteNode: (nodeId: string, ctx: { parentNodeId: string; branchId: string } | null) => void;
  onDeleteBranch: (nodeId: string, branchId: string, ctx: { parentNodeId: string; branchId: string } | null) => void;
  onAddBranch: (nodeId: string) => void;
  onOpenDrawer: (nodeId: string, branchId?: string) => void;
  onScaleChange: (delta: number) => void;
  onOffsetChange: (offset: { x: number; y: number }) => void;
  onNodeNameChange?: (nodeId: string, newName: string) => void;
}

// ============ Main Component ============
export default function RuleCanvas({
  flow,
  isDirty,
  scale,
  offset,
  nodeStatuses = {},
  branchStatuses = {},
  scrollToNodeId,
  onAddNode,
  onDeleteNode,
  onDeleteBranch,
  onAddBranch,
  onOpenDrawer,
  onScaleChange,
  onOffsetChange,
  onNodeNameChange,
}: RuleCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ============ Rendering ============
  const renderCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.innerHTML = '';

    const flowEl = document.createElement('div');
    flowEl.className = 'flow';

    // Start terminal
    flowEl.appendChild(createStartTerminal());
    
    // Main flow nodes
    renderMainFlow(flowEl, flow);

    // End terminal
    flowEl.appendChild(createEndTerminal());

    canvas.appendChild(flowEl);
  }, [flow, isDirty, nodeStatuses, branchStatuses]);

  // Re-render when data changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle scroll to node request
  useEffect(() => {
    if (scrollToNodeId && canvasRef.current) {
      const el = canvasRef.current.querySelector(`[data-node-id="${scrollToNodeId}"]`);
      if (el) {
        el.classList.add('scf');
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setTimeout(() => el.classList.remove('scf'), 1500);
      }
    }
  }, [scrollToNodeId]);

  // ============ Terminals ============
  function createStartTerminal() {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center';

    const term = document.createElement('div');
    term.className = 'term start';
    term.textContent = '开始';
    container.appendChild(term);

    if (isDirty && flow.mainFlow.length > 0) {
      container.appendChild(createConnector(0, null));
    }
    if (isDirty && flow.mainFlow.length === 0) {
      container.appendChild(createConnector(0, null));
    }

    return container;
  }

  function createEndTerminal() {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center';

    const term = document.createElement('div');
    term.className = 'term end';
    term.textContent = '结束';
    container.appendChild(term);

    return container;
  }

  // ============ Connector (+ button) ============
  function createConnector(index: number, ctx: { parentNodeId: string; branchId: string } | null): HTMLElement {
    const conn = document.createElement('div');
    conn.className = 'conn';

    const line1 = document.createElement('div');
    line1.className = 'line';
    line1.style.cssText = 'width:2px;min-height:22px;background:#c8cfdc;flex:1';
    conn.appendChild(line1);

    const plus = document.createElement('div');
    plus.className = 'plus';
    plus.textContent = '+';
    plus.style.transform = `scale(${1 / scale})`;
    plus.addEventListener('click', (e) => {
      e.stopPropagation();
      onAddNode(index, ctx);
    });
    conn.appendChild(plus);

    const line2 = document.createElement('div');
    line2.className = 'line';
    line2.style.cssText = 'width:2px;min-height:22px;background:#c8cfdc;flex:1';
    conn.appendChild(line2);

    const arrow = document.createElement('div');
    arrow.className = 'arrow-down';
    conn.appendChild(arrow);

    return conn;
  }

  // ============ Main Flow ============
  function renderMainFlow(container: HTMLElement, flow: Flow) {
    flow.mainFlow.forEach((nodeId, idx) => {
      const node = flow.nodes[nodeId];
      if (!node) return;

      const nodeContainer = document.createElement('div');
      nodeContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center';

      if (node.type === 'and_branch' || node.type === 'or_branch') {
        nodeContainer.appendChild(createBranchNode(node));
      } else {
        nodeContainer.appendChild(createNormalNode(node, null));
      }

      if (isDirty) {
        nodeContainer.appendChild(createConnector(idx + 1, null));
      }

      container.appendChild(nodeContainer);
    });

    // Empty main flow
    if (flow.mainFlow.length === 0 && isDirty) {
      const emptyContainer = document.createElement('div');
      emptyContainer.style.cssText = 'display:flex;flex-direction:column;align-items:center';
      emptyContainer.appendChild(createConnector(0, null));
      container.appendChild(emptyContainer);
    }
  }

  // ============ Normal Node ============
  function createNormalNode(node: FlowNode, ctx: { parentNodeId: string; branchId: string } | null): HTMLElement {
    const el = document.createElement('div');
    el.className = `node t-${node.type}`;
    el.dataset.nodeId = node.id;

    // Status class
    const status = nodeStatuses[node.id];
    if (status) el.classList.add(`rs-${status}`);

    // Color bar
    const tbs = document.createElement('div');
    tbs.className = 'tbs';
    tbs.style.background = NODE_TYPES[node.type]?.color || '#c8cfdc';
    el.appendChild(tbs);

    // Header
    const head = document.createElement('div');
    head.className = 'head';

    const typeDiv = document.createElement('div');
    const typename = document.createElement('div');
    typename.className = 'typename';
    typename.textContent = NODE_TYPES[node.type]?.label || node.type;
    typeDiv.appendChild(typename);
    head.appendChild(typeDiv);

    const title = document.createElement('div');
    title.className = 'title';
    title.dataset.name = '';
    title.textContent = node.name;
    title.addEventListener('click', (e) => e.stopPropagation());
    title.addEventListener('mousedown', (e) => e.stopPropagation());
    head.appendChild(title);

    if (isDirty) {
      const del = document.createElement('div');
      del.className = 'del';
      del.textContent = '×';
      del.title = '删除';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteNode(node.id, ctx);
      });
      head.appendChild(del);
    }

    el.appendChild(head);

    // Body
    const body = document.createElement('div');
    body.className = 'body';

    if (isNodeComplete(node)) {
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = getNodeSummary(node);
      summary.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      body.appendChild(summary);
      el.dataset.fullSummary = getNodeSummary(node);
    } else {
      body.innerHTML = '<div class="unconfigured">请完善节点配置</div>';
    }

    el.appendChild(body);

    // Click handler
    el.addEventListener('click', () => {
      if (isDirty) {
        onOpenDrawer(node.id);
      }
    });

    return el;
  }

  // ============ Branch Node ============
  function createBranchNode(node: FlowNode): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center';

    const bx = document.createElement('div');
    bx.className = `bx t-${node.type}`;
    bx.dataset.nodeId = node.id;

    // Header
    const bh2 = document.createElement('div');
    bh2.className = 'bh2';

    const ptag = document.createElement('span');
    ptag.className = 'ptag';
    ptag.textContent = node.type === 'and_branch' ? 'AND' : 'OR';
    bh2.appendChild(ptag);

    const pname = document.createElement('span');
    pname.className = 'pname';
    pname.dataset.pname = '';
    pname.textContent = node.name;
    pname.addEventListener('click', (e) => e.stopPropagation());
    pname.addEventListener('mousedown', (e) => e.stopPropagation());
    bh2.appendChild(pname);

    const bhs = document.createElement('div');
    bhs.className = 'bhs';
    bh2.appendChild(bhs);

    if (isDirty) {
      const addBtn = document.createElement('button');
      addBtn.className = 'bhb';
      addBtn.textContent = '+ 添加分支';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAddBranch(node.id);
      });
      bh2.appendChild(addBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'bhb danger';
      delBtn.textContent = '删除节点';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteNode(node.id, null);
      });
      bh2.appendChild(delBtn);
    }

    bx.appendChild(bh2);

    // Branches
    const bsr = document.createElement('div');
    bsr.className = 'bsr';

    node.branches?.forEach((branch) => {
      const bcl = document.createElement('div');
      bcl.className = 'bcl';

      // Connector spacer top
      const csbTop = document.createElement('div');
      csbTop.className = 'csb';
      bcl.appendChild(csbTop);

      // Branch card
      const bcd = createBranchCard(node, branch);
      bcl.appendChild(bcd);

      // Nested nodes
      branch.nested.forEach((nestedId, nIdx) => {
        const nestedNode = flow.nodes[nestedId];
        if (!nestedNode) return;

        const cst = document.createElement('div');
        cst.className = 'cst';
        bcl.appendChild(cst);

        const nestedCtx = { parentNodeId: node.id, branchId: branch.id };
        bcl.appendChild(createConnector(nIdx + 1, nestedCtx));
        bcl.appendChild(createNormalNode(nestedNode, nestedCtx));
      });

      // Connector spacer bottom
      const csp = document.createElement('div');
      csp.className = 'csp';
      bcl.appendChild(csp);

      // Empty nested connector
      if (isDirty && branch.nested.length === 0) {
        bcl.appendChild(createConnector(0, { parentNodeId: node.id, branchId: branch.id }));
      }

      // Add connector at end of nested
      if (isDirty) {
        bcl.appendChild(createConnector(branch.nested.length, { parentNodeId: node.id, branchId: branch.id }));
      }

      const csbBottom = document.createElement('div');
      csbBottom.className = 'csb';
      bcl.appendChild(csbBottom);

      bsr.appendChild(bcl);
    });

    bx.appendChild(bsr);
    container.appendChild(bx);

    return container;
  }

  // ============ Branch Card ============
  function createBranchCard(node: FlowNode, branch: Branch): HTMLElement {
    const el = document.createElement('div');
    el.className = 'bcd';
    el.dataset.branchId = branch.id;
    el.dataset.parentNodeId = node.id;

    // Status class
    const status = branchStatuses[branch.id];
    if (status) el.classList.add(`rs-${status}`);

    const stripe = document.createElement('div');
    stripe.className = 'bc-stripe';
    stripe.style.background = NODE_TYPES[node.type]?.color || '#c8cfdc';
    el.appendChild(stripe);

    const bch = document.createElement('div');
    bch.className = 'bch';

    const bct = document.createElement('span');
    bct.className = 'bct';
    bct.textContent = node.type === 'and_branch' ? 'AND 判断分支' : 'OR 判断分支';
    bch.appendChild(bct);

    const bcn = document.createElement('span');
    bcn.className = 'bcn';
    bcn.dataset.bname = '';
    bcn.textContent = branch.name;
    bcn.addEventListener('click', (e) => e.stopPropagation());
    bcn.addEventListener('mousedown', (e) => e.stopPropagation());
    bch.appendChild(bcn);

    if (isDirty) {
      const bce = document.createElement('div');
      bce.className = 'bce';
      bce.textContent = '×';
      bce.addEventListener('click', (e) => {
        e.stopPropagation();
        onDeleteBranch(node.id, branch.id, { parentNodeId: node.id, branchId: branch.id });
      });
      bch.appendChild(bce);
    }

    el.appendChild(bch);

    const bcb = document.createElement('div');
    bcb.className = 'bcb';

    if (isBranchComplete(branch)) {
      const summary = document.createElement('div');
      summary.className = 'summary';
      summary.textContent = getBranchSummary(branch);
      summary.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      bcb.appendChild(summary);
      el.dataset.fullSummary = getBranchSummary(branch);
    } else {
      bcb.innerHTML = '<div class="unconfigured">请正确设置分支条件</div>';
    }

    el.appendChild(bcb);

    // Click handler
    el.addEventListener('click', () => {
      if (isDirty) {
        onOpenDrawer(node.id, branch.id);
      }
    });

    return el;
  }

  // ============ Completeness Check ============
  function isNodeComplete(node: FlowNode): boolean {
    const cfg = node.config || {};

    if (node.type === 'rule') return isCondComplete(cfg);
    if (node.type === 'route') return isCondComplete(cfg) && !!cfg.targetId;
    if (node.type === 'timer') return !!cfg.kind && !!(cfg.groups?.length);
    if (node.type === 'modify') return !!(cfg.param && cfg.value !== undefined && cfg.value !== '');
    if (node.type === 'delay') {
      const v = parseInt(cfg.value || '');
      return !!(v && v > 0 && cfg.unit);
    }
    return true;
  }

  function isCondComplete(cfg: NodeConfig): boolean {
    if (!cfg) return false;
    if (cfg.condMode === 'script') return !!(cfg.script || '').trim();
    if (!cfg.param || !cfg.op) return false;
    if (cfg.op === '范围内') return cfg.min !== '' && cfg.max !== '' && parseFloat(cfg.min || '') < parseFloat(cfg.max || '');
    return cfg.threshold !== '';
  }

  function isBranchComplete(branch: Branch): boolean {
    if (!isCondComplete(branch.config)) return false;
    return branch.nested.every((nid) => {
      const n = flow.nodes[nid];
      if (!n) return false;
      if (n.type === 'and_branch' || n.type === 'or_branch') {
        return n.branches?.every((b) => isBranchComplete(b)) ?? false;
      }
      return isNodeComplete(n);
    });
  }

  // ============ Summaries ============
  function getNodeSummary(node: FlowNode): string {
    const cfg = node.config || {};
    const t = node.type as string;

    if (t === 'rule') {
      if (cfg.condMode === 'script') return '脚本：' + (cfg.script || '').slice(0, 20);
      if (cfg.op === '范围内') return `${cfg.param || ''} ${cfg.op || ''} [${cfg.min || ''},${cfg.max || ''}]`;
      return `${cfg.param || ''} ${cfg.op || ''} ${cfg.threshold || ''}`;
    }
    if (t === 'timer') {
      if (!cfg.kind || !cfg.groups?.length) return '';
      const g = cfg.groups[0];
      if (cfg.kind === 'specific') return '指定时间';
      if (cfg.kind === 'daily') return `每天 ${g.timeRange?.start || ''}~${g.timeRange?.end || ''}`;
      if (cfg.kind === 'weekly') return `每周${(g.days || []).map((d: number) => '一二三四五六日'[d - 1]).join('')}`;
      if (cfg.kind === 'monthly') return `每月${g.dayRange?.start || ''}~${g.dayRange?.end || ''}日`;
      if (cfg.kind === 'yearly') return `每年${g.dateRange?.startMonth || ''}月${g.dateRange?.startDay || ''}日`;
      return '';
    }
    if (t === 'delay') return `延时 ${cfg.value || 0} ${cfg.unit || '秒'}后继续`;
    if (t === 'modify') return `${cfg.param || ''} = ${cfg.value || ''}`;
    if (t === 'route') {
      const tgt = flow.nodes[cfg.targetId || '']?.name || '?';
      const ruleSummary = (() => {
        if (cfg.condMode === 'script') return '脚本：' + ((cfg as any).script || '').slice(0, 20);
        if ((cfg as any).op === '范围内') return `${(cfg as any).param || ''} ${(cfg as any).op || ''} [${(cfg as any).min || ''},${(cfg as any).max || ''}]`;
        return `${(cfg as any).param || ''} ${(cfg as any).op || ''} ${(cfg as any).threshold || ''}`;
      })();
      return `${ruleSummary} → ${tgt}`;
    }
    if (t === 'and_branch' || t === 'or_branch') return (node.branches?.length || 0) + ' 条子分支';
    return '';
  }

  function getBranchSummary(branch: Branch): string {
    const cfg = branch.config || {};
    if (cfg.condMode === 'script') return '脚本：' + (cfg.script || '').slice(0, 20);
    if (cfg.op === '范围内') return `${cfg.param || ''} ${cfg.op || ''} [${cfg.min || ''},${cfg.max || ''}]`;
    return `${cfg.param || ''} ${cfg.op || ''} ${cfg.threshold || ''}`;
  }

  // ============ Pan/Zoom Handlers ============
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    onScaleChange(delta);
  }

  function handleMouseDown(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.node') || target.closest('.bcd') || target.closest('.plus') || target.closest('.bh2')) return;

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOffsetRef.current = { ...offset };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    onOffsetChange({ x: dragOffsetRef.current.x + dx, y: dragOffsetRef.current.y + dy });
  }

  function handleMouseUp() {
    isDraggingRef.current = false;
  }

  // ============ Render ============
  return (
    <div
      ref={containerRef}
      className={`cw ${isDirty ? 'editing' : 'locked'}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="cbg" />

      <div
        ref={canvasRef}
        className="canvas"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
      />
    </div>
  );
}
