import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, FolderTree } from 'lucide-react';
import { getMaterials, deleteMaterial, getMaterialCategories, type MaterialCategory } from '@/api/resources/materials';
import { useList, useDelete } from '../../api/hooks';
import type { Material } from '../../types/material';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './MaterialsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MATERIALS_KEY = ['materials'] as const;
const CATEGORIES_KEY = ['material-categories'] as const;

export default function MaterialsList() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  // Materials list (uses API filter param `categoria`).
  const { items: data, loading } = useList<Material>(
    [...MATERIALS_KEY, search, categoria],
    async () => {
      const res = await getMaterials({ search: search || undefined, categoria: categoria || undefined });
      return (res.data as Material[]) || [];
    }
  );

  // Categories come exclusively from the API. No more hardcoded lists.
  // The hook refetches on every mount, so changes made in /admin/materials/categories
  // show up here when the user navigates back.
  const { items: categorias } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      const list = (res.data as unknown as MaterialCategory[]) || [];
      return list;
    }
  );

  // Resolve category names for the table display: backend stores `category_id` as a number.
  // Build a lookup map { id -> name } once per categories change.
  const categoryNameById = useMemo(() => {
    const m: Record<number, string> = {};
    categorias.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categorias]);

  // Filter dropdown uses the category `name` as the API filter value.

  const deleteMutation = useDelete<unknown, number>(
    MATERIALS_KEY,
    async (id) => { await deleteMaterial(id); },
    { invalidateKeys: [MATERIALS_KEY] }
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
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
          style={{ width: 220 }}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => navigate('/admin/materials/categories')}
          title="Gestionar categorías"
        >
          <FolderTree size={14} /> Categorías
        </button>
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
                const moneda = m.currency || 'ARS';
                const precio = moneda === 'USD' ? m.price_usd || 0 : m.base_price || 0;
                const categoryName = m.category_id
                  ? (categoryNameById[Number(m.category_id)] || `Categoria #${m.category_id}`)
                  : '-';
                return (
                  <tr key={m.id}>
                    <td className={s['materials__td']} style={{ fontWeight: 600 }}>
                      {m.name}
                    </td>
                    <td className={s['materials__td']}>
                      <span className="badge badge-approved">{categoryName}</span>
                    </td>
                    <td className={s['materials__td']}>{m.color || '-'}</td>
                    <td className={s['materials__td']}>{m.available_thickness || '-'}</td>
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
                    <td className={s['materials__td']}>{m.supplier || '-'}</td>
                    <td className={s['materials__td']}>{m.stock_available || 0}</td>
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
