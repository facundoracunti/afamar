import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { Plus } from 'lucide-react';
import {
  getAdditionalWorksPaginated,
  createAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork,
} from '@/api/resources/additionalWorks';
import { parseApiError } from '../../utils/error';
import { usePaginatedList } from '../../api/hooks';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { AdditionalWorksTable } from '../../components/common/AdditionalWorksTable';
import { AdditionalWorkForm } from '../../components/common/AdditionalWorkForm';
import { useNotify } from '../../context/NotificationContext';
import type { AdditionalWork, AdditionalWorkCategory, AdditionalWorkType } from '../../types/additionalWork';
import { getAdditionalWorkCategories } from '../../api/resources/additionalWorkCategories';

const ADDITIONAL_WORKS_KEY = ['additional-works'] as const;

type AdditionalWorkFormData = {
  name: string;
  category: string;
  detail: string;
  price: number;
  currency: 'ARS' | 'USD';
  type: AdditionalWorkType;
  formula_constant: number | null;
};

const EMPTY_FORM: AdditionalWorkFormData = {
  name: '',
  category: '',
  detail: '',
  price: 0,
  currency: 'ARS',
  type: 'flat',
  formula_constant: null,
};

export default function AdditionalWorksPage() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<AdditionalWork | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdditionalWorkFormData>(EMPTY_FORM);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [categories, setCategories] = useState<AdditionalWorkCategory[]>([]);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { items: data, loading, total, page, pageSize, setPage } =
    usePaginatedList<AdditionalWork>(
      ADDITIONAL_WORKS_KEY,
      async ({ skip, limit }: { skip: number; limit: number }) =>
        getAdditionalWorksPaginated({ skip, limit }) as Promise<AxiosResponse<AdditionalWork[]>>,
      { pageSize: 25 },
    );
  useEffect(() => { getAdditionalWorkCategories().then(setCategories).catch(() => setCategories([])); }, []);
  const categoryOptions = categories.map((category) => category.name);

  useEffect(() => {
    if (!showForm) setEditItem(null);
  }, [showForm]);

  const handleOpenForm = (item: AdditionalWork | null = null) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name,
        category: item.category || '',
        detail: item.detail || '',
        price: item.price,
        currency: item.currency,
        type: item.type || 'flat',
        formula_constant: item.formula_constant ?? null,
      });
    } else {
      setEditItem(null);
      setForm({ ...EMPTY_FORM });
    }
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify('El nombre es obligatorio', 'error');
      return;
    }
    if (form.type === 'frente' && (form.formula_constant == null || Number.isNaN(Number(form.formula_constant)))) {
      notify('Para tipo Frente / Regrueso indicá el multiplicador de fórmula', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: AdditionalWorkFormData = {
        ...form,
        formula_constant: form.type === 'frente' ? Number(form.formula_constant) : null,
      };
      if (editItem) {
        await updateAdditionalWork(editItem.id, payload);
        notify('Trabajo adicional actualizado', 'success');
      } else {
        await createAdditionalWork(payload);
        notify('Trabajo adicional creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_WORKS_KEY });
      setShowForm(false);
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al guardar'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdditionalWork(deleteId);
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_WORKS_KEY });
      notify('Trabajo adicional eliminado', 'success');
      setDeleteId(null);
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al eliminar'), 'error');
    }
  };

  const handleBulkCategory = async () => {
    const category = bulkCategory.trim();
    if (!category || selectedIds.size === 0) return;
    setSaving(true);
    try {
      await Promise.all([...selectedIds].map((id) => updateAdditionalWork(id, { category })));
      notify(`Categoría aplicada a ${selectedIds.size} trabajos`, 'success');
      setSelectedIds(new Set());
      setBulkCategory('');
      queryClient.invalidateQueries({ queryKey: ADDITIONAL_WORKS_KEY });
    } catch (err: unknown) {
      notify(parseApiError(err, 'Error al aplicar la categoría'), 'error');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="additional-works">
      <PageHeader
        title="Trabajos Adicionales"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenForm()}>
            <Plus size={16} /> Nuevo Trabajo Adicional
          </button>
        }
      />

      {loading ? <LoadingSpinner /> : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <select className="input" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">Elegir categoría para asignar</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button className="btn btn-outline" disabled={!bulkCategory.trim() || selectedIds.size === 0 || saving} onClick={handleBulkCategory}>
              Aplicar categoría a {selectedIds.size || ''} seleccionados
            </button>
            <small>Marcá varios trabajos en la tabla y asignales el mismo grupo de una sola vez.</small>
          </div>
          <AdditionalWorksTable
            data={data || []}
            onEdit={handleOpenForm}
            onDelete={(id) => setDeleteId(id)}
            selectedIds={selectedIds}
            onToggleSelect={(id) => setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
          />
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="trabajos adicionales" />
        </>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Editar Trabajo Adicional' : 'Nuevo Trabajo Adicional'}
        width="640px"
      >
        <AdditionalWorkForm
          editItem={editItem}
          form={form}
          saving={saving}
          onChange={setForm}
          onSubmit={handleSave}
          onCancel={() => setShowForm(false)}
          categoryOptions={categoryOptions}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar trabajo adicional"
        message="¿Estás seguro de que querés eliminar este trabajo adicional? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
