/**
 * ConfigDrawer.tsx — 节点配置抽屉
 * 
 * 对应原型的 drawer.js，负责渲染各节点类型的配置表单
 */

import React, { useState, useCallback, useRef } from 'react';
import type { FlowNode, Flow, Branch } from './RuleCanvas';
import { NODE_TYPES, OPERATORS } from './RuleCanvas';

export interface PointsItem {
  name: string;
  unit: string;
  desc?: string;
}

export const DEFAULT_POINTS: PointsItem[] = [
  { name: "室内温度", unit: "°C", desc: "室内温度" },
  { name: "室外温度", unit: "°C", desc: "室外温度" },
  { name: "相对湿度", unit: "%RH", desc: "室内湿度" },
  { name: "CO₂浓度", unit: "ppm", desc: "CO₂浓度" },
  { name: "光照强度", unit: "lux", desc: "光照强度" },
  { name: "1#空调启停", unit: "", desc: "空调1" },
  { name: "2#空调启停", unit: "", desc: "空调2" },
  { name: "照明开关", unit: "", desc: "照明" },
  { name: "新风机开关", unit: "", desc: "新风机" },
  { name: "风机盘管阀", unit: "%", desc: "阀门" },
  { name: "供水温度", unit: "°C", desc: "供水温度" },
  { name: "回水温度", unit: "°C", desc: "回水温度" },
  { name: "水泵状态", unit: "", desc: "水泵" },
  { name: "房间设定温度", unit: "°C", desc: "设定温度" },
];

export interface ConfigDrawerProps {
  open: boolean;
  ctx: { kind: 'node' | 'branch_group'; nodeId: string; branchId?: string } | null;
  flow: Flow;
  onClose: () => void;
  onChange: (nodeId: string, updates: Partial<FlowNode>) => void;
  onBranchChange?: (nodeId: string, branchId: string, updates: Partial<Branch>) => void;
  onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}

