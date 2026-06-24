import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, X } from 'lucide-react';
import type { Material } from '../../types/material';
import { getMateriales } from '../../services/api';
import Loading from '../common/Loading';

export default function ConsultorMateriales() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [lista, setLista] = useState<Material[]>([]);

  useEffect(() => {
    getMateriales({ limit: 500 }).then((res: { data: Material[] }) => {
      setMateriales(res.data);
      setLoading(false);
    });
  }, []);

  const filtrados = materiales.filter((m: Material) =>
    m.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  const agregar = () => {
    if (!selected) return;
    if (lista.find((m: Material) => m.id === Number(selected))) return;
    const mat = materiales.find((m: Material) => m.id === Number(selected));
    if (mat) setLista([...lista, mat]);
    setSelected('');
    setSearch('');
  };

  const quitar = (id: number) => setLista(lista.filter((m: Material) => m.id !== id));

  const limpiar = () => setLista([]);

  if (loading) return <Loading />;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 } as React.CSSProperties}>Consultor Rápido de Materiales</h1>

      <div className="card" style={{ marginBottom: 20 } as React.CSSProperties}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' } as React.CSSProperties}>
          <div className="form-group" style={{ flex: 1, minWidth: 300 } as React.CSSProperties}>
            <label>Buscar material</label>
            <div style={{ position: 'relative' } as React.CSSProperties}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' } as React.CSSProperties} />
              <input
                className="input"
                style={{ paddingLeft: 32 } as React.CSSProperties}
                placeholder="Escribí para buscar..."
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setSelected(''); }}
              />
            </div>
            {search && filtrados.length > 0 && (
              <div style={{
                position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #e2e8f0',
                borderRadius: 6, maxHeight: 200, overflowY: 'auto', width: '100%', marginTop: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              } as React.CSSProperties}>
                {filtrados.slice(0, 20).map((m: Material) => (
                  <div
                    key={m.id}
                    onClick={() => { setSelected(String(m.id)); setSearch(m.nombre || ''); }}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                      background: Number(selected) === m.id ? '#e0f2fe' : 'transparent',
                      borderBottom: '1px solid #f1f5f9',
                    } as React.CSSProperties}
                  >
                    <strong>{m.nombre}</strong>
                    <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 } as React.CSSProperties}>
                      {m.moneda === 'USD' ? `USD ${(m.precio_m2_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$ ${(m.precio_m2 || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={agregar} disabled={!selected}>
            <Plus size={16} /> Agregar a la lista
          </button>
        </div>
      </div>

      {lista.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } as React.CSSProperties}>
            <h3 style={{ fontSize: 15, fontWeight: 700 } as React.CSSProperties}>Materiales consultados ({lista.length})</h3>
            <button className="btn btn-outline" onClick={limpiar} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties}>
              <Trash2 size={14} /> Limpiar consulta
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr style={{ background: '#f8f9fa' } as React.CSSProperties}>
                  <th>MATERIAL</th>
                  <th style={{ textAlign: 'right' } as React.CSSProperties}>PRECIO M²</th>
                  <th>MONEDA BASE</th>
                  <th style={{ width: 40 } as React.CSSProperties}></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m: Material) => {
                  const moneda = (m.moneda || 'ARS') as 'ARS' | 'USD';
                  const precio = moneda === 'USD' ? (m.precio_m2_usd || 0) : (m.precio_m2 || 0);
                  return (
                    <tr key={m.id}>
                      <td><strong>{m.nombre}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: moneda === 'USD' ? '#059669' : '#1e293b' } as React.CSSProperties}>
                        {moneda === 'USD' ? `USD ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$ ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>{moneda === 'USD' ? 'USD (Dólares)' : 'ARS (Pesos)'}</td>
                      <td style={{ textAlign: 'center' } as React.CSSProperties}>
                        <span onClick={() => quitar(m.id)} style={{ color: '#ef4444', cursor: 'pointer', fontSize: 16 } as React.CSSProperties}>✕</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
