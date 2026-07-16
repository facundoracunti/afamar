import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  getAdditionalWorks,
  createAdditionalWork,
  updateAdditionalWork,
  deleteAdditionalWork,
} from '@/api/resources/additionalWorks';
import { useList } from '../../api/hooks';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { AdditionalWorksTable } from '../../components/common/AdditionalWorksTable';
import { AdditionalWorkForm } from '../../components/common/AdditionalWorkForm';
import { useNotify } from '../../context/NotificationContext';
import type { AdditionalWork, AdditionalWorkType } from '../../types/additionalWork';

const ADDITIONAL_WORKS_KEY = ['additional-works'] as const;

type AdditionalWorkFormData = {
  name: string;
  detail: string;
  price: number;
  currency: 'ARS' | 'USD';
  type: AdditionalWorkType;
  formula_constant: number | null;
};

const EMPTY_FORM: AdditionalWorkFormData = {
  name: '',
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
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { items: data, loading } = useList<AdditionalWork>(
    [...ADDITIONAL_WORKS_KEY],
    async () => getAdditionalWorks()
  );

  useEffect(() => {
    if (!showForm) setEditItem(null);
  }, [showForm]);

  const handleOpenForm = (item: AdditionalWork | null = null) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name,
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al guardar';
      notify(detail, 'error');
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar';
      notify(detail, 'error');
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
        <AdditionalWorksTable
          data={data || []}
          onEdit={handleOpenForm}
          onDelete={(id) => setDeleteId(id)}
        />
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