export default function ConfigDrawer({
  open,
  ctx,
  flow,
  onClose,
  onChange,
  onBranchChange,
  onOpenParamPicker,
}: ConfigDrawerProps) {
  if (!open || !ctx) return null;

  const node = flow.nodes[ctx.nodeId];
  if (!node) return null;

  const isBranch = ctx.kind === 'branch_group';
  const branch = isBranch ? node.branches?.find((b) => b.id === ctx.branchId) : null;

  const title = isBranch
    ? (node.type === 'and_branch' ? 'AND' : 'OR') + ' 分支配置'
    : NODE_TYPES[node.type]?.label + ' · ' + node.name;

  return (
    <>
      <div className={`dma ${open ? 'show' : ''}`} onClick={onClose} />
      <div className={`drawer ${open ? 'show' : ''}`} id="drawer">
        <div className="dh">
          <h3 id="dh-title">{title}</h3>
          <div className="close" onClick={onClose}>✕</div>
        </div>

        {isBranch && (
          <div className="pin" id="pin">
            所属节点：{node.name}
          </div>
        )}

        {isBranch && (
          <div className="tabs" id="dts">
            {node.branches?.map((b) => (
              <div
                key={b.id}
                className={`tab ${b.id === ctx.branchId ? 'active' : ''}`}
              >
                {b.name}
              </div>
            ))}
          </div>
        )}

        <div className="dbody" id="dbody">
          {isBranch && branch ? (
            <ConditionBuilder
              key={`branch-${branch.id}`}
              config={branch.config}
              onChange={(cfg) => {
                if (onBranchChange) {
                  onBranchChange(ctx.nodeId, branch.id, { config: cfg });
                }
              }}
              onOpenParamPicker={onOpenParamPicker}
            />
          ) : (
            <NodeConfig
              node={node}
              flow={flow}
              onChange={(updated) => onChange(ctx.nodeId, updated)}
              onOpenParamPicker={onOpenParamPicker}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ============ Node Config ============
interface NodeConfigProps {
  node: FlowNode;
  flow: Flow;
  onChange: (node: FlowNode) => void;
  onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}

function NodeConfig({ node, flow, onChange, onOpenParamPicker }: NodeConfigProps) {
  const cfg = node.config || {};

  function updateCfg(updates: Record<string, any>) {
    onChange({ ...node, config: { ...cfg, ...updates } });
  }

  if (node.type === 'rule') {
    return (
      <ConditionBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
        onOpenParamPicker={onOpenParamPicker}
      />
    );
  }

  if (node.type === 'route') {
    return (
      <div>
        <ConditionBuilder
          config={cfg}
          onChange={(c) => onChange({ ...node, config: c })}
          onOpenParamPicker={onOpenParamPicker}
        />
        <div className="field" style={{ marginTop: '14px' }}>
          <label>目标节点<span className="req">*</span></label>
          <select
            value={cfg.targetId || ''}
            onChange={(e) => updateCfg({ targetId: e.target.value })}
          >
            <option value="">请选择目标节点</option>
            {flow.mainFlow.map((nid) => {
              const n = flow.nodes[nid];
              if (!n || nid === node.id) return null;
              const isLegal = n.type !== 'route' && nid !== node.id;
              return (
                <option key={nid} value={nid} disabled={!isLegal}>
                  {n.name}
                  {!isLegal ? ' （不可选）' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    );
  }

  if (node.type === 'timer') {
    return (
      <TimerBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
      />
    );
  }

  if (node.type === 'delay') {
    return (
      <DelayBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
      />
    );
  }

  if (node.type === 'modify') {
    return (
      <ModifyBuilder
        config={cfg}
        onChange={(c) => onChange({ ...node, config: c })}
        onOpenParamPicker={onOpenParamPicker}
      />
    );
  }

  return (
    <div className="warn">该节点类型暂不支持配置。</div>
  );
}

// ============ Condition Builder ============
interface ConditionBuilderProps {
  config: any;
  onChange: (config: any) => void;
  onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}

function ConditionBuilder({ config, onChange, onOpenParamPicker }: ConditionBuilderProps) {
  const condMode = config.condMode || 'param';
  const scriptRef = useRef<HTMLTextAreaElement>(null);

  function insertParamAtCursor(paramRef: string) {
    if (!scriptRef.current) return;
    const ta = scriptRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = (config.script || '').slice(0, start);
    const after = (config.script || '').slice(end);
    const newVal = before + paramRef + after;
    onChange({ ...config, script: newVal });
    // 光标移到插入内容之后
    requestAnimationFrame(() => {
      const pos = start + paramRef.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  }

  return (
    <div>
      {/* Mode Tabs */}
      <div className="ctb">
        <div
          className={`ctv ${condMode === 'param' ? 'active' : ''}`}
          onClick={() => onChange({ ...config, condMode: 'param' })}
        >
          自选参数
        </div>
        <div
          className={`ctv ${condMode === 'script' ? 'active' : ''}`}
          onClick={() => onChange({ ...config, condMode: 'script' })}
        >
          脚本配置
        </div>
      </div>

      {condMode === 'param' ? (
        <>
          {/* Param Name */}
          <div className="field">
            <label>参数名<span className="req">*</span></label>
            <button
              type="button"
              className="psb"
              onClick={() =>
                onOpenParamPicker(config.param, (name) =>
                  onChange({ ...config, param: name })
                )
              }
            >
              <span className="psv" style={config.param ? {} : { color: '#b0b7c8' }}>
                {config.param || '选择参数'}
              </span>
              <span className="psa">▼</span>
            </button>
          </div>

          {/* Operator */}
          <div className="field">
            <label>运算符<span className="req">*</span></label>
            <select
              value={config.op || ''}
              onChange={(e) => onChange({ ...config, op: e.target.value })}
            >
              <option value="">请选择</option>
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>

          {/* Threshold / Range */}
          {config.op === '范围内' ? (
            <div className="field">
              <label>
                取值范围<span className="req">*</span>
                <span className="hint" style={{ display: 'inline' }}>
                  闭区间
                </span>
              </label>
              <div className="bdr">
                <input
                  type="number"
                  placeholder="最小值"
                  value={config.min || ''}
                  onChange={(e) => onChange({ ...config, min: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="最大值"
                  value={config.max || ''}
                  onChange={(e) => onChange({ ...config, max: e.target.value })}
                />
              </div>
              {config.min !== '' && config.max !== '' && config.min !== undefined && config.max !== undefined &&
                Number(config.min) >= Number(config.max) && (
                <div className="ferr">最小值不能大于等于最大值</div>
              )}
            </div>
          ) : (
            <div className="field">
              <label>阈值<span className="req">*</span></label>
              <input
                type="text"
                placeholder="阈值"
                value={config.threshold || ''}
                onChange={(e) => onChange({ ...config, threshold: e.target.value })}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="script-rules">
            <div className="sr-title">📋 脚本编写规则</div>
            <div className="sr-section">
              <div className="sr-label">
                写法 1：<code>return</code> + Python 逻辑表达式
              </div>
              <div className="sr-hint">
                规则前需加 <code>return </code>（return + 一个空格）
              </div>
              <pre className="sr-code">{`return 1 if <%对象名/参数名%> > 12 else 0`}</pre>
            </div>
            <div className="sr-section">
              <div className="sr-label">写法 2：多行 Python if 判断语句</div>
              <pre className="sr-code">{`if <%对象名/参数名%> > 12:\n    return True\nelse:\n    return False`}</pre>
            </div>
            <div className="sr-hint" style={{ marginTop: '6px' }}>
              参数引用格式：<code>{`<%对象名/参数名%>`}</code>　　返回 <code>1</code>/
              <code>True</code> 表示条件成立，<code>0</code>/
              <code>False</code> 表示不成立
            </div>
          </div>
          <div className="field">
            <label>脚本内容<span className="req">*</span></label>
            <div style={{ marginBottom: 6 }}>
              <button
                type="button"
                className="psb"
                onClick={() =>
                  onOpenParamPicker('', (paramRef) =>
                    insertParamAtCursor(paramRef)
                  )
                }
                style={{ fontSize: 11, height: 26, width: 'auto', padding: '0 8px' }}
              >
                ＋ 添加参数
              </button>
            </div>
            <textarea
              ref={scriptRef}
              placeholder={`示例：\nreturn 1 if <%对象名/参数名%> > 12 else 0`}
              value={config.script || ''}
              onChange={(e) => onChange({ ...config, script: e.target.value })}
              style={{
                height: '130px',
                fontFamily: "'Courier New', monospace",
                fontSize: '12px',
                lineHeight: '1.6',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============ Timer Builder ============
interface TimerBuilderProps {
  config: any;
  onChange: (config: any) => void;
}

function TimerBuilder({ config, onChange }: TimerBuilderProps) {
  const kind = config.kind || '';
  const groups = config.groups || [];

  function addGroup() {
    const newGroup = createEmptyGroup(kind);
    onChange({ ...config, groups: [...groups, newGroup] });
  }

  function removeGroup(idx: number) {
    onChange({ ...config, groups: groups.filter((_: any, i: number) => i !== idx) });
  }

  function updateGroup(idx: number, updates: any) {
    onChange({
      ...config,
      groups: groups.map((g: any, i: number) => (i === idx ? { ...g, ...updates } : g)),
    });
  }

  return (
    <div>
      <div className="field">
        <label>触发类型<span className="req">*</span></label>
        <select
          value={kind}
          onChange={(e) =>
            onChange({ kind: e.target.value, groups: [createEmptyGroup(e.target.value)] })
          }
        >
          <option value="">请选择</option>
          <option value="specific">指定时间范围</option>
          <option value="daily">每天</option>
          <option value="weekly">每周几</option>
          <option value="monthly">每月第N天</option>
          <option value="yearly">每年第N天</option>
        </select>
      </div>

      {kind &&
        groups.map((group: any, idx: number) => (
          <div key={idx} className="tgc">
            <div className="tgi">时段 {idx + 1}</div>
            {groups.length > 1 && (
              <div className="tgd" onClick={() => removeGroup(idx)}>
                ×
              </div>
            )}
            <TimerGroupFields kind={kind} group={group} onChange={(u) => updateGroup(idx, u)} />
          </div>
        ))}

      {kind && (
        <button type="button" className="agb" onClick={addGroup}>
          ＋ 添加时段
        </button>
      )}
    </div>
  );
}

function createEmptyGroup(kind: string): any {
  if (kind === 'specific') return { dateRange: { start: '', end: '' } };
  if (kind === 'daily') return { timeRange: { start: '', end: '' } };
  if (kind === 'weekly') return { days: [], timeRange: { start: '', end: '' } };
  if (kind === 'monthly') return { dayRange: { start: '', end: '' }, timeRange: { start: '', end: '' } };
  if (kind === 'yearly')
    return {
      dateRange: { startMonth: '', startDay: '', endMonth: '', endDay: '' },
      timeRange: { start: '', end: '' },
    };
  return {};
}

interface TimerGroupFieldsProps {
  kind: string;
  group: any;
  onChange: (u: any) => void;
}

function TimerGroupFields({ kind, group, onChange }: TimerGroupFieldsProps) {
  if (kind === 'specific') {
    return (
      <div className="field">
        <label>时间范围<span className="req">*</span></label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            type="datetime-local"
            placeholder="开始"
            value={group.dateRange?.start || ''}
            onChange={(e) =>
              onChange({ dateRange: { ...group.dateRange, start: e.target.value } })
            }
          />
          <input
            type="datetime-local"
            placeholder="结束"
            value={group.dateRange?.end || ''}
            onChange={(e) =>
              onChange({ dateRange: { ...group.dateRange, end: e.target.value } })
            }
          />
        </div>
      </div>
    );
  }

  if (kind === 'daily') {
    return (
      <div className="field">
        <label>时间范围<span className="req">*</span></label>
        <div className="row2">
          <input
            type="time"
            step="1"
            placeholder="开始"
            value={group.timeRange?.start || ''}
            onChange={(e) =>
              onChange({ timeRange: { ...group.timeRange, start: e.target.value } })
            }
          />
          <input
            type="time"
            step="1"
            placeholder="结束"
            value={group.timeRange?.end || ''}
            onChange={(e) =>
              onChange({ timeRange: { ...group.timeRange, end: e.target.value } })
            }
          />
        </div>
      </div>
    );
  }

  if (kind === 'weekly') {
    return (
      <>
        <div className="field">
          <label>选择星期<span className="req">*</span></label>
          <div className="wdr">
            {['一', '二', '三', '四', '五', '六', '日'].map((day, dayIdx) => {
              const d = dayIdx + 1;
              const active = (group.days || []).includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  className={`dbt ${active ? 'active' : ''}`}
                  onClick={() => {
                    const days = active
                      ? group.days.filter((x: number) => x !== d)
                      : [...(group.days || []), d].sort();
                    onChange({ days });
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>时间范围<span className="req">*</span></label>
          <div className="row2">
            <input
              type="time"
              step="1"
              placeholder="开始"
              value={group.timeRange?.start || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, start: e.target.value } })
              }
            />
            <input
              type="time"
              step="1"
              placeholder="结束"
              value={group.timeRange?.end || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, end: e.target.value } })
              }
            />
          </div>
        </div>
      </>
    );
  }

  if (kind === 'monthly') {
    return (
      <>
        <div className="field">
          <label>
            日期范围<span className="req">*</span>
            <span className="hint" style={{ display: 'inline' }}>
              1~31
            </span>
          </label>
          <div className="row2">
            <input
              type="number"
              min={1}
              max={31}
              placeholder="起始日"
              value={group.dayRange?.start || ''}
              onChange={(e) =>
                onChange({ dayRange: { ...group.dayRange, start: e.target.value } })
              }
            />
            <input
              type="number"
              min={1}
              max={31}
              placeholder="结束日"
              value={group.dayRange?.end || ''}
              onChange={(e) =>
                onChange({ dayRange: { ...group.dayRange, end: e.target.value } })
              }
            />
          </div>
        </div>
        <div className="field">
          <label>时间范围<span className="req">*</span></label>
          <div className="row2">
            <input
              type="time"
              step="1"
              placeholder="开始"
              value={group.timeRange?.start || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, start: e.target.value } })
              }
            />
            <input
              type="time"
              step="1"
              placeholder="结束"
              value={group.timeRange?.end || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, end: e.target.value } })
              }
            />
          </div>
        </div>
      </>
    );
  }

  if (kind === 'yearly') {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    return (
      <>
        <div className="field">
          <label>日期范围<span className="req">*</span></label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <select
                style={{
                  flex: 1,
                  height: '32px',
                  border: '1px solid var(--line)',
                  borderRadius: '5px',
                  padding: '0 6px',
                  fontSize: '12px',
                }}
                value={group.dateRange?.startMonth || ''}
                onChange={(e) =>
                  onChange({
                    dateRange: { ...group.dateRange, startMonth: e.target.value },
                  })
                }
              >
                <option value="">月</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="日"
                style={{
                  width: '60px',
                  height: '32px',
                  border: '1px solid var(--line)',
                  borderRadius: '5px',
                  padding: '0 6px',
                  fontSize: '12px',
                }}
                value={group.dateRange?.startDay || ''}
                onChange={(e) =>
                  onChange({
                    dateRange: { ...group.dateRange, startDay: e.target.value },
                  })
                }
              />
              <span style={{ color: 'var(--muted)', fontSize: '12px', flexShrink: 0 }}>
                至
              </span>
              <select
                style={{
                  flex: 1,
                  height: '32px',
                  border: '1px solid var(--line)',
                  borderRadius: '5px',
                  padding: '0 6px',
                  fontSize: '12px',
                }}
                value={group.dateRange?.endMonth || ''}
                onChange={(e) =>
                  onChange({
                    dateRange: { ...group.dateRange, endMonth: e.target.value },
                  })
                }
              >
                <option value="">月</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={31}
                placeholder="日"
                style={{
                  width: '60px',
                  height: '32px',
                  border: '1px solid var(--line)',
                  borderRadius: '5px',
                  padding: '0 6px',
                  fontSize: '12px',
                }}
                value={group.dateRange?.endDay || ''}
                onChange={(e) =>
                  onChange({
                    dateRange: { ...group.dateRange, endDay: e.target.value },
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label>时间范围<span className="req">*</span></label>
          <div className="row2">
            <input
              type="time"
              step="1"
              placeholder="开始"
              value={group.timeRange?.start || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, start: e.target.value } })
              }
            />
            <input
              type="time"
              step="1"
              placeholder="结束"
              value={group.timeRange?.end || ''}
              onChange={(e) =>
                onChange({ timeRange: { ...group.timeRange, end: e.target.value } })
              }
            />
          </div>
        </div>
      </>
    );
  }

  return null;
}

// ============ Delay Builder ============
interface DelayBuilderProps {
  config: any;
  onChange: (config: any) => void;
}

function DelayBuilder({ config, onChange }: DelayBuilderProps) {
  const value = config.value || '';
  const unit = config.unit || '秒';
  const numVal = parseInt(value);
  const totalSecs = unit === '秒' ? numVal : (numVal || 0) * 60;
  const isInvalid = numVal && numVal > 0 && totalSecs > 900;

  let hint = '';
  if (numVal && numVal > 0) {
    hint = isInvalid
      ? unit === '秒'
        ? '最多 900 秒'
        : '最多 15 分钟'
      : `延时 ${totalSecs} 秒后进入下一节点`;
  }

  return (
    <div>
      <div className="field">
        <label>延时时间<span className="req">*</span></label>
        <div className="row2">
          <input
            type="number"
            min={1}
            placeholder="数值"
            style={{ flex: 1 }}
            value={value}
            onChange={(e) => onChange({ ...config, value: e.target.value })}
          />
          <select
            style={{ width: '90px' }}
            value={unit}
            onChange={(e) => onChange({ ...config, unit: e.target.value })}
          >
            <option value="秒">秒</option>
            <option value="分钟">分钟</option>
          </select>
        </div>
        <div className="hint" style={{ color: isInvalid ? 'var(--red)' : 'var(--muted)' }}>
          {hint}
        </div>
      </div>
    </div>
  );
}

// ============ Modify Builder ============
interface ModifyBuilderProps {
  config: any;
  onChange: (config: any) => void;
  onOpenParamPicker: (current: string | undefined, cb: (name: string) => void) => void;
}

function ModifyBuilder({ config, onChange, onOpenParamPicker }: ModifyBuilderProps) {
  const valueRef = useRef<HTMLInputElement>(null);

  function insertParamAtValue(paramRef: string) {
    if (!valueRef.current) return;
    const inp = valueRef.current;
    const start = inp.selectionStart || 0;
    const end = inp.selectionEnd || 0;
    const before = (config.value || '').slice(0, start);
    const after = (config.value || '').slice(end);
    const newVal = before + paramRef + after;
    onChange({ ...config, value: newVal });
    requestAnimationFrame(() => {
      const pos = start + paramRef.length;
      inp.setSelectionRange(pos, pos);
      inp.focus();
    });
  }

  return (
    <div>
      <div className="field">
        <label>参数名<span className="req">*</span></label>
        <button
          type="button"
          className="psb"
          onClick={() =>
            onOpenParamPicker(config.param, (name) =>
              onChange({ ...config, param: name })
            )
          }
        >
          <span className="psv" style={config.param ? {} : { color: '#b0b7c8' }}>
            {config.param || '选择参数'}
          </span>
          <span className="psa">▼</span>
        </button>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--muted)', margin: '-6px 0 12px', lineHeight: '1.5' }}>
        固定值或表达式
      </div>
      <div className="field">
        <label>目标值<span className="req">*</span></label>
        <div className="row2">
          <input
            ref={valueRef}
            type="text"
            placeholder="固定值或表达式"
            value={config.value || ''}
            onChange={(e) => onChange({ ...config, value: e.target.value })}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="psb"
            onClick={() =>
              onOpenParamPicker('', (paramRef) =>
                insertParamAtValue(paramRef)
              )
            }
            style={{ fontSize: 11, height: 32, width: 'auto', padding: '0 8px', whiteSpace: 'nowrap' }}
          >
            ＋ 添加参数
          </button>
        </div>
        <div className="hint">
          表达式以 = 开头，引用参数：<code>{`<%对象名/参数名%>`}</code>，支持 +-*/
        </div>
      </div>
      <div className="field">
        <label>
          上下限{' '}
          <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '11px' }}>
            （选填，不填则无限制）
          </span>
        </label>
        <div className="bdr">
          <input
            type="number"
            placeholder="下限"
            value={config.limitMin || ''}
            onChange={(e) => onChange({ ...config, limitMin: e.target.value })}
          />
          <input
            type="number"
            placeholder="上限"
            value={config.limitMax || ''}
            onChange={(e) => onChange({ ...config, limitMax: e.target.value })}
          />
        </div>
        {config.limitMin !== '' && config.limitMax !== '' && config.limitMin !== undefined && config.limitMax !== undefined &&
          Number(config.limitMin) >= Number(config.limitMax) && (
          <div className="ferr">下限不能大于等于上限</div>
        )}
      </div>
    </div>
  );
}
