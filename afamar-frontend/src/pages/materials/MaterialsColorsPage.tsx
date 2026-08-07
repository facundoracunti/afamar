import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Palette } from 'lucide-react';
import {
  getMaterialColors,
  createMaterialColor,
  updateMaterialColor,
  deleteMaterialColor,
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
import styles from './MaterialsColorsPage.module.css';

const s = styles as unknown as Record<string, string>;

const COLORS_KEY = ['material-colors'] as const;

type Color = { id: number; name: string };

const PAGE_SIZE = 20;

export default function MaterialsColors() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const notify = useNotify();

  const { items: data, loading, load } = useList<Color>(
    COLORS_KEY,
    async () => {
      const res = await getMaterialColors();
      return (res.data as unknown as Color[]) || [];
    }
  );

  const createMutation = useCreate<unknown, { name: string }>(
    COLORS_KEY,
    async (variables) => { await createMaterialColor(variables); },
    { invalidateKeys: [COLORS_KEY] }
  );

  const updateMutation = useUpdate<unknown, { id: number; name: string }>(
    COLORS_KEY,
    async (variables) => { await updateMaterialColor(variables.id, { name: variables.name }); },
    { invalidateKeys: [COLORS_KEY] }
  );

  const deleteMutation = useDelete<unknown, number>(
    COLORS_KEY,
    async (id) => { await deleteMaterialColor(id); },
    { invalidateKeys: [COLORS_KEY] }
  );

  const filtered = data.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const openEdit = (color: Color) => {
    setEditingId(color.id);
    setNameDraft(color.name);
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
      notify('El nombre del color es obligatorio', 'error');
      return;
    }
    const duplicate = data.some(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase() && c.id !== editingId
    );
    if (duplicate) {
      notify('Ya existe un color con ese nombre', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingId === null) {
        await createMutation.mutateAsync({ name: trimmed });
        notify('Color creado', 'success');
      } else {
        await updateMutation.mutateAsync({ id: editingId, name: trimmed });
        notify('Color actualizado', 'success');
      }
      closeModal();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar el color', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      notify('Color eliminado', 'success');
      setDeleteId(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al eliminar el color', 'error');
    }
  };

  return (
    <div className={s['colors']}>
      <PageHeader
        title="Colores de Materiales"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            <Plus size={16} /> Nuevo Color
          </button>
        }
      />

      <div className={s['colors__toolbar']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar color..."
          leftIcon={<Search size={18} color="#94a3b8" />}
        />
        <span className={s['colors__counter']}>
          {filtered.length} color{filtered.length === 1 ? '' : 'es'}
        </span>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className={s['colors__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['colors__th'] + ' ' + s['colors__td--center']}>#</th>
                <th className={s['colors__th']}>Nombre</th>
                <th className={s['colors__th'] + ' ' + s['colors__th--actions']}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((color) => (
                <tr key={color.id}>
                  <td className={s['colors__td'] + ' ' + s['colors__td--center']}>
                    {color.id}
                  </td>
                  <td className={s['colors__td'] + ' ' + s['colors__td--name']}>
                    <Palette size={14} className={s['colors__tag-icon']} />
                    {color.name}
                  </td>
                  <td className={s['colors__td']}>
                    <div className={s['colors__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '4px 8px' }}
                        onClick={() => openEdit(color)}
                        title="Editar"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '4px 8px' }}
                        onClick={() => setDeleteId(color.id)}
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
                          ? 'No hay colores registrados. Crea el primero con "Nuevo Color".'
                          : 'Sin resultados para la búsqueda actual.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > PAGE_SIZE && (
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} label="colores" />
          )}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId === null ? 'Nuevo Color' : 'Editar Color'}
        width="420px"
      >
        <form onSubmit={handleSubmit}>
          <div className={s['colors__modal-body']}>
            <label htmlFor="color-name">Nombre</label>
            <input
              id="color-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Ej: Blanco"
              maxLength={100}
              disabled={saving}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className={s['colors__modal-actions']}>
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
        title="Eliminar color"
        message="¿Seguro que querés eliminar este color? Si tiene materiales asociados, la operación será rechazada por el servidor."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
