import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save, X, Plus } from 'lucide-react';
import { getMeasurement, createMeasurement, updateMeasurement } from '@/api/resources/measurements';
import { measurementStatuses } from '../../utils/formatters';
import type { Measurement, MeasurementFormData } from '../../types/measurement';
import Loading from '../../components/common/Loading';
import styles from './MeasurementFormPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function MeasurementForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
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
  });

  useEffect(() => {
    if (id) {
      getMeasurement(id).then((res: { data: Measurement }) => {
        const d = res.data;
        setForm({
          clientName: d.clientName || '',
          clientPhone: d.clientPhone || '',
          clientAddress: d.clientAddress || '',
          scheduledDate: d.scheduledDate ? d.scheduledDate.split('T')[0] : '',
          scheduledTime: d.scheduledTime || '',
          observations: d.observations || '',
          croquis: d.croquis || [],
          photos: d.photos || [],
          status: d.status || 'PENDING',
        });
        setFotosPreview(d.photos || []);
        setLoading(false);
      });
    }
  }, [id]);

  const handleChange = (field: keyof MeasurementFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [field]: e.target.value });
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
      const payload = {
        ...form,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
      };
      if (isEdit) {
        await updateMeasurement(id as string, payload);
      } else {
        await createMeasurement(payload);
      }
      // Invalidate the measurements list cache so the next mount of
      // /admin/measurements fetches fresh data instead of the stale 5min cache.
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      navigate('/admin/measurements');
    } catch (err: unknown) {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={s['measurement-form']}>
      <div className={s['measurement-form__header']}>
        <h1 className={s['measurement-form__title']}>{isEdit ? 'Editar Medición' : 'Nueva Medición'}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={s['measurement-form__card']}>
          <div className={s['measurement-form__row']}>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Cliente *</label>
              <input className="input" required value={form.clientName} onChange={handleChange('clientName')} />
            </div>
            <div className={s['measurement-form__group']}>
              <label className={s['measurement-form__label']}>Teléfono</label>
              <input className="input" value={form.clientPhone} onChange={handleChange('clientPhone')} />
            </div>
          </div>
          <div className={s['measurement-form__group']}>
            <label className={s['measurement-form__label']}>Dirección</label>
            <input className="input" value={form.clientAddress} onChange={handleChange('clientAddress')} />
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
            <label className={s['measurement-form__label']}>Estado</label>
            <select className="input" value={form.status} onChange={handleChange('status')}>
              {measurementStatuses.map((e: string) => <option key={e} value={e}>{e}</option>)}
            </select>
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

          <div className={s['measurement-form__actions']}>
            <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/measurements')}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} /> {saving ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Crear Medición')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}