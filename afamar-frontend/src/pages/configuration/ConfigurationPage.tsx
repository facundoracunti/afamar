import React, { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { getSettings, updateSettings, uploadLogo } from '@/api/resources/settings';
import { useNotify } from '../../context/NotificationContext';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import TermsEditor from '../../components/ui/TermsEditor/TermsEditor';
import styles from './ConfigurationPage.module.css';

const s = styles as unknown as Record<string, string>;

type ConfigKeyType = 'text' | 'email' | 'textarea' | 'terms';

interface ConfigKey {
  key: string;
  label: string;
  type: ConfigKeyType;
  required?: boolean;
  terms?: boolean;
  rows?: number;
  placeholder?: string;
  help?: string;
}

const CONFIG_KEYS: ConfigKey[] = [
  { key: 'company_name', label: 'Nombre de la empresa', type: 'text', required: true },
  { key: 'company_tagline', label: 'Eslogan / Subtítulo', type: 'text' },
  { key: 'company_address', label: 'Dirección', type: 'text' },
  { key: 'company_phone', label: 'Teléfono', type: 'text' },
  { key: 'company_email', label: 'Email', type: 'email' },
  { key: 'pdf_footer', label: 'Pie de página PDF', type: 'textarea' },
  {
    key: 'budget_terms',
    label: 'Términos del presupuesto',
    type: 'terms',
    terms: true,
    placeholder: 'Ej.: Presupuesto válido por 15 días.',
    help: 'Cada ítem se muestra como un bullet en el PDF generado.',
  },
  {
    key: 'delivery_terms',
    label: 'Condiciones de entrega',
    type: 'terms',
    terms: true,
    placeholder: 'Ej.: Plazo de entrega: 15 días hábiles.',
    help: 'Cada ítem se muestra como un bullet en el PDF generado.',
  },
  {
    key: 'warranty_text',
    label: 'Garantías',
    type: 'terms',
    terms: true,
    placeholder: 'Ej.: Garantía escrita por 12 meses.',
    help: 'Cada ítem se muestra como un bullet en el PDF generado.',
  },
  { key: 'observaciones_automaticas', label: 'Observaciones automáticas', type: 'textarea' },
];

export default function Configuration() {
  type ConfigValue = string | string[];
  const [config, setConfig] = useState<Record<string, ConfigValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const notify = useNotify();

  const buildConfigMap = (data: Record<string, unknown>): Record<string, ConfigValue> => {
    const map: Record<string, ConfigValue> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        map[k] = v as string[];
      } else {
        map[k] = String(v ?? '');
      }
    });
    return map;
  };

  useEffect(() => {
    getSettings().then((res) => {
      const data = (res as unknown as { data: Record<string, unknown> }).data || {};
      setConfig(buildConfigMap(data));
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

  const handleFieldChange = (key: string, value: ConfigValue) => {
    setConfig({ ...config, [key]: value });
    setConfigDirty(true);
  };

  const refreshConfig = async (): Promise<void> => {
    const res = await getSettings();
    const data = (res as unknown as { data: Record<string, unknown> }).data || {};
    setConfig(buildConfigMap(data));
    setLogoFile(null);
    setLogoPreview(null);
    setLogoDirty(false);
    setConfigDirty(false);
  };

  const handleSave = async () => {
    const rawName = config.company_name;
    const companyName = (typeof rawName === 'string' ? rawName : '').trim();
    if (!companyName) {
      notify('El nombre de la empresa es obligatorio', 'error');
      return;
    }

    setSaving(true);
    try {
      if (logoFile) {
        await uploadLogo(logoFile);
      }

      if (configDirty) {
        const payload: Record<string, unknown> = {};
        CONFIG_KEYS.forEach((item) => {
          const current = config[item.key];
          if (item.terms) {
            payload[item.key] = Array.isArray(current) ? current : [];
          } else {
            payload[item.key] = typeof current === 'string' ? current : '';
          }
        });
        await updateSettings(payload);
      }

      // Reload from server so the UI reflects exactly what was persisted
      // (including any default fallbacks applied by the backend).
      await refreshConfig();
      notify('Configuración guardada correctamente', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar configuración';
      console.error('Error al guardar configuración:', err);
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const companyLogo = typeof config.company_logo === 'string' ? config.company_logo : '';
  const logoSrc = logoPreview || companyLogo || null;

  const companyNameValue = typeof config.company_name === 'string' ? config.company_name : '';
  const canSave = !!(companyNameValue.trim()) && (configDirty || logoDirty);

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
            <div className={s['configuration__group']} key={item.key} style={item.terms ? { gridColumn: '1 / -1' } : undefined}>
              <label className={s['configuration__label']}>
                {item.label}
                {item.required && <span style={{ color: '#dc2626' }}> *</span>}
              </label>
              {item.type === 'terms' ? (
                <>
                  <TermsEditor
                    items={Array.isArray(config[item.key]) ? (config[item.key] as string[]) : []}
                    onChange={(next) => handleFieldChange(item.key, next)}
                    placeholder={item.placeholder}
                    hint={item.help}
                  />
                </>
              ) : item.type === 'textarea' ? (
                <textarea
                  className="input"
                  rows={item.rows || 3}
                  value={typeof config[item.key] === 'string' ? (config[item.key] as string) : ''}
                  placeholder={item.placeholder}
                  style={{ lineHeight: 1.5 }}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange(item.key, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  type={item.type}
                  value={typeof config[item.key] === 'string' ? (config[item.key] as string) : ''}
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