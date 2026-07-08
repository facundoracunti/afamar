import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import {
  getAdicionales,
  createAdicional,
  updateAdicional,
  deleteAdicional,
} from '@/api/resources/adicionales';
import { useList } from '../../api/hooks';
import { Modal } from '../../components/ui/Modal/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { useNotify } from '../../context/NotificationContext';
import type { Adicional } from '../../types/adicional';
import styles from './AdicionalesPage.module.css';

const s = styles as unknown as Record<string, string>;

const ADICIONALES_KEY = ['adicionales'] as const;

type AdicionalFormData = {
  name: string;
  detail: string;
  price: number;
  currency: 'ARS' | 'USD';
  is_active: boolean;
  sort_order: number;
};

const EMPTY_FORM: AdicionalFormData = {
  name: '',
  detail: '',
  price: 0,
  currency: 'ARS',
  is_active: true,
  sort_order: 0,
};

export default function AdicionalesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Adicional | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AdicionalFormData>(EMPTY_FORM);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { items: data, loading } = useList<Adicional>(
    [...ADICIONALES_KEY],
    async () => getAdicionales()
  );

  useEffect(() => {
    if (!showForm) setEditItem(null);
  }, [showForm]);

  const handleOpenForm = (item: Adicional | null = null) => {
    if (item) {
      setEditItem(item);
      setForm({
        name: item.name,
        detail: item.detail || '',
        price: item.price,
        currency: item.currency,
        is_active: item.is_active,
        sort_order: item.sort_order,
      });
    } else {
      setEditItem(null);
      setForm({ ...EMPTY_FORM, sort_order: (data?.length || 0) + 1 });
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
        await updateAdicional(editItem.id, form);
        notify('Adicional actualizado', 'success');
      } else {
        await createAdicional(form);
        notify('Adicional creado', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ADICIONALES_KEY });
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

  const handleToggleActive = async (item: Adicional) => {
    try {
      await updateAdicional(item.id, { is_active: !item.is_active });
      queryClient.invalidateQueries({ queryKey: ADICIONALES_KEY });
    } catch (err: unknown) {
      notify((err as Error).message || 'Error al cambiar el estado', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdicional(deleteId);
      queryClient.invalidateQueries({ queryKey: ADICIONALES_KEY });
      notify('Adicional eliminado', 'success');
      setDeleteId(null);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error).message
        || 'Error al eliminar';
      notify(detail, 'error');
    }
  };

  return (
    <div className={s['adicionales']}>
      <PageHeader
        title="Adicionales"
        actions={
          <button className="btn btn-primary" onClick={() => handleOpenForm()}>
            <Plus size={16} /> Nuevo Adicional
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
                  <th>Orden</th>
                  <th>Estado</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((a) => (
                  <tr key={a.id} className={!a.is_active ? s['adicionales__row--inactive'] : ''}>
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
                    <td>{a.sort_order}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: a.is_active ? '#dcfce7' : '#fee2e2',
                          color: a.is_active ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {a.is_active ? 'Activo' : 'Inactivo'}
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
                          className="btn btn-outline"
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleToggleActive(a)}
                          title={a.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {a.is_active ? <PowerOff size={14} /> : <Power size={14} />}
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
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      No hay adicionales configurados. Hacé click en "Nuevo Adicional" para empezar.
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
        title={editItem ? 'Editar Adicional' : 'Nuevo Adicional'}
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
              placeholder="Descripción breve del adicional"
            />
          </div>
          <div className={s['adicionales__form-row']}>
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
            <div className="form-group">
              <label>Orden</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="adicional-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <label htmlFor="adicional-active" style={{ marginBottom: 0 }}>
              Activo (visible en el picker de presupuesto)
            </label>
          </div>
          <div className={s['adicionales__form-actions']}>
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
        title="Eliminar adicional"
        message="¿Eliminar este adicional? La acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}
