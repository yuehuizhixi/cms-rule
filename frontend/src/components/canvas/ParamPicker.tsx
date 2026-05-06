/**
 * ParamPicker — 参数选择器
 *
 * Tab 1「参数列表」— 模型/对象/参数三字段搜索 + 分页表格
 * Tab 2「结构树」  — 模型/类型/视角筛选 → 位置树 → 绑定参数
 *
 * 数据：10.74.170.221 真实微服务
 * 选中：<%对象名称/参数名称%>
 */
import React, { useState, useEffect, useRef } from 'react';

// ── Types ──
interface ParamRow {
  key: string;
  deviceMark: string;
  deviceName: string;
  modelMark: string;
  modelName: string;
  paramMark: string;
  paramName: string;
}
interface LocNode {
  id: string; locationName: string; parentId: string; topParentId: string;
  children?: LocNode[]; [k: string]: any;
}
interface EnergyType { energyCode: string; energyName: string }
export interface SelectedParam {
  ref: string; deviceName: string; deviceMark: string; paramName: string; paramMark: string;
}
export interface ParamPickerProps {
  open: boolean;
  currentParam: string | undefined;   // 回显值 "<%xxx/yyy%>"
  onSelect: (p: SelectedParam) => void;
  onClose: () => void;
}

// ── 认证 ──
const AUTH = localStorage.getItem('cms_rule_auth_token') || 'Bearer ccb8ce22-250f-46af-9703-d4470375610c';
const BASE = '/api/rule-engine/proxy';

