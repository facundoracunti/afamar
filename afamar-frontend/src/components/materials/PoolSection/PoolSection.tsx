import React, { useState, useMemo } from 'react';
import http from '@/api/http';
import { useList } from '../../../api/hooks';
import PoolCard from '../PoolCard/PoolCard';
import type { PoolType } from '../../../types/poolStock';

interface PoolSectionProps {
  piletas: Record<string, unknown>[];
  formPiletas: Record<string, unknown>[];
  readOnly: boolean;
  addPileta: (id: string) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  update: (field: string, value: unknown) => void;
  num: (v: unknown) => number;
}

export default function PoolSection({
  piletas,
  formPiletas,
  readOnly,
  addPileta,
  updatePileta,
  removePileta,
  update,
  num,
}: PoolSectionProps) {
  const [poolTypeFilter, setPoolTypeFilter] = useState<number | 'all'>('all');

  const { items: poolTypeList } = useList<PoolType>(
    ['pool-types'],
    async () => {
      const res = await http.get('/references/pool-types');
      return (res.data as PoolType[]) || [];
    }
  );

  const poolTypes = useMemo(() => {
    return (poolTypeList || []).map((pt) => [pt.id, pt.label] as [number, string]).sort(([a], [b]) => a - b);
  }, [poolTypeList]);

  const filteredPools = useMemo(() => {
    if (poolTypeFilter === 'all') return piletas;
    return piletas.filter((p) => (p.pool_type_id as number) === poolTypeFilter);
  }, [piletas, poolTypeFilter]);

  return (
    <div className="card">
      <h3 className="section-title">PILETAS</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          className="input"
          style={{ width: 110, fontSize: 12 }}
          value={poolTypeFilter}
          onChange={(e) => setPoolTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Todos</option>
          {poolTypes.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select
          className="input"
          style={{ flex: 1, fontSize: 13 }}
          value=""
          onChange={(e) => { addPileta(e.target.value); e.target.value = ''; }}
          disabled={readOnly}
        >
          <option value="">+ AGREGAR PILETA</option>
          {filteredPools.map((p) => (
            <option key={p.id as number} value={p.id as number}>
              {p.brand as string} - {p.model as string} (Stock: {p.quantity as number})
            </option>
          ))}
        </select>
      </div>
      {(formPiletas || []).map((pt, idx) => (
        <PoolCard
          key={idx}
          pt={pt as unknown as import('../../../types/budget').PoolInForm}
          idx={idx}
          piletas={piletas}
          readOnly={readOnly}
          updatePileta={updatePileta}
          removePileta={removePileta}
          formPiletas={formPiletas}
          update={update}
          num={num}
        />
      ))}
    </div>
  );
}
