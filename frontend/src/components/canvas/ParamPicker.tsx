/**
 * ParamPicker — 参数选择器
 *
 * Tab 1「参数列表」— 模型/对象/参数三字段搜索 + 分页表格
 * Tab 2「结构树」  — 模型选择 → 类型+视角 → 位置树 → 绑定参数
 *
 * 数据：10.74.170.221 真实微服务
 * 选中：<%对象名称/参数名称%>
 */
import React, { useState, useEffect, useRef } from 'react';

// ── Types ──
interface ParamRow {
  id: string;
  key: string;
  deviceMark: string;
  deviceName: string;
  modelMark: string;
  modelName: string;
  paramMark: string;
  paramName: string;
  method?: string;
}
interface LocNode {
  id: string; locationName: string; parentId: string; topParentId: string;
  children?: LocNode[]; [k: string]: any;
}
interface EnergyType { energyCode: string; energyName: string }
interface DictItem { dictionaryVal: string; dictionaryName: string }
export interface SelectedParam {
  ref: string; deviceName: string; deviceMark: string; paramName: string; paramMark: string;
}
export interface ParamPickerProps {
  open: boolean;
  currentParam: string | undefined;
  onSelect: (p: SelectedParam) => void;
  onClose: () => void;
}

// ── 认证 ──
const AUTH = localStorage.getItem('cms_rule_auth_token') || 'Bearer 5eab1cca-b94a-465e-bb81-75d0b2840327';
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

// ── 模型类型（固定值，与 front 项目一致） ──
const MODEL_TYPES = [
  { label: '能流模型', value: 'mode' },
  { label: '排放模型', value: 'emission' },
  { label: '对象树',   value: 'uc' },
];

function getEnergyTypesByModel(mode: string): EnergyType[] {
  if (mode === 'mode') return [
    { energyCode: 'elc', energyName: '电' },
    { energyCode: 'water', energyName: '水' },
    { energyCode: 'gas', energyName: '气' },
    { energyCode: 'heat', energyName: '热' },
    { energyCode: 'coal', energyName: '煤' },
    { energyCode: 'oil', energyName: '油' },
    { energyCode: 'renewable', energyName: '可再生能源' },
    { energyCode: 'other', energyName: '其他' },
  ];
  if (mode === 'emission') return [
    { energyCode: 'carbon_scope1', energyName: '直接排放（范围一）' },
    { energyCode: 'carbon_scope2', energyName: '间接排放（范围二）' },
  ];
  return [];
}

// ── 排放模型：从响应 emissionCode/emissionName 映射 ──
function mapEmissionTypes(data: any[]): EnergyType[] {
  return data.map((item: any) => ({
    energyCode: item.emissionCode || item.energyCode,
    energyName: item.emissionName || item.energyName,
  }));
}

