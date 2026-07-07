import React, { useState, useMemo } from 'react';
import http from '@/api/http';
import { useList } from '../../../api/hooks';
import PoolCard from '../PoolCard/PoolCard';
import type { PoolType } from '../../../types/poolStock';
import type { MaterialInForm, PoolInForm } from '../../../types/budget';
import styles from './PoolSection.module.css';

const s = styles as unknown as Record<string, string>;

interface PoolSectionProps {
  /** Catalog of pool types (from /pool-stock). */
  pools: Record<string, unknown>[];
  /** Pools added to the current budget/WorkOrder. */
  formPiletas: PoolInForm[];
  /** Materials added to the current budget/WorkOrder (main + alternatives).
   *  Powers the per-pool "Asignar a opción" picker. */
  formMaterials: MaterialInForm[];
  readOnly: boolean;
  addPileta: (id: string) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  num: (v: unknown) => number;
}

export default function PoolSection({
  pools,
  formPiletas,
  formMaterials,
  readOnly,
  addPileta,
  updatePileta,
  removePileta,
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
    if (poolTypeFilter === 'all') return pools;
    return pools.filter((p) => (p.pool_type_id as number) === poolTypeFilter);
  }, [pools, poolTypeFilter]);

  return (
    <div className="card">
      <h3 className="section-title">PILETAS</h3>
      <div className={s['pool-section__filters']}>
        <select
          className={`input ${s['pool-section__type-filter']}`}
          value={poolTypeFilter}
          onChange={(e) => setPoolTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">Todos</option>
          {poolTypes.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
        <select
          className={`input ${s['pool-section__add-select']}`}
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
          pt={pt}
          idx={idx}
          formMaterials={formMaterials}
          readOnly={readOnly}
          updatePileta={updatePileta}
          removePileta={removePileta}
          num={num}
        />
      ))}
    </div>
  );
}
