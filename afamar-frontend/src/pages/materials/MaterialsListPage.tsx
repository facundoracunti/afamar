import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, FolderTree, Image as ImageIcon } from 'lucide-react';
import { getMaterials, deleteMaterial, getMaterialCategories, getMaterialColors, type MaterialCategory } from '@/api/resources/materials';
import { useList } from '../../api/hooks';
import type { Material, MaterialColor } from '../../types/material';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { formatCurrencyValue } from '../../utils/formatters';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { MaterialFormModal } from '../../components/materials/MaterialFormModal/MaterialFormModal';
import { useEntityList } from '../../hooks/useEntityList';
import styles from './MaterialsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MATERIALS_KEY = ['materials'] as const;
const CATEGORIES_KEY = ['material-categories'] as const;
const COLORS_KEY = ['material-colors'] as const;

export default function MaterialsList() {
  const [categoria, setCategoria] = useState('');
  const [color, setColor] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxName, setLightboxName] = useState<string>('');
  const navigate = useNavigate();

  const { items: categorias } = useList<MaterialCategory>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      return (res.data as MaterialCategory[]) || [];
    }
  );

  const { items: colores } = useList<MaterialColor>(
    COLORS_KEY,
    async () => {
      const res = await getMaterialColors();
      return (res.data as MaterialColor[]) || [];
    }
  );

  const categoryNameById = useMemo(() => {
    const m: Record<number, string> = {};
    categorias.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categorias]);

// The hook owns search + delete + pagination. Category is an extra
// filter that lives in the page (it's page-specific UI).
  const list: ReturnType<typeof useEntityList<Material, number>> = useEntityList<Material, number>({
    queryKey: [...MATERIALS_KEY, categoria, color],
    listFetcher: async ({ skip, limit }) =>
      getMaterials({ search: list.search || undefined, category_id: categoria || undefined, color_id: color || undefined, skip, limit }),
    deleteFn: (id) => deleteMaterial(id),
    pageSize: 10,
    successMessage: 'Material eliminado correctamente',
    errorMessage: 'Error al eliminar material',
  });
  const { items: data, loading, total, page, pageSize, setPage, search, setSearch, deleteId, requestDelete, cancelDelete, confirmDelete } = list;

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
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
        <select
          className="input"
          style={{ width: 200 }}
          value={color}
          onChange={(e) => setColor(e.target.value)}
        >
          <option value="">Todos los colores</option>
          {colores.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
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
                <th className={s['materials__th']}>Foto</th>
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
                const currency = m.currency || 'ARS';
                const precio = currency === 'USD' ? m.price_usd || 0 : m.base_price || 0;
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
                        color: currency === 'USD' ? '#16a34a' : 'var(--text-primary)',
                      }}
                    >
                      {formatCurrencyValue(precio, { currency })}
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
                          onClick={() => requestDelete(m.id)}
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
        open={deleteId !== null}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
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