// ── Component ──
export default function ParamPicker({ open, currentParam, onSelect, onClose }: ParamPickerProps) {
  const [tab, setTab] = useState<'list' | 'tree'>('list');

  // 回显值解析
  const echoRef = useRef<string>('');
  const [selRef, setSelRef] = useState('');
  const [selInfo, setSelInfo] = useState<Omit<SelectedParam, 'ref'> | null>(null);

  // ── 参数列表 ──
  const [lm, setLm] = useState('');
  const [ld, setLd] = useState('');
  const [lp, setLp] = useState('');
  const [list, setList] = useState<ParamRow[]>([]);
  const [ltotal, setLtotal] = useState(0);
  const [lpage, setLpage] = useState(1);
  const [lload, setLload] = useState(false);
  const L = 15;

  // ── 结构树 ──
  const [treeModel, setTreeModel] = useState('mode');       // mode / emission / uc
  const [treeEnergy, setTreeEnergy] = useState('');          // energyCode
  const [treePersp, setTreePersp] = useState('');            // perspective
  const [treeTypeEnergies, setTreeTypeEnergies] = useState<EnergyType[]>([]);
  const [perspectives, setPerspectives] = useState<DictItem[]>([]);
  // 记录视角是否已加载（参照 front：mounted 加载一次）
  const perspectivesLoadedRef = useRef(false);
  const [tRoots, setTRoots] = useState<LocNode[]>([]);
  const [tload, setTload] = useState(false);
  const [expK, setExpK] = useState<Set<string>>(new Set());
  const [tSelId, setTSelId] = useState<string | null>(null);
  const [tSelTopParentId, setTSelTopParentId] = useState<string>('');
  const [tPath, setTPath] = useState<LocNode[]>([]);
  const [tp, setTp] = useState<ParamRow[]>([]);
  const [tpload, setTpload] = useState(false);
  const [tpPage, setTpPage] = useState(1);
  const [tpTotal, setTpTotal] = useState(0);
  const tpL = 15;
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
    const m = e.match(/^<%(.*?)\/(.*?)%>$/);
    if (m) setSelInfo({ deviceName: m[1], deviceMark: '', paramName: m[2], paramMark: '' });

    setTab('list');
    setLpage(1); setLm(''); setLd(''); setLp('');
    setTreeModel('mode'); setTreeEnergy(''); setTreePersp('');
    setTRoots([]); setTSelId(null); setTp([]); setTPath([]);
    setExpK(new Set());
    setTreeTypeEnergies([]);
    setPerspectives([]);
    perspectivesLoadedRef.current = false;
    setTm(''); setTd(''); setTparam('');
    // 如果视角还没加载过，加载一次
    if (!perspectivesLoadedRef.current) loadPerspectives();
    loadList();
  }, [open]);

  // ── 加载视角（参照 front: mounted 时只加载一次） ──
  async function loadPerspectives() {
    try {
      const r = await post('/dictionary/queryCacheQuery', { configCode: 'perspective', type: 'perspective', limit: 1000, pageNo: 1 });
      const d = exData(r);
      if (Array.isArray(d)) {
        setPerspectives(d);
        perspectivesLoadedRef.current = true;
        // 设置默认视角
        if (d.length > 0) {
          setTreePersp(d[0].dictionaryVal);
        }
      }
    } catch {}
  }



  // ── Tab 切换到结构树时，直接加载数据 ──
  useEffect(() => {
    if (!open || tab !== 'tree') return;
    // 清空旧数据
    setTRoots([]); setTSelId(null); setTp([]); setTPath([]); setExpK(new Set());
    setTreeEnergy(''); setTreePersp('');
    setTreeTypeEnergies([]);

    if (treeModel === 'uc') {
      loadUCTree();
    } else {
      // 获取默认视角
      const defaultPersp = perspectives.length > 0
        ? perspectives[0].dictionaryVal
        : 'default';
      setTreeEnergy('elc');
      setTreePersp(defaultPersp);

      // 用确定值直接调 loadTree，不依赖状态更新的时序
      doLoadTree(treeModel, 'elc', defaultPersp);

      // 异步加载能源类型列表（仅用于下拉菜单，不影响树加载）
      setTimeout(async () => {
        try {
          const h = await post('/energyInfo/queryCache', { type: 'ALL' });
          const d = exData(h);
          if (Array.isArray(d)) setTreeTypeEnergies(d);
        } catch {}
      }, 0);

      // 视角列表如果还没加载，也异步加载（仅用于下拉菜单）
      if (!perspectivesLoadedRef.current) {
        setTimeout(async () => {
          try {
            const r = await post('/dictionary/queryCacheQuery', { configCode: 'perspective', type: 'perspective', limit: 1000, pageNo: 1 });
            const d = exData(r);
            if (Array.isArray(d)) {
              setPerspectives(d);
              perspectivesLoadedRef.current = true;
            }
          } catch {}
        }, 0);
      }
    }
  }, [tab]);

  function doLoadTree(modelType: string, energyCode: string, perspective: string) {
    if (modelType === 'uc') { loadUCTree(); return; }
    setTload(true); setTRoots([]);
    const body = { energyCode, perspective, type: modelType, bindType: modelType };
    post('/locationTree/query', body).then(raw => {
      const d = exData(raw);
      const roots: LocNode[] = Array.isArray(d) ? d : [];
      setTRoots(roots);
      if (roots.length > 0) {
        setTSelId(roots[0].id);
        setTSelTopParentId(roots[0].topParentId || '');
        setTPath([roots[0]]);
        setExpK(new Set([roots[0].id]));
        loadTreeParamsNormal(roots[0].id);
      }
    }).catch(() => {
      setTRoots([]);
    }).finally(() => {
      setTload(false);
    });
  }

  // ── 模型切换（能源类型/视角下拉变更时重新加载树） ──
  useEffect(() => {
    if (!open || tab !== 'tree' || treeModel === 'uc') return;
    if (!treeEnergy || !treePersp) return;
    setTRoots([]); setTSelId(null); setTp([]); setTPath([]); setExpK(new Set());
    doLoadTree(treeModel, treeEnergy, treePersp);
  }, [treeModel, treeEnergy, treePersp]);

  // ── UC 专用：树加载（无类型+视角） ──
  async function loadUCTree() {
    setTload(true); setTRoots([]);
    try {
      const body = { bindType: 'device', energyCode: 'common', type: 'device' };
      const d = exData(await post('/locationTree/query', body));
      const roots: LocNode[] = Array.isArray(d) ? d : [];
      setTRoots(roots);
      if (roots.length > 0) {
        setTSelId(roots[0].id);
        setTSelTopParentId(roots[0].topParentId || '');
        setTPath([roots[0]]);
        setExpK(new Set([roots[0].id]));
        loadTreeParamsUC(roots[0].id, roots[0].topParentId || '');
      }
    } catch { setTRoots([]); } finally { setTload(false); }
  }

  // ── 普通树加载（mode/emission）─
  async function loadTree() {
    if (treeModel === 'uc') return;
    if (!treeEnergy || !treePersp) return;
    setTload(true); setTRoots([]);
    // 参照：getTreeQuery({ energyCode, perspective, type: treeModel, bindType: treeModel })
    try {
      const body = { energyCode: treeEnergy, perspective: treePersp, type: treeModel, bindType: treeModel };
      const d = exData(await post('/locationTree/query', body));
      const roots: LocNode[] = Array.isArray(d) ? d : [];
      setTRoots(roots);
      if (roots.length > 0) {
        setTSelId(roots[0].id);
        setTSelTopParentId(roots[0].topParentId || '');
        setTPath([roots[0]]);
        setExpK(new Set([roots[0].id]));
        loadTreeParamsNormal(roots[0].id);
      }
    } catch { setTRoots([]); } finally { setTload(false); }
  }

  // ── 树参数加载：普通模式（mode/emission）──
  async function loadTreeParamsNormal(locId: string, pg?: number) {
    const page = pg ?? tpPage;
    setTpload(true); setTp([]);
    try {
      const locationId = treePersp !== 'default' ? treePersp + '-' + locId : locId;
      const body: Record<string, any> = {
        ...(tm ? { model: tm } : {}),
        ...(td ? { device: td } : {}),
        ...(tparam ? { param: tparam } : {}),
        pageNo: page, limit: tpL,
        globalSearch: 'N', includeChildren: 'N',
        locationId,
        energyCode: treeEnergy,
        perspective: treePersp,
        relationType: treeModel,
      };
      const d = exData(await post('/projectModel/queryBindRelationAll', body)) || { content: [] };
      setTpPage(page);
      setTpTotal(parseInt(d.totalElements || d.total || '0', 10));
      const rows = (d.content || []).filter((x: any) => x.paramName && x.deviceName).map((x: any, i: number): ParamRow => ({
        id: (x.deviceMark || '') + '' + (x.modelMark || '') + '' + (x.paramMark || ''),
        key: `${x.deviceMark}-${x.paramMark}-${i}`,
        deviceMark: x.deviceMark || '', deviceName: x.deviceName || '',
        modelMark: x.modelMark || '', modelName: x.modelName || '',
        paramMark: x.paramMark || '', paramName: x.paramName || '',
        method: x.method || 'avg',
      }));
      setTp(rows);
    } catch { setTp([]); setTpTotal(0); } finally { setTpload(false); }
  }

  // ── 树参数加载：UC 模式 ──
  async function loadTreeParamsUC(locId: string, topParentId: string, pg?: number) {
    const page = pg ?? tpPage;
    setTpload(true); setTp([]);
    try {
      const body: Record<string, any> = {
        ...(tm ? { model: tm } : {}),
        ...(td ? { device: td } : {}),
        ...(tparam ? { param: tparam } : {}),
        pageNo: page, limit: tpL,
        includeChildren: 'N', globalSearch: 'N',
        topParentId,
        locationId: locId,
      };
      const d = exData(await post('/dataSimulation/list', body)) || { content: [] };
      setTpPage(page);
      setTpTotal(parseInt(d.totalElements || d.total || '0', 10));
      const rows = (d.content || []).filter((x: any) => x.paramName && x.deviceName).map((x: any, i: number): ParamRow => ({
        id: (x.deviceMark || '') + '' + (x.modelMark || '') + '' + (x.paramMark || ''),
        key: `${x.deviceMark}-${x.paramMark}-${i}`,
        deviceMark: x.deviceMark || '', deviceName: x.deviceName || '',
        modelMark: x.modelMark || '', modelName: x.modelName || '',
        paramMark: x.paramMark || '', paramName: x.paramName || '',
        method: x.method || 'avg',
      }));
      setTp(rows);
    } catch { setTp([]); setTpTotal(0); } finally { setTpload(false); }
  }

  // ── 根据当前选中的树根节点重建面包屑路径 ──
  function rebuildPath(node: LocNode, roots: LocNode[]): LocNode[] {
    // 如果是根节点（在 roots 数组里），直接返回
    if (roots.some(r => r.id === node.id)) return [node];
    // 否则从当前路径追加（由父级展开点击传递）
    return [node];
  }

  function clickNode(node: LocNode) {
    setTSelId(node.id);
    setTSelTopParentId(node.topParentId || '');
    // 路径只做截断或追加子树，不做同级替换
    setTPath(prev => {
      const idx = prev.findIndex(p => p.id === node.id);
      if (idx >= 0) return prev.slice(0, idx + 1);
      // 如果 node 是顶层根节点之一（兄弟关系），替换而非追加
      if (tRoots.some(r => r.id === node.id)) return [node];
      return [...prev, node];
    });
    // 展开当前节点（只展开不折叠）
    setExpK(prev => new Set(prev).add(node.id));
    setTpPage(1);
    if (treeModel === 'uc') {
      loadTreeParamsUC(node.id, node.topParentId || '', 1);
    } else {
      loadTreeParamsNormal(node.id, 1);
    }
  }

  function handleSel(item: { deviceName: string; deviceMark?: string; paramName: string; paramMark?: string }) {
    setSelRef(ref(item));
    setSelInfo({ deviceName: item.deviceName, deviceMark: item.deviceMark || '', paramName: item.paramName, paramMark: item.paramMark || '' });
  }

  function confirm() { if (selInfo) onSelect({ ref: selRef, ...selInfo }); onClose(); }

  function listSearch() { setLpage(1); loadList(); }

  function treeSearch() {
    setTpPage(1);
    if (tSelId) {
      if (treeModel === 'uc') loadTreeParamsUC(tSelId, tSelTopParentId, 1);
      else loadTreeParamsNormal(tSelId, 1);
    }
  }

  // ── 参数列表加载 ──
  async function loadList() {
    setLload(true);
    try {
      const body: Record<string, any> = { pageNo: lpage, limit: L };
      if (lm) body.model = lm; if (ld) body.device = ld; if (lp) body.param = lp;
      const d = exData(await post('/jnyz/dataset/queryParams', body)) || { content: [], totalElements: 0 };
      setList((d.content || []).map((x: any, i: number): ParamRow => ({
        id: (x.deviceMark || '') + '' + (x.modelMark || '') + '' + (x.paramMark || ''),
        key: `${x.deviceMark}-${x.modelMark}-${x.paramMark}-${i}`,
        deviceMark: x.deviceMark || '', deviceName: x.deviceName || '',
        modelMark: x.modelMark || '', modelName: x.modelName || '',
        paramMark: x.paramMark || '', paramName: x.paramName || '',
        method: x.method || 'avg',
      })));
      setLtotal(parseInt(d.totalElements || d.total || '0', 10));
    } catch { setList([]); setLtotal(0); } finally { setLload(false); }
  }
  useEffect(() => { if (open && tab === 'list') loadList(); }, [lpage]);



  const bp = tPath.map(n => n.locationName);
  const tpTotalPages = Math.ceil(tpTotal / tpL);
  const tlTotal = ltotal;

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
                <th style={{ width: 36 }}></th><th>模型标识</th><th>模型名称</th><th>对象标识</th><th>对象名称</th><th>参数标识</th><th>参数名称</th>
              </tr></thead><tbody>
                {lload ? <tr><td colSpan={7} className="prm-empty">加载中…</td></tr> :
                 list.length === 0 ? <tr><td colSpan={7} className="prm-empty">暂无数据</td></tr> :
                 list.map(it => { const r = ref(it); const sel = selRef === r;
                   return (<tr key={it.key} className={`prm-row${sel ? ' selected' : ''}`} onClick={() => handleSel(it)}>
                     <td><input type="radio" name="prm-l" checked={sel} onChange={() => handleSel(it)} /></td>
                     <td className="prm-mono">{it.modelMark}</td><td>{it.modelName}</td><td className="prm-mono">{it.deviceMark}</td><td>{it.deviceName}</td><td className="prm-mono">{it.paramMark}</td><td>{it.paramName}</td>
                   </tr>);
                 })}
              </tbody></table>
            </div>
            <div className="prm-pagination">
              <span>共 {tlTotal} 条</span>
              <button disabled={lpage <= 1} onClick={() => setLpage(p => p - 1)}>‹</button>
              <span className="prm-page-info">第 {tlTotal > 0 ? lpage : 0}/{Math.ceil(tlTotal / L) || 1} 页</span>
              <button disabled={lpage >= Math.ceil(tlTotal / L)} onClick={() => setLpage(p => p + 1)}>›</button>
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
              {treeModel !== 'uc' && (
                <>
                  <div className="prm-tf-item"><label>类型</label>
                    <select value={treeEnergy} onChange={e => setTreeEnergy(e.target.value)}>
                      {(treeTypeEnergies.length > 0 ? treeTypeEnergies : getEnergyTypesByModel(treeModel)).map(et =>
                        <option key={et.energyCode} value={et.energyCode}>{et.energyName}</option>
                      )}
                    </select>
                  </div>
                  <div className="prm-tf-item"><label>视角</label>
                    <select value={treePersp} onChange={e => setTreePersp(e.target.value)}>
                      {perspectives.map(p =>
                        <option key={p.dictionaryVal} value={p.dictionaryVal}>{p.dictionaryName}</option>
                      )}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="prm-tree-hsplit">
              {/* 左：树 */}
              <div className="prm-tree-left">
                <div className="prm-tree-breadcrumb">
                  <span className="prm-bc-link" onClick={() => { setTSelId(null); setTPath([]); setTp([]); }}>全部</span>
                  {bp.map((n, i) => <React.Fragment key={i}><span className="prm-bc-sep">/</span><span className="prm-bc-link" onClick={() => { const tgt = tPath[i]; setTPath(tPath.slice(0, i + 1)); setTSelId(tgt.id); setTSelTopParentId(tgt.topParentId || ''); setTpPage(1); if (treeModel === 'uc') loadTreeParamsUC(tgt.id, tgt.topParentId || '', 1); else loadTreeParamsNormal(tgt.id, 1); }}>{n}</span></React.Fragment>)}
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
                  {/* 分页 */}
                  <div className="prm-pagination" style={{ marginTop: 8 }}>
                    <span>共 {tpTotal} 条</span>
                    <button disabled={tpPage <= 1} onClick={() => {
                      const p = tpPage - 1;
                      if (tSelId) { setTpPage(p); if (treeModel === 'uc') loadTreeParamsUC(tSelId, tSelTopParentId, p); else loadTreeParamsNormal(tSelId, p); }
                    }}>‹</button>
                    <span className="prm-page-info">第 {tpTotal > 0 ? tpPage : 0}/{tpTotalPages || 1} 页</span>
                    <button disabled={tpPage >= tpTotalPages} onClick={() => {
                      const p = tpPage + 1;
                      if (tSelId) { setTpPage(p); if (treeModel === 'uc') loadTreeParamsUC(tSelId, tSelTopParentId, p); else loadTreeParamsNormal(tSelId, p); }
                    }}>›</button>
                    <span className="prm-page-info">{tpL} 条/页</span>
                  </div>
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
