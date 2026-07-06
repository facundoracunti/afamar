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
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import ClientSection from '../../components/orders/ClientSection/ClientSection';
import type { Measurement, MeasurementFormData } from '../../types/measurement';
import type { Client } from '../../types/client';
import { useNotify } from '../../context/NotificationContext';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderOption {
  id: number;
  number: string;
  client_id?: number | null;
  client_name?: string;
  status: string;
}

const WORK_ORDERS_LIMIT = 200;

/**
 * Work-order fetch helper. Pulls the latest N work orders without any status
 * filter, so the dropdown always contains the OT associated with the current
 * medición (which may have advanced beyond `MEASUREMENT` since the row was
 * created). When a client is selected we narrow by `client_id` to keep the
 * list readable.
 */
async function fetchWorkOrdersForClient(clientId?: number | null): Promise<WorkOrderOption[]> {
  const params: Record<string, unknown> = { limit: WORK_ORDERS_LIMIT };
  if (clientId) params.client_id = clientId;
  const res = await getWorkOrders(params);
  return (res.data as WorkOrderOption[]) || [];
}

export default function MeasurementForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<MeasurementFormData>({
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

  // Client currently selected in the typeahead. We resolve it from
  // clientName so the WO dropdown narrows by client once the user picks one.
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

  // Work orders — refresh when the selected client changes (or on first load).
  const [woKey, setWoKey] = useState(0);
  const { items: workOrders, loading: loadingWorkOrders } = useList<WorkOrderOption>(
    ['work-orders', 'measurement-candidates', woKey, selectedClientId],
    () => fetchWorkOrdersForClient(selectedClientId)
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
      workOrderId: measurement.work_order_id ?? '',
    });
    // If the snapshot matches an existing client in our cache, pre-select
    // it so the WO dropdown narrows to that client.
    const match = (measurement.client_name
      && clientes.find((c) => c.name.toLowerCase() === measurement.client_name!.toLowerCase()))
      || null;
    setSelectedClientId(match?.id ?? null);
    setFotosPreview(photos);
  }, [measurement, clientes]);

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
      // Translate form → backend schema. `workOrderId` is UI-only state and
      // maps to the persisted `work_order_id` FK on Measurement.
      const { workOrderId, croquis, photos, ...rest } = form;
      const payload: Record<string, unknown> = {
        ...rest,
        work_order_id: workOrderId === '' || workOrderId === undefined ? null : Number(workOrderId),
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
      };
      // Map field names that the backend uses in English snake_case.
      payload.client_name = (payload as { clientName?: string }).clientName;
      payload.client_phone = (payload as { clientPhone?: string }).clientPhone;
      payload.client_address = (payload as { clientAddress?: string }).clientAddress;
      payload.notes = (payload as { observations?: string }).observations;
      payload.photos_data = JSON.stringify(photos);
      payload.sketch_data = JSON.stringify(croquis);
      delete payload.clientName;
      delete payload.clientPhone;
      delete payload.clientAddress;
      delete payload.observations;
      delete payload.scheduledDate;

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

            // Resolve the client id from the typeahead selection so we can
            // re-fetch WOs filtered by that client. The `clientId` we get
            // back from ClientSection is the typeahead's selected id, but
            // since we don't know which `field` corresponds to it, we also
            // reconcile from the cached `clientes` list using the latest
            // name/phone snapshot.
            setForm((prev) => {
              const next = { ...prev, [key]: value } as typeof prev;
              const match = (next.clientName
                && clientes.find((c) => c.name.toLowerCase() === next.clientName!.toLowerCase()))
                || null;
              const nextId = match?.id ?? null;
              if (nextId !== selectedClientId) {
                setSelectedClientId(nextId);
                setWoKey((k) => k + 1);
              }
              return next;
            });
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
                disabled={loadingWorkOrders}
              >
                <option value="">— Ninguna —</option>
                {workOrders.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    {wo.number}{wo.client_name ? ` — ${wo.client_name}` : ''} ({t(wo.status)})
                  </option>
                ))}
              </select>
              {selectedClientId && (
                <small style={{ color: 'var(--text-muted)' }}>
                  Filtrado por cliente seleccionado.
                </small>
              )}
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
