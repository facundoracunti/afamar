import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, FolderTree, Image as ImageIcon } from 'lucide-react';
import { getMaterials, deleteMaterial, getMaterialCategories, type MaterialCategory } from '@/api/resources/materials';
import { useList, usePaginatedList, useDelete } from '../../api/hooks';
import type { Material } from '../../types/material';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { MaterialFormModal } from '../../components/features/materials/MaterialFormModal';
import styles from './MaterialsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MATERIALS_KEY = ['materials'] as const;
const CATEGORIES_KEY = ['material-categories'] as const;

export default function MaterialsList() {
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>('');
  const navigate = useNavigate();

  const { items: data, loading, total, page, pageSize, setPage } = usePaginatedList<Material>(
    [...MATERIALS_KEY, search, categoria],
    async ({ skip, limit }) => {
      return getMaterials({ search: search || undefined, categoria: categoria || undefined, skip, limit });
    },
    { pageSize: 10 },
  );

  const { items: categorias } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      const list = (res.data as unknown as MaterialCategory[]) || [];
      return list;
    }
  );

  const categoryNameById = useMemo(() => {
    const m: Record<number, string> = {};
    categorias.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categorias]);

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

  const openEdit = (id: number) => setEditId(id);
  const closeEdit = () => setEditId(null);

  const openPhoto = (m: Material) => {
    if (!m.photo) return;
    setLightboxPhoto(m.photo);
    setLightboxName(m.name);
  };

  return (
    <div className={s['materials']}>
      <PageHeader
        title="Materiales"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} /> Nuevo Material
          </button>
        }
      />

      <div className={s['materials__toolbar']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar material..."
          leftIcon={<Search size={18} color="#94a3b8" />}
        />
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
        <LoadingSpinner />
      ) : (
        <div className={s['materials__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['materials__th']} style={{ width: 60 }}>Foto</th>
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
                    <td className={s['materials__td']}>
                      {m.photo ? (
                        <button
                          type="button"
                          className={s['materials__thumb-btn']}
                          title={`Ver foto de ${m.name}`}
                          onClick={() => openPhoto(m)}
                        >
                          <img src={m.photo} alt={m.name} className={s['materials__thumb']} />
                        </button>
                      ) : (
                        <span className={s['materials__thumb-empty']} title="Sin foto">
                          <ImageIcon size={16} />
                        </span>
                      )}
                    </td>
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
                        color: moneda === 'USD' ? '#16a34a' : 'var(--text-primary)',
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
                          onClick={() => openEdit(m.id)}
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
                  <td colSpan={9}>
                    <EmptyState message="No hay materiales registrados" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar material"
        message="Estas seguro?"
        confirmLabel="Eliminar"
        danger
      />

      {/* Edit modal — triggered by the row's edit button instead of navigation */}
      <MaterialFormModal
        isOpen={editId !== null}
        materialId={editId ?? undefined}
        onClose={closeEdit}
      />

      {/* Create modal — same form, no materialId */}
      <MaterialFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Photo lightbox modal — opens the full-size image */}
      <Modal
        isOpen={lightboxPhoto !== null}
        onClose={() => setLightboxPhoto(null)}
        title={lightboxName ? `Foto — ${lightboxName}` : 'Foto del material'}
        width="800px"
      >
        {lightboxPhoto && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src={lightboxPhoto}
              alt={lightboxName}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
        )}
      </Modal>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="materiales" />
    </div>
  );
}
