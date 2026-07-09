import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
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
import { useNotify } from '../../context/NotificationContext';
import type { AdditionalWork } from '../../types/additionalWork';
import styles from './AdditionalWorksPage.module.css';

const s = styles as unknown as Record<string, string>;

const ADDITIONAL_WORKS_KEY = ['additional-works'] as const;

type AdditionalWorkFormData = {
  name: string;
  detail: string;
  price: number;
  currency: 'ARS' | 'USD';
};

const EMPTY_FORM: AdditionalWorkFormData = {
  name: '',
  detail: '',
  price: 0,
  currency: 'ARS',
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
    setSaving(true);
    try {
      if (editItem) {
        await updateAdditionalWork(editItem.id, form);
        notify('Trabajo adicional actualizado', 'success');
      } else {
        await createAdditionalWork(form);
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
    <div className={s['additional-works']}>
      <PageHeader
        title="Trabajos Adicionales"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenForm()}>
            <Plus size={16} /> Nuevo Trabajo Adicional
          </button>
        }
      />

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Detalle</th>
                  <th>Precio</th>
                  <th>Moneda</th>
                  <th style={{ width: 160 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.detail || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {a.currency === 'USD' ? 'USD ' : '$ '}
                      {Number(a.price || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: a.currency === 'USD' ? '#d1fae5' : '#dbeafe',
                          color: a.currency === 'USD' ? '#065f46' : '#1e40af',
                        }}
                      >
                        {a.currency}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleOpenForm(a)}
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px' }}
                          onClick={() => setDeleteId(a.id)}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data || data.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No hay trabajos adicionales configurados. Hacé click en "Nuevo Trabajo Adicional" para empezar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editItem ? 'Editar Trabajo Adicional' : 'Nuevo Trabajo Adicional'}
        width="600px"
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              className="input"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Pulido de bordes, Traslado, etc."
            />
          </div>
          <div className="form-group">
            <label>Detalle</label>
            <textarea
              className="input"
              rows={2}
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              placeholder="Descripción breve del trabajo adicional"
            />
          </div>
          <div className={s['additional-works__form-row']}>
            <div className="form-group">
              <label>Precio</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Moneda</label>
              <select
                className="input"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as 'ARS' | 'USD' })}
              >
                <option value="ARS">ARS (Pesos)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
          </div>
          <div className={s['additional-works__form-actions']}>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {editItem ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
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
