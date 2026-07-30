import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Tags } from 'lucide-react';
import {
  getMaterialCategories,
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
  primeMaterialCategoryMap,
} from '@/api/resources/materials';
import { useList, useCreate, useUpdate, useDelete } from '../../api/hooks';
import { useNotify } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { Modal } from '../../components/ui/Modal/Modal';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { Pagination } from '../../components/ui/Pagination';
import styles from './MaterialsCategoriesPage.module.css';

const s = styles as unknown as Record<string, string>;

const CATEGORIES_KEY = ['material-categories'] as const;

type Category = { id: number; name: string };

const PAGE_SIZE = 20;

export default function MaterialsCategories() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const notify = useNotify();

  const { items: data, loading, load } = useList<Category>(
    CATEGORIES_KEY,
    async () => {
      const res = await getMaterialCategories();
      return (res.data as unknown as Category[]) || [];
    }
  );

  const createMutation = useCreate<unknown, { name: string }>(
    CATEGORIES_KEY,
    async (variables) => { await createMaterialCategory(variables); },
    { invalidateKeys: [CATEGORIES_KEY] }
  );

  const updateMutation = useUpdate<unknown, { id: number; name: string }>(
    CATEGORIES_KEY,
    async (variables) => { await updateMaterialCategory(variables.id, { name: variables.name }); },
    { invalidateKeys: [CATEGORIES_KEY] }
  );

  const deleteMutation = useDelete<unknown, number>(
    CATEGORIES_KEY,
    async (id) => { await deleteMaterialCategory(id); },
    { invalidateKeys: [CATEGORIES_KEY] }
  );

  const filtered = data.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    primeMaterialCategoryMap();
  }, [data]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openCreate = () => {
    setEditingId(null);
    setNameDraft('');
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingId(category.id);
    setNameDraft(category.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setNameDraft('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      notify('El nombre de la categoría es obligatorio', 'error');
      return;
    }
    const duplicate = data.some(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase() && c.id !== editingId
    );
    if (duplicate) {
      notify('Ya existe una categoría con ese nombre', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId === null) {
        await createMutation.mutateAsync({ name: trimmed });
        notify('Categoría creada', 'success');
      } else {
        await updateMutation.mutateAsync({ id: editingId, name: trimmed });
        notify('Categoría actualizada', 'success');
      }
      closeModal();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar la categoría', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      notify('Categoría eliminada', 'success');
      setDeleteId(null);
      // Refresh the helper map too.
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al eliminar la categoría', 'error');
    }
  };

  return (
    <div className={s['categories']}>
      <PageHeader
        title="Categorías de Materiales"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Plus size={16} /> Nueva Categoría
          </button>
        }
      />

      <div className={s['categories__toolbar']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar categoría..."
          leftIcon={<Search size={18} color="#94a3b8" />}
        />
        <span className={s['categories__counter']}>
          {filtered.length} categoría{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className={s['categories__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['categories__th'] + ' ' + s['categories__td--center']}>#</th>
                <th className={s['categories__th']}>Nombre</th>
                <th className={s['categories__th'] + ' ' + s['categories__th--actions']}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((category) => (
                <tr key={category.id}>
                  <td className={s['categories__td'] + ' ' + s['categories__td--center']}>
                    {category.id}
                  </td>
                  <td className={s['categories__td'] + ' ' + s['categories__td--name']}>
                    <Tags size={14} className={s['categories__tag-icon']} />
                    {category.name}
                  </td>
                  <td className={s['categories__td']}>
                    <div className={s['categories__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 8px' }}
                        onClick={() => openEdit(category)}
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '4px 8px' }}
                        onClick={() => setDeleteId(category.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      message={
                        data.length === 0
                          ? 'No hay categorías registradas. Crea la primera con "Nueva Categoría".'
                          : 'Sin resultados para la búsqueda actual.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > PAGE_SIZE && (
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} label="categorías" />
          )}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId === null ? 'Nueva Categoría' : 'Editar Categoría'}
        width="420px"
      >
        <form onSubmit={handleSubmit}>
          <div className={s['categories__modal-body']}>
            <label htmlFor="category-name">Nombre</label>
            <input
              id="category-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Ej: Granitos"
              maxLength={100}
              disabled={saving}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className={s['categories__modal-actions']}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={closeModal}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !nameDraft.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message="¿Seguro que querés eliminar esta categoría? Si tiene materiales asociados, la operación será rechazada por el servidor."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
