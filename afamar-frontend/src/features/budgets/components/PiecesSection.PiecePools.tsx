import React, { useMemo, useState } from 'react';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { Pool } from '@/types/poolStock';
import { parseNumber } from '@/utils/formatters';
import PoolCard from '@/components/materials/PoolCard/PoolCard';
import styles from './PiecesSection.module.css';
import type { PieceHandlers } from './PiecesSection.types';

const s = styles as unknown as Record<string, string>;

/** Inline pool picker scoped to a single piece. Mirrors the global
 *  PoolSection but reads/writes `piece.pools` via the piece pool handlers
 *  so each mesada carries its own pileta(s). */
export default function PiecePools({
  piece,
  pools,
  readOnly,
  handlers,
}: {
  piece: BudgetPiece;
  pools: Pool[];
  readOnly: boolean;
  handlers: PieceHandlers;
}) {
  const pieceMaterials = useMemo(
    () =>
      [
        piece.mainMaterial,
        ...(piece.mainMaterialRows || []),
        ...(piece.alternativeMaterials || []),
      ].filter(Boolean) as MaterialInForm[],
    [piece.mainMaterial, piece.mainMaterialRows, piece.alternativeMaterials],
  );

  const handleAdd = (poolId: string) => {
    const pool = pools.find((p) => Number(p.id) === Number(poolId));
    if (!pool) return;
    handlers.setPiecePoolFields(piece.id, piece.pools.length, {
      pool_id: pool.id,
      brand: pool.brand || '',
      model: pool.model || '',
      price: Number(pool.price) || 0,
      currency: (pool.currency || 'ARS') as 'ARS' | 'USD',
      quantity: 1,
      material: '',
      image: (pool as { photo?: string }).photo || (pool as { image?: string }).image || null,
    });
  };

  // Filter the pool catalogue by pool type (SIMPLE / DOBLE) so the
  // operator can narrow the picker before adding a pileta to the piece.
  // The types are derived from the pools themselves (backend attaches
  // `pool_type_id` + `pool_type_name` to each row), so no extra fetch is
  // needed. Mirrors the legacy PoolSection's type filter behaviour.
  const [poolTypeFilter, setPoolTypeFilter] = useState<number | 'all'>('all');

  const poolTypes = useMemo(() => {
    const byType = new Map<number, string>();
    for (const p of pools) {
      const id = Number(p.pool_type_id);
      if (id > 0) byType.set(id, p.pool_type_name || `Tipo ${id}`);
    }
    return [...byType.entries()].sort(([a], [b]) => a - b);
  }, [pools]);

  const filteredPools = useMemo(() => {
    const base =
      poolTypeFilter === 'all'
        ? pools
        : pools.filter((p) => Number(p.pool_type_id) === poolTypeFilter);
    // Stable ordering (brand, then model) so the picker reads predictably
    // regardless of stock insertion order.
    return [...base].sort((a, b) => {
      const ab = `${a.brand ?? ''}`.toLowerCase();
      const bb = `${b.brand ?? ''}`.toLowerCase();
      if (ab < bb) return -1;
      if (ab > bb) return 1;
      return `${a.model ?? ''}`.toLowerCase().localeCompare(`${b.model ?? ''}`.toLowerCase());
    });
  }, [pools, poolTypeFilter]);

  return (
    <div className={s['piece-pools']}>
      <div className={s['piece-pools__header']}>
        <h4 className={s['piece-pools__title']}>PILETAS DE ESTA PIEZA</h4>
        {!readOnly && (
          <div className={s['piece-pools__filters']}>
            <select
              className={`input ${s['piece-pools__type-filter']}`}
              value={poolTypeFilter}
              onChange={(e) =>
                setPoolTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              disabled={readOnly}
              aria-label="Filtrar piletas por tipo"
            >
              <option value="all">Todas</option>
              {poolTypes.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <select
              className={`input ${s['piece-pools__add']}`}
              value=""
              onChange={(e) => {
                if (e.target.value) handleAdd(e.target.value);
                e.target.value = '';
              }}
              disabled={readOnly}
            >
              <option value="">+ AGREGAR PILETA</option>
              {filteredPools.map((p) => (
                <option key={p.id as number} value={p.id as number}>
                  {p.brand as string} - {p.model as string}
                  {p.pool_type_name ? ` (${p.pool_type_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {(piece.pools || []).map((pt, idx) => (
        <PoolCard
          key={`${piece.id}-pool-${idx}`}
          pt={pt}
          idx={idx}
          formMaterials={pieceMaterials}
          readOnly={readOnly}
          updatePileta={(i, field, value) => handlers.updatePiecePool(piece.id, i, field, value)}
          setPoolFields={(i, fields) => handlers.setPiecePoolFields(piece.id, i, fields)}
          removePileta={(i) => handlers.removePiecePool(piece.id, i)}
          num={(v) => parseNumber(v as string) ?? 0}
        />
      ))}
    </div>
  );
}
