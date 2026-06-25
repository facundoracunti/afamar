import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getMateriales, deleteMaterial, getConfig } from '../../services/api';
import { categoriasMaterial } from '../../utils/formatters';
import type { Material } from '../../types/material';
import type { Configuracion } from '../../types/configuracion';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';

export default function MaterialesList() {
  const [data, setData] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [tipoCambio, setTipoCambio] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    Promise.all([
      getMateriales({ search: search || undefined, categoria: categoria || undefined }),
      getConfig()
    ]).then(([matRes, cfgRes]) => {
      setData(matRes.data as Material[]);
      const cfgMap: Record<string, string> = {};
      (cfgRes.data as Configuracion[]).forEach((c) => { cfgMap[c.key] = c.value; });
      setTipoCambio(Number(cfgMap.tipo_cambio) || 1);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search, categoria]);

  const calcularUsd = (precioArs: number) => tipoCambio > 0 ? (precioArs / tipoCambio) : 0;

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMaterial(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Materiales</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/materiales/nuevo')}>
          <Plus size={16} /> Nuevo Material
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="input" placeholder="Buscar material..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <select className="input" style={{ width: 180 }} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categoriasMaterial.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Color</th>
                  <th>Espesor</th>
                  <th style={{ textAlign: 'right' }}>Precio M²</th>
                  <th>Proveedor</th>
                  <th>Stock</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m: Material) => {
                  const moneda = m.moneda || 'ARS';
                  const precio = moneda === 'USD' ? (m.precio_m2_usd || 0) : (m.precio_m2 || 0);
                  return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                    <td><span className="badge badge-approved">{m.categoria}</span></td>
                    <td>{m.color || '-'}</td>
                    <td>{m.espesor_disponible || '-'}</td>
                    <td style={{ fontWeight: 700, textAlign: 'right', color: moneda === 'USD' ? '#059669' : '#111' }}>
                      {moneda === 'USD' ? `USD ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$ ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td>{m.proveedor || '-'}</td>
                    <td>{m.stock_disponible || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => navigate(`/materiales/${m.id}`)}>
                          <Edit size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setDeleteId(m.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay materiales registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar material" message="¿Estás seguro?" />
    </div>
  );
}
