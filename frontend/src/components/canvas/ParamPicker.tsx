/**
 * ParamPicker.tsx — 参数选择器
 */

import React, { useState, useMemo } from 'react';
import type { PointsItem } from './ConfigDrawer';
import { DEFAULT_POINTS } from './ConfigDrawer';

export interface ParamPickerProps {
  open: boolean;
  currentParam: string | undefined;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export default function ParamPicker({ open, currentParam, onSelect, onClose }: ParamPickerProps) {
  const [search, setSearch] = useState('');

  const filteredPoints = useMemo(() => {
    if (!search) return DEFAULT_POINTS;
    const lower = search.toLowerCase();
    return DEFAULT_POINTS.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.desc || '').toLowerCase().includes(lower)
    );
  }, [search]);

  if (!open) return null;

  return (
    <div className="plu show" id="plu">
      <div className="pmt">选择参数</div>
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          placeholder="搜索参数…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            height: '32px',
            border: '1px solid var(--line)',
            borderRadius: '5px',
            padding: '0 10px',
            fontSize: '12px',
            outline: 'none',
          }}
          autoFocus
        />
      </div>
      <div className="pmg" id="pmg">
        {filteredPoints.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
            无匹配参数
          </div>
        ) : (
          filteredPoints.map((p) => (
            <div
              key={p.name}
              className={`pmi ${p.name === currentParam ? 'selected' : ''}`}
              onClick={() => {
                onSelect(p.name);
                onClose();
              }}
            >
              <div className="ic" style={{ background: '#e8631c' }}>
                {p.name[0]}
              </div>
              <div className="nm">{p.name}</div>
              {p.unit && <div className="ds">{p.unit}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
