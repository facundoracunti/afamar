import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save, X, Plus } from 'lucide-react';
import { getMeasurement, createMeasurement, updateMeasurement } from '@/api/resources/measurements';
import { getClients } from '@/api/resources/clients';
import { getWorkOrders } from '@/api/resources/workOrders';
import { measurementStatuses } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { useGet, useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import ClientSection from '../../components/features/orders/ClientSection';
import type { Measurement, MeasurementFormData } from '../../types/measurement';
import type { Client } from '../../types/client';
import { useNotify } from '../../context/NotificationContext';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderOption {
  id: number;
  number: string;
  client_name?: string;
  status: string;
}

export default function MeasurementForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<MeasurementFormData & { workOrderId?: number | '' }>({
    clientName: '',
    clientPhone: '',
    clientAddress: '',
    scheduledDate: '',
    scheduledTime: '',
    observations: '',
    croquis: [],
    photos: [],
    status: 'PENDING',
    workOrderId: '',
  });

  const { data: measurement, loading } = useGet<Measurement>(
    ['measurement', id],
    async () => {
      if (!id) return {} as Measurement;
      const res = await getMeasurement(id);
      return res.data as Measurement;
    },
    !!id
  );

  // List of all clients, kept in local cache. New clients created from the
  // typeahead modal are prepended without re-fetching (which would re-render
  // the form shell and lose the typeahead focus).
  const [clientes, setClientes] = useState<Client[]>([]);
  useEffect(() => {
    let cancelled = false;
    getClients({ limit: 500 }).then((res) => {
      if (cancelled) return;
      setClientes((res.data as Client[]) || []);
    });
    return () => { cancelled = true; };
  }, []);

  const addOrRefreshClientes = useCallback((newClient?: Client) => {
    if (newClient) {
      setClientes((prev) => {
        if (prev.some((c) => c.id === newClient.id)) return prev;
        return [newClient, ...prev];
      });
    } else {
      getClients({ limit: 500 }).then((res) => setClientes((res.data as Client[]) || []));
    }
  }, []);

  // Work orders in MEASUREMENT status — candidates to attach this
  // medición to. The selected number ends up persisted via `workOrderId`
  // (backend will ignore the extra field if not yet wired).
  const { items: workOrders } = useList<WorkOrderOption>(
    ['work-orders', 'measurement-candidates'],
    async () => {
      const res = await getWorkOrders({ status: 'MEASUREMENT', limit: 200 });
      return (res.data as WorkOrderOption[]) || [];
    }
  );

  useEffect(() => {
    if (!measurement) return;
    let croquis: unknown[] = [];
    let photos: string[] = [];
    try { if (measurement.sketch_data) croquis = JSON.parse(measurement.sketch_data); } catch {}
    try { if (measurement.photos_data) photos = JSON.parse(measurement.photos_data); } catch {}
    setForm({
      clientName: measurement.client_name || '',
      clientPhone: measurement.client_phone || '',
      clientAddress: measurement.client_address || '',
      scheduledDate: measurement.scheduled_date ? measurement.scheduled_date.split('T')[0] : '',
      scheduledTime: measurement.scheduled_time || '',
      observations: measurement.notes || '',
      croquis,
      photos,
      status: measurement.status || 'PENDING',
      workOrderId: '',
    });
    setFotosPreview(photos);
  }, [measurement]);

  const notify = useNotify();

  const handleChange = (field: keyof MeasurementFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Selecting a work-order auto-fills the client fields (when not yet set)
  // so the medición starts with the right client + numbers.
  const handleWorkOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const woId = Number(e.target.value);
    setForm((prev) => {
      if (!woId) return { ...prev, workOrderId: '' };
      const wo = workOrders.find((w) => w.id === woId);
      return {
        ...prev,
        workOrderId: woId,
        clientName: prev.clientName || wo?.client_name || '',
        clientPhone: prev.clientPhone || '',
        clientAddress: prev.clientAddress || '',
      };
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files as FileList);
    const readers = files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then((base64s: string[]) => {
      const newFotos = [...form.photos, ...base64s];
      setForm({ ...form, photos: newFotos });
      setFotosPreview(newFotos);
    });
    e.target.value = '';
  };

  const handleRemoveFoto = (index: number): void => {
    const newFotos = form.photos.filter((_: string, i: number) => i !== index);
    setForm({ ...form, photos: newFotos });
    setFotosPreview(newFotos);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
      };
      // Strip the UI-only field the backend ignores. Keep only the schema fields.
      delete payload.workOrderId;
      if (isEdit) {
        await updateMeasurement(id as string, payload);
      } else {
        await createMeasurement(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      notify('Medición guardada correctamente', 'success');
      navigate('/admin/measurements');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error)?.message
        || 'Error al guardar';
      notify(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || (isEdit && !measurement)) return <LoadingSpinner />;

  return (
    <div className={s['measurement-form']}>
      <div className={s['measurement-form__header']}>
        <h1 className={s['measurement-form__title']}>{isEdit ? 'Editar Medición' : 'Nueva Medición'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <ClientSection
          form={(() => {
            // ClientSection expects EntityFormState field names (snake_case).
            // Translate our camelCase form into that shape so the typeahead
            // updates land on the right fields.
            const { clientName, clientPhone, clientAddress, ...rest } = form;
            return {
              ...rest,
              client_id: 0,
              client_name: clientName,
              client_phone: clientPhone,
              client_email: '',
              client_address: clientAddress,
              date: '',
            } as unknown as import('../../types/form').EntityFormState;
          })()}
          readOnly={false}
          update={(field, value) => {
            // Translate back: snake_case (EntityFormState) → camelCase (our form).
            const map: Record<string, string> = {
              client_name: 'clientName',
              client_phone: 'clientPhone',
              client_address: 'clientAddress',
            };
            const key = map[field as string] ?? (field as string);
            setForm((prev) => ({ ...prev, [key]: value } as unknown as typeof prev));
          }}
          clientes={clientes}
          onClientCreated={addOrRefreshClientes}
        />

        <div className={s['measurement-form__card']}>
          <div className={s['measurement-form__row']}>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Orden de Trabajo (Medición)</label>
              <select
                className="input"
                value={form.workOrderId ?? ''}
                onChange={handleWorkOrderChange}
              >
                <option value="">— Ninguna —</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.number}{wo.client_name ? ` — ${wo.client_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Estado</label>
              <select className="input" value={form.status} onChange={handleChange('status')}>
                {measurementStatuses.map((e: string) => <option key={e} value={e}>{t(e)}</option>)}
              </select>
            </div>
          </div>

          <div className={s['measurement-form__row']}>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Fecha programada</label>
              <input className="input" type="date" value={form.scheduledDate} onChange={handleChange('scheduledDate')} />
            </div>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Hora programada</label>
              <input className="input" type="time" value={form.scheduledTime} onChange={handleChange('scheduledTime')} />
            </div>
          </div>

          <div className={s['measurement-form__group']}>
            <label className={s['measurement-form__label']}>Observaciones</label>
            <textarea className="input" rows={3} value={form.observations} onChange={handleChange('observations')} />
          </div>

          <div className={s['measurement-form__group']}>
            <label className={s['measurement-form__label']}>Fotos</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Plus size={16} /> Agregar fotos
            </button>
            {fotosPreview.length > 0 && (
              <div className={s['measurement-form__photos']}>
                {fotosPreview.map((foto: string, idx: number) => (
                  <div key={idx} className={s['measurement-form__photo']}>
                    <img src={foto} alt={`Foto ${idx + 1}`} className={s['measurement-form__photo-img']} />
                    <button
                      type="button"
                      className={s['measurement-form__photo-remove']}
                      onClick={() => handleRemoveFoto(idx)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/measurements')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Medición')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}