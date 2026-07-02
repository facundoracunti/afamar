import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import http from '@/api/http';
import { getSettings, updateSettings, uploadLogo } from '@/api/resources/settings';
import { useNotify } from '../../context/NotificationContext';
import Loading from '../../components/common/Loading';
import styles from './ConfigurationPage.module.css';

const s = styles as unknown as Record<string, string>;

const CONFIG_KEYS = [
  { key: 'company_name', label: 'Nombre de la empresa', type: 'text', required: true },
  { key: 'company_address', label: 'Dirección', type: 'text' },
  { key: 'company_phone', label: 'Teléfono', type: 'text' },
  { key: 'company_email', label: 'Email', type: 'email' },
  { key: 'pdf_footer', label: 'Pie de página PDF', type: 'textarea' },
  { key: 'budget_terms', label: 'Términos del presupuesto', type: 'textarea' },
  { key: 'delivery_terms', label: 'Condiciones de entrega', type: 'textarea' },
  { key: 'warranty_text', label: 'Garantías', type: 'textarea' },
  { key: 'observaciones_automaticas', label: 'Observaciones automáticas', type: 'textarea' },
];

export default function Configuracion() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notify = useNotify();

  useEffect(() => {
    getSettings().then((res) => {
      const data = (res as unknown as { data: Record<string, unknown> }).data || {};
      const map: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => { map[k] = String(v ?? ''); });
      setConfig(map);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleLogoChange = (file: File | null) => {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoDirty(true);
  };

  const handleFieldChange = (key: string, value: string) => {
    setConfig({ ...config, [key]: value });
    setConfigDirty(true);
  };

  const handleSave = async () => {
    const companyName = (config.company_name || '').trim();
    if (!companyName) {
      notify('El nombre de la empresa es obligatorio', 'error');
      return;
    }

    setSaving(true);
    try {
      if (logoFile) {
        await uploadLogo(logoFile);
        setLogoFile(null);
        setLogoPreview(null);
        setLogoDirty(false);
        const res = await getSettings();
        const data = (res as unknown as { data: Record<string, unknown> }).data || {};
        const map: Record<string, string> = {};
        Object.entries(data).forEach(([k, v]) => { map[k] = String(v ?? ''); });
        setConfig(map);
      }

      if (configDirty) {
        const payload: Record<string, string> = {};
        CONFIG_KEYS.forEach((item) => {
          payload[item.key] = config[item.key] || '';
        });
        await updateSettings(payload);
        setConfigDirty(false);
      }

      notify('Configuración guardada correctamente', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar configuración';
      console.error('Error al guardar configuración:', err);
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const logoSrc = logoPreview
    || (config.company_logo ? `${(http.defaults.baseURL || '').replace('/api/v1', '')}${config.company_logo}` : null);

  const canSave = !!((config.company_name || '').trim()) && (configDirty || logoDirty);

  return (
    <div className={s['configuration']}>
      <div className={s['configuration__header']}>
        <h1 className={s['configuration__title']}>Configuración</h1>
      </div>

      <div className={s['configuration__card']}>
        <h3 className={s['configuration__section']}>Datos de AFAMAR</h3>

        <div className={s['configuration__group']}>
          <label className={s['configuration__label']}>Logo</label>
          {logoSrc && (
            <img
              src={logoSrc}
              alt="Logo"
              className={s['configuration__logo']}
            />
          )}
          <div className={s['configuration__logo-row']}>
            <input
              ref={fileInputRef}
              className="input"
              type="file"
              accept="image/*"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLogoChange(e.target.files?.[0] || null)}
            />
          </div>
          {logoDirty && (
            <small style={{ color: '#6b7280', fontSize: '0.85em' }}>
              El logo se subirá al guardar (se convertirá a PNG automáticamente)
            </small>
          )}
        </div>

        <div className={s['configuration__grid']}>
          {CONFIG_KEYS.map((item) => (
            <div className={s['configuration__group']} key={item.key}>
              <label className={s['configuration__label']}>
                {item.label}
                {item.required && <span style={{ color: '#dc2626' }}> *</span>}
              </label>
              {item.type === 'textarea' ? (
                <textarea
                  className="input"
                  rows={3}
                  value={config[item.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(item.key, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  type={item.type}
                  value={config[item.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange(item.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className={s['configuration__actions']}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}