async function post(path: string, body: any, ms = 15000): Promise<any> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(BASE + path, { method: 'POST', headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
function exData(r: any): any {
  if (!r) return null;
  if (r.data && typeof r.code === 'number') return r.data;
  return r.data || r;
}
function ref(item: { deviceName?: string; paramName: string }) { return `<%${item.deviceName || ''}/${item.paramName}%>`; }

// ── 硬编码模型类型 ──
const MODEL_TYPES = [
  { label: '能流模型', value: 'energy' },
  { label: '排放模型', value: 'carbon_base' },
  { label: '对象树',   value: 'object' },
];
const PERSPECTIVES = [
  { label: '默认', value: 'default' },
  { label: '精简', value: 'simple' },
];

// ── Component ──
export default function ParamPicker({ open, currentParam, onSelect, onClose }: ParamPickerProps) {
  const [tab, setTab] = useState<'list' | 'tree'>('list');

  // 回显值解析
  const echoRef = useRef<string>('');
  const [selRef, setSelRef] = useState('');
  const [selInfo, setSelInfo] = useState<Omit<SelectedParam, 'ref'> | null>(null);

  // 能源类型（仅结构树用）
  const [energyTypes, setEnergyTypes] = useState<EnergyType[]>([]);
  const [treeEnergy, setTreeEnergy] = useState('');

  // ── 参数列表 ──
  const [lm, setLm] = useState(''); // 模型
  const [ld, setLd] = useState(''); // 对象(设备)
  const [lp, setLp] = useState(''); // 参数
  const [list, setList] = useState<ParamRow[]>([]);
  const [ltotal, setLtotal] = useState(0);
  const [lpage, setLpage] = useState(1);
  const [lload, setLload] = useState(false);
  const L = 15;

  // ── 结构树 ──
  const [treeModel, setTreeModel] = useState('energy');     // bindType
  const [treeType, setTreeType] = useState('carbon_base');   // type
  const [treePersp, setTreePersp] = useState('default');     // perspective
  const [tRoots, setTRoots] = useState<LocNode[]>([]);
  const [tload, setTload] = useState(false);
  const [expK, setExpK] = useState<Set<string>>(new Set());
  const [tSelId, setTSelId] = useState<string | null>(null);
  const [tPath, setTPath] = useState<LocNode[]>([]);
  const [tp, setTp] = useState<ParamRow[]>([]);
  const [tpload, setTpload] = useState(false);
  // 树节点下的搜索
  const [tm, setTm] = useState('');
  const [td, setTd] = useState('');
  const [tparam, setTparam] = useState('');

  // ── 打开时 ──
  useEffect(() => {
    if (!open) return;
    const e = currentParam || '';
    echoRef.current = e;
    setSelRef(e);
    setSelInfo(null);
    // 尝试解析回显
    const m = e.match(/^<%(.*?)\/(.*?)%>$/);
    if (m) setSelInfo({ deviceName: m[1], deviceMark: '', paramName: m[2], paramMark: '' });

    setTab('list');
    setLpage(1); setLm(''); setLd(''); setLp('');
    setTreeEnergy(''); setTRoots([]); setTSelId(null); setTPath([]); setTp([]);
    setTm(''); setTd(''); setTparam('');
    loadEnergy();
    loadList();
  }, [open]);

  async function loadEnergy() {
    try { const d = exData(await post('/energyInfo/queryCache', {})); if (Array.isArray(d)) setEnergyTypes(d); } catch {}
  }

  // ── 参数列表加载 ──
  async function loadList() {
    setLload(true);
    try {
      const body: Record<string, any> = { pageNo: lpage, limit: L, offset: (lpage - 1) * L }; if (lm) body.model = lm; if (ld) body.device = ld; if (lp) body.param = lp;
      const d = exData(await post('/jnyz/dataset/queryParams', body)) || { content: [], totalElements: 0 };
      setList((d.content || []).map((x: any, i: number): ParamRow => ({ key: `${x.deviceMark}-${x.modelMark}-${x.paramMark}-${i}`, deviceMark: x.deviceMark || '', deviceName: x.deviceName || '', modelMark: x.modelMark || '', modelName: x.modelName || '', paramMark: x.paramMark || '', paramName: x.paramName || '' })));
      setLtotal(parseInt(d.totalElements || d.total || '0', 10));
    } catch { setList([]); setLtotal(0); } finally { setLload(false); }
  }
  useEffect(() => { if (open && tab === 'list') loadList(); }, [lpage]);

  // ── 结构树加载 ──
  async function loadTree() {
    setTload(true);
    try {
      const body: Record<string, any> = { type: treeType, bindType: treeModel, energyCode: treeEnergy || 'common' };
      const d = exData(await post('/locationTree/query', body));
      const roots: LocNode[] = Array.isArray(d) ? d : [];
      setTRoots(roots);
      if (roots.length > 0) { setTSelId(roots[0].id); setTPath([roots[0]]); setExpK(new Set([roots[0].id])); loadTreeParams(roots[0].id); }
    } catch { setTRoots([]); } finally { setTload(false); }
  }
  useEffect(() => { if (open && tab === 'tree') loadTree(); }, [tab, treeModel, treeType, treeEnergy]);

  // ── 树「right-side」参数加载 ──
  async function loadTreeParams(locId: string) {
    setTpload(true); setTp([]);
    try {
      const body: Record<string, any> = { relationType: 'iot', locationId: locId, energyCode: treeEnergy || 'common', perspective: treePersp, pageNo: 1, limit: 200, includeChildren: 'N', includeEmptyNode: 'Y' };
      if (tm) body.model = tm; if (td) body.device = td; if (tparam) body.param = tparam;
      const d = exData(await post('/projectModel/queryBindRelationAll', body)) || { content: [] };
      setTp((d.content || []).filter((x: any) => x.paramName && x.deviceName).map((x: any, i: number): ParamRow => ({ key: `${x.deviceMark}-${x.paramMark}-${i}`, deviceMark: x.deviceMark || '', deviceName: x.deviceName || '', modelMark: x.modelMark || '', modelName: x.modelName || '', paramMark: x.paramMark || '', paramName: x.paramName || '' })));
    } catch { setTp([]); } finally { setTpload(false); }
  }

  function clickNode(node: LocNode) {
    setTSelId(node.id);
    setTPath(prev => { const i = prev.findIndex(p => p.id === node.id); return i >= 0 ? prev.slice(0, i + 1) : [...prev, node]; });
    setExpK(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; });
    loadTreeParams(node.id);
  }

  function handleSel(item: { deviceName: string; deviceMark?: string; paramName: string; paramMark?: string }) {
    setSelRef(ref(item));
    setSelInfo({ deviceName: item.deviceName, deviceMark: item.deviceMark || '', paramName: item.paramName, paramMark: item.paramMark || '' });
  }

  function confirm() { if (selInfo) onSelect({ ref: selRef, ...selInfo }); onClose(); }

  function listSearch() { setLpage(1); }
  function treeSearch() { if (tSelId) loadTreeParams(tSelId); }

  const bp = tPath.map(n => n.locationName);
  const tpTotal = Math.ceil(ltotal / L);

  if (!open) return null;

  return (
    <div className="prm show">
      <div className="prm-mask" onClick={onClose} />
      <div className="prm-body">
        <div className="prm-header"><h3>选择参数</h3><div className="prm-close" onClick={onClose}>✕</div></div>

        <div className="prm-tabs">
          <div className={`prm-tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>参数列表</div>
          <div className={`prm-tab ${tab === 'tree' ? 'active' : ''}`} onClick={() => setTab('tree')}>结构树</div>
        </div>

        {/* ========= 参数列表 ========= */}
        {tab === 'list' && (
          <div className="prm-list">
            <div className="prm-list-filters">
              <div className="prm-filter-item"><label>模型名称/标识</label><input placeholder="请输入" value={lm} onChange={e => setLm(e.target.value)} onKeyDown={e => e.key === 'Enter' && listSearch()} /></div>
              <div className="prm-filter-item"><label>对象名称/标识</label><input placeholder="请输入" value={ld} onChange={e => setLd(e.target.value)} onKeyDown={e => e.key === 'Enter' && listSearch()} /></div>
              <div className="prm-filter-item"><label>参数名称/标识</label><input placeholder="请输入" value={lp} onChange={e => setLp(e.target.value)} onKeyDown={e => e.key === 'Enter' && listSearch()} /></div>
              <div className="prm-filter-item prm-filter-action"><button onClick={listSearch} className="prm-btn-primary">搜索</button></div>
            </div>
            <div className="prm-table-wrap">
              <table className="prm-table"><thead><tr>
                <th style={{ width: 36 }}></th><th>对象标识</th><th>对象名称</th><th>模型标识</th><th>模型名称</th><th>参数标识</th><th>参数名称</th>
              </tr></thead><tbody>
                {lload ? <tr><td colSpan={7} className="prm-empty">加载中…</td></tr> :
                 list.length === 0 ? <tr><td colSpan={7} className="prm-empty">暂无数据</td></tr> :
                 list.map(it => { const r = ref(it); const sel = selRef === r;
                   return (<tr key={it.key} className={`prm-row${sel ? ' selected' : ''}`} onClick={() => handleSel(it)}>
                     <td><input type="radio" name="prm-l" checked={sel} onChange={() => handleSel(it)} /></td>
                     <td className="prm-mono">{it.deviceMark}</td><td>{it.deviceName}</td><td className="prm-mono">{it.modelMark}</td><td>{it.modelName}</td><td className="prm-mono">{it.paramMark}</td><td>{it.paramName}</td>
                   </tr>);
                 })}
              </tbody></table>
            </div>
            <div className="prm-pagination">
              <span>共 {ltotal} 条</span>
              <button disabled={lpage <= 1} onClick={() => setLpage(p => p - 1)}>‹</button>
              <span className="prm-page-info">第 {ltotal > 0 ? lpage : 0}/{tpTotal || 1} 页</span>
              <button disabled={lpage >= tpTotal} onClick={() => setLpage(p => p + 1)}>›</button>
              <span className="prm-page-info">{L} 条/页</span>
            </div>
          </div>
        )}

        {/* ========= 结构树 ========= */}
        {tab === 'tree' && (
          <div className="prm-tree-panel">
            {/* 筛选栏 */}
            <div className="prm-tree-filterbar">
              <div className="prm-tf-item"><label>模型</label>
                <select value={treeModel} onChange={e => setTreeModel(e.target.value)}>
                  {MODEL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="prm-tf-item"><label>类型</label>
                <select value={treeType} onChange={e => setTreeType(e.target.value)}>
                  {MODEL_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="prm-tf-item"><label>视角</label>
                <select value={treePersp} onChange={e => setTreePersp(e.target.value)}>
                  {PERSPECTIVES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="prm-tf-item"><label>能源类型</label>
                <select value={treeEnergy} onChange={e => setTreeEnergy(e.target.value)}>
                  <option value="">全部</option>
                  {energyTypes.map(et => <option key={et.energyCode} value={et.energyCode}>{et.energyName}</option>)}
                </select>
              </div>
            </div>

            <div className="prm-tree-hsplit">
              {/* 左：树 */}
              <div className="prm-tree-left">
                <div className="prm-tree-breadcrumb">
                  <span className="prm-bc-link" onClick={() => { setTSelId(null); setTPath([]); setTp([]); }}>全部</span>
                  {bp.map((n, i) => <React.Fragment key={i}><span className="prm-bc-sep">/</span><span className="prm-bc-link" onClick={() => { const tgt = tPath[i]; setTPath(tPath.slice(0, i + 1)); setTSelId(tgt.id); loadTreeParams(tgt.id); }}>{n}</span></React.Fragment>)}
                </div>
                <div className="prm-tree-scroll">
                  {tload ? <div className="prm-empty">加载中…</div> :
                   tRoots.length === 0 ? <div className="prm-empty">暂无数据</div> :
                   <ul className="prm-tree-ul">{tRoots.map(n => <TNode key={n.id} node={n} exp={expK} selId={tSelId} onClick={clickNode} />)}</ul>}
                </div>
              </div>

              {/* 右：参数 + 搜索 */}
              <div className="prm-tree-right">
                <div className="prm-tree-right-filterbar">
                  <div className="prm-tf-item"><label>模型名称/标识</label><input placeholder="请输入" value={tm} onChange={e => setTm(e.target.value)} onKeyDown={e => e.key === 'Enter' && treeSearch()} /></div>
                  <div className="prm-tf-item"><label>对象名称/标识</label><input placeholder="请输入" value={td} onChange={e => setTd(e.target.value)} onKeyDown={e => e.key === 'Enter' && treeSearch()} /></div>
                  <div className="prm-tf-item"><label>参数名称/标识</label><input placeholder="请输入" value={tparam} onChange={e => setTparam(e.target.value)} onKeyDown={e => e.key === 'Enter' && treeSearch()} /></div>
                  <div className="prm-tf-item prm-filter-action"><button onClick={treeSearch} className="prm-btn-sm">搜索</button></div>
                </div>
                <div className="prm-tree-params">
                  {tpload ? <div className="prm-empty">加载中…</div> :
                   tp.length === 0 ? <div className="prm-empty">{tSelId ? '暂无参数' : '请选择左侧节点'}</div> :
                   <table className="prm-table prm-table-sm"><thead><tr>
                     <th style={{ width: 32 }}></th><th>对象名称</th><th>模型名称</th><th>参数名称</th><th>参数标识</th>
                   </tr></thead><tbody>
                     {tp.map((it, i) => { const r = ref(it); const sel = selRef === r;
                       return (<tr key={`${it.deviceMark}-${it.paramMark}-${i}`} className={`prm-row${sel ? ' selected' : ''}`} onClick={() => handleSel(it)}>
                         <td><input type="radio" name="prm-t" checked={sel} onChange={() => handleSel(it)} /></td>
                         <td>{it.deviceName}</td><td>{it.modelName}</td><td>{it.paramName}</td><td className="prm-mono">{it.paramMark}</td>
                       </tr>)})}
                   </tbody></table>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部 */}
        <div className="prm-footer">
          <div className="prm-selected"><span className="prm-selected-label">已选参数：</span><span className="prm-selected-value">{selRef || '未选择'}</span></div>
          <div className="prm-footer-actions">
            <button className="prm-btn-default" onClick={onClose}>取消</button>
            <button className="prm-btn-primary" onClick={confirm} disabled={!selInfo}>确定</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 树节点
function TNode({ node, exp, selId, onClick }: { node: LocNode; exp: Set<string>; selId: string | null; onClick: (n: LocNode) => void }) {
  const has = node.children && node.children.length > 0;
  const open = exp.has(node.id);
  const sel = selId === node.id;
  return (
    <li>
      <div className={`prm-tree-node${sel ? ' selected' : ''}`} onClick={() => onClick(node)}>
        <span className="prm-tree-toggle">{has ? (open ? '▼' : '▶') : '　'}</span>
        <span className="prm-tree-icon">📁</span>
        <span className="prm-tree-label">{node.locationName}</span>
      </div>
      {has && open && <ul className="prm-tree-ul prm-tree-sublist">{node.children!.map(c => <TNode key={c.id} node={c} exp={exp} selId={selId} onClick={onClick} />)}</ul>}
    </li>
  );
}
