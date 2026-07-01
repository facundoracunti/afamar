import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { getMateriales, deleteMaterial, getConfig } from '../../services/api';
import { categoriasMaterial } from '../../utils/formatters';
import type { Material } from '../../types/material';
import type { Configuracion } from '../../types/configuracion';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './MaterialsListPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function MaterialsList() {
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
      getConfig(),
    ]).then(([matRes, cfgRes]) => {
      setData(matRes.data as Material[]);
      const cfgMap: Record<string, string> = {};
      (cfgRes.data as Configuracion[]).forEach((c) => {
        cfgMap[c.key] = c.value;
      });
      setTipoCambio(Number(cfgMap.tipo_cambio) || 1);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [search, categoria]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMaterial(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className={s['materials']}>
      <div className={s['materials__header']}>
        <h1 className={s['materials__title']}>Materiales</h1>
        <div className={s['materials__toolbar']}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/materials/new')}
          >
            <Plus size={16} /> Nuevo Material
          </button>
        </div>
      </div>

      <div className={s['materials__toolbar']}>
        <div className={s['materials__search']}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar material..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 200 }}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categoriasMaterial.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className={s['materials__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['materials__th']}>Nombre</th>
                <th className={s['materials__th']}>Categoria</th>
                <th className={s['materials__th']}>Color</th>
                <th className={s['materials__th']}>Espesor</th>
                <th className={s['materials__th'] + ' ' + s['materials__td--right']}>Precio M2</th>
                <th className={s['materials__th']}>Proveedor</th>
                <th className={s['materials__th']}>Stock</th>
                <th className={s['materials__th']}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m: Material) => {
                const moneda = m.moneda || 'ARS';
                const precio =
                  moneda === 'USD' ? m.precio_m2_usd || 0 : m.precio_m2 || 0;
                return (
                  <tr key={m.id}>
                    <td className={s['materials__td']} style={{ fontWeight: 600 }}>
                      {m.nombre}
                    </td>
                    <td className={s['materials__td']}>
                      <span className="badge badge-approved">{m.categoria}</span>
                    </td>
                    <td className={s['materials__td']}>{m.color || '-'}</td>
                    <td className={s['materials__td']}>{m.espesor_disponible || '-'}</td>
                    <td
                      className={s['materials__td'] + ' ' + s['materials__td--right']}
                      style={{
                        fontWeight: 700,
                        color: moneda === 'USD' ? '#059669' : '#111',
                      }}
                    >
                      {moneda === 'USD'
                        ? `USD ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : `$ ${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className={s['materials__td']}>{m.proveedor || '-'}</td>
                    <td className={s['materials__td']}>{m.stock_disponible || 0}</td>
                    <td className={s['materials__td']}>
                      <div className={s['materials__cell-actions']}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 8px' }}
                          onClick={() => navigate(`/admin/materials/${m.id}`)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 8px' }}
                          onClick={() => setDeleteId(m.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className={s['materials__empty']}>
                    No hay materiales registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar material"
        message="Estas seguro?"
      />
    </div>
  );
}
