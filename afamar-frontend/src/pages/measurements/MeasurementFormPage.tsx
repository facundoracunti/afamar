import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save, X, Plus } from 'lucide-react';
import { getMeasurement, createMeasurement, updateMeasurement } from '@/api/resources/measurements';
import { getClients } from '@/api/resources/clients';
import { getWorkOrders, getWorkOrder } from '@/api/resources/workOrders';
import { measurementStatuses, formatDate } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { useGet, useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { StatusBadge } from '../../components/ui/StatusBadge';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import ClientSection from '../../components/orders/ClientSection/ClientSection';
import SketchSection from '../../components/sketch/SketchSection/SketchSection';
import ClientInfoCard from '../../components/orders/ClientInfoCard/ClientInfoCard';
import type { Measurement, MeasurementFormData } from '../../types/measurement';
import type { Client } from '../../types/client';
import type { WorkOrderListItem } from '../../types/workOrder';
import { useNotify } from '../../context/NotificationContext';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_LIMIT = 200;

async function fetchWorkOrdersForClient(clientId?: number | null): Promise<WorkOrderListItem[]> {
  const params: Record<string, unknown> = { limit: WORK_ORDERS_LIMIT };
  if (clientId) params.client_id = clientId;
  const res = await getWorkOrders(params);
  return (res.data as WorkOrderListItem[]) || [];
}

export default function MeasurementForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const presetWorkOrderId = searchParams.get('workOrderId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<MeasurementFormData>({
    clientId: null,
    scheduledDate: '',
    scheduledTime: '',
    observations: '',
    sketch: [],
    photos: [],
    status: 'PENDING',
    workOrderId: presetWorkOrderId ? Number(presetWorkOrderId) : '',
  });

  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const { data: measurement, loading } = useGet<Measurement>(
    ['measurement', id],
    async () => {
      if (!id) return {} as Measurement;
      const res = await getMeasurement(id);
      return res.data as Measurement;
    },
    !!id
  );

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

  const [woKey, setWoKey] = useState(0);
  const { items: workOrders, loading: loadingWorkOrders } = useList<WorkOrderListItem>(
    ['work-orders', 'measurement-candidates', woKey, selectedClientId],
    () => fetchWorkOrdersForClient(selectedClientId)
  );

  useEffect(() => {
    if (!measurement) return;
    let sketch: unknown[] = [];
    let photos: string[] = [];
    try { if (measurement.sketch_data) sketch = JSON.parse(measurement.sketch_data); } catch {}
    try { if (measurement.photos_data) photos = JSON.parse(measurement.photos_data); } catch {}
    setForm({
      clientId: measurement.client_id ?? null,
      scheduledDate: measurement.scheduled_date ? measurement.scheduled_date.split('T')[0] : '',
      scheduledTime: measurement.scheduled_time || '',
      observations: measurement.notes || '',
      sketch,
      photos,
      status: measurement.status || 'PENDING',
      workOrderId: measurement.work_order_id ?? '',
    });
    setSelectedClientId(measurement.client_id ?? null);
    setFotosPreview(photos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurement]);

  // When arriving via `?workOrderId=` from the pending-measurement cards, fetch
  // the source work order and pre-fill client + delivery date so the user only
  // has to pick the time + add notes.
  useEffect(() => {
    if (isEdit || !presetWorkOrderId) return;
    let cancelled = false;
    getWorkOrder(presetWorkOrderId)
      .then((res) => {
        if (cancelled) return;
        const wo = res.data as Record<string, unknown> | undefined;
        if (!wo) return;
        const clientId = (wo.client_id as number | null) ?? null;
        const deliveryDate = wo.delivery_date
          ? String(wo.delivery_date).split('T')[0]
          : '';
        setForm((prev) => ({
          ...prev,
          clientId: prev.clientId ?? clientId,
          scheduledDate: prev.scheduledDate || deliveryDate,
        }));
        if (clientId) setSelectedClientId(clientId);
      })
      .catch(() => { /* ignored — user can fill manually */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetWorkOrderId, isEdit]);

  const notify = useNotify();

  const handleChange = (field: keyof MeasurementFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleWorkOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const woId = Number(e.target.value);
    setForm((prev) => {
      if (!woId) return { ...prev, workOrderId: '' };
      const wo = workOrders.find((w) => w.id === woId);
      return {
        ...prev,
        workOrderId: woId,
        clientId: prev.clientId ?? wo?.client_id ?? null,
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
        client_id: form.clientId,
        work_order_id: form.workOrderId === '' || form.workOrderId === undefined ? null : Number(form.workOrderId),
        scheduled_date: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
        scheduled_time: form.scheduledTime || null,
        notes: form.observations || null,
        status: form.status,
        photos_data: JSON.stringify(form.photos),
        sketch_data: JSON.stringify(form.sketch),
      };

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

  const selectedWo = workOrders.find((w) => w.id === (form.workOrderId ? Number(form.workOrderId) : 0));
  const selectedClient = clientes.find((c) => c.id === form.clientId);

  return (
    <div className={s['measurement-form']}>
      <div className={s['measurement-form__header']}>
        <h1 className={s['measurement-form__title']}>{isEdit ? 'Editar Medición' : 'Nueva Medición'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={s['measurement-form__layout']}>
          {/* Left column: WO + measurement fields */}
          <div className={s['measurement-form__left']}>
            {/* Measurement fields card */}
            <div className={s['measurement-form__card']}>
              <div className={s['measurement-form__row']}>
                <div className={s['measurement-form__group']}>
                  <label className={s['measurement-form__label']}>Orden de Trabajo (Medición)</label>
                  <select
                    className="input"
                    value={form.workOrderId ?? ''}
                    onChange={handleWorkOrderChange}
                    disabled={loadingWorkOrders}
                  >
                    <option value="">— Ninguna —</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.number}{wo.client_name ? ` — ${wo.client_name}` : ''} ({t(wo.status)})
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
          </div>

          {/* Right column: client card */}
          <div className={s['measurement-form__right']}>
            <div className={s['measurement-form__card']}>
              <ClientInfoCard client={selectedClient} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}