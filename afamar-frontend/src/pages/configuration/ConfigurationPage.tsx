import React, { useState, useEffect } from 'react';
import { Save, Upload } from 'lucide-react';
import http from '@/api/http';
import { getSettings, updateSetting, uploadLogo } from '@/api/resources/settings';
import Loading from '../../components/common/Loading';
import styles from './ConfigurationPage.module.css';

const s = styles as unknown as Record<string, string>;

const CONFIG_KEYS = [
  { key: 'company_name', label: 'Nombre de la empresa', type: 'text' },
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
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getSettings().then((res) => {
      const map: Record<string, string> = {};
      const data = (res as unknown as { data: Record<string, unknown> }).data || {};
      Object.entries(data).forEach(([k, v]) => { map[k] = String(v ?? ''); });
      setConfig(map);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setUploading(true);
    setMessage('');
    try {
      await uploadLogo(logoFile);
      setMessage('Logo subido correctamente');
      const res = await getSettings();
      const map: Record<string, string> = {};
      const data = (res as unknown as { data: Record<string, unknown> }).data || {};
      Object.entries(data).forEach(([k, v]) => { map[k] = String(v ?? ''); });
      setConfig(map);
      setLogoFile(null);
    } catch (err: unknown) {
      setMessage('Error al subir logo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const promises = CONFIG_KEYS.map((item) => {
        if (config[item.key] !== undefined) {
          return updateSetting(item.key, { value: config[item.key] || '' });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      setMessage('Configuración guardada correctamente');
    } catch (err: unknown) {
      setMessage('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const isError = message.includes('Error');

  return (
    <div className={s['configuration']}>
      <div className={s['configuration__header']}>
        <h1 className={s['configuration__title']}>Configuración</h1>
      </div>

      <div className={s['configuration__card']}>
        <h3 className={s['configuration__section']}>Datos de AFAMAR</h3>

        <div className={s['configuration__group']}>
          <label className={s['configuration__label']}>Logo</label>
          {config.logo && (
            <img
              src={`${(http.defaults.baseURL || '').replace('/api/v1', '')}/${config.logo}`}
              alt="Logo"
              className={s['configuration__logo']}
            />
          )}
          <div className={s['configuration__logo-row']}>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLogoFile(e.target.files?.[0] || null)}
            />
            <button className="btn btn-primary" onClick={handleUploadLogo} disabled={uploading || !logoFile}>
              <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir Logo'}
            </button>
          </div>
        </div>

        <div className={s['configuration__grid']}>
          {CONFIG_KEYS.map((item) => (
            <div className={s['configuration__group']} key={item.key}>
              <label className={s['configuration__label']}>{item.label}</label>
              {item.type === 'textarea' ? (
                <textarea
                  className="input"
                  rows={3}
                  value={config[item.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConfig({ ...config, [item.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  type={item.type}
                  value={config[item.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, [item.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        {message && (
          <div className={`${s['configuration__message']} ${isError ? s['configuration__message--error'] : s['configuration__message--success']}`}>
            {message}
          </div>
        )}

        <div className={s['configuration__actions']}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}