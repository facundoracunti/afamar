import React, { useState, useEffect } from 'react';
import { Save, Upload } from 'lucide-react';
import api, { getConfig, updateConfig, uploadLogo } from '../../services/api';
import Loading from '../common/Loading';

const CONFIG_KEYS = [
  { key: 'logo', label: 'Logo (URL)', type: 'text' },
  { key: 'direccion', label: 'Dirección', type: 'text' },
  { key: 'telefono', label: 'Teléfono', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'text' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'tipo_cambio', label: 'Tipo de cambio USD (1 USD = X ARS)', type: 'number' },
  { key: 'encabezado_pdf', label: 'Encabezado PDF', type: 'textarea' },
  { key: 'pie_pdf', label: 'Pie de página PDF', type: 'textarea' },
  { key: 'condiciones_entrega', label: 'Condiciones de entrega', type: 'textarea' },
  { key: 'forma_pago_texto', label: 'Forma de pago (texto)', type: 'textarea' },
  { key: 'garantias', label: 'Garantías', type: 'textarea' },
  { key: 'observaciones_automaticas', label: 'Observaciones automáticas', type: 'textarea' },
];

export default function Configuracion() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getConfig().then((res) => {
      const map = {};
      res.data.forEach((c) => { map[c.key] = c.value; });
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
      const res = await getConfig();
      const map = {};
      res.data.forEach((c) => { map[c.key] = c.value; });
      setConfig(map);
      setLogoFile(null);
    } catch (err) {
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
          return updateConfig(item.key, { value: config[item.key] || '' });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      setMessage('Configuración guardada correctamente');
    } catch (err) {
      setMessage('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Configuración</h1>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <h3 className="section-title">Datos de AFAMAR</h3>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Logo</label>
          {config.logo && (
            <div style={{ marginBottom: 8 }}>
              <img
                src={`${api.defaults.baseURL.replace('/api', '')}/${config.logo}`}
                alt="Logo"
                style={{ maxHeight: 80, borderRadius: 4, border: '1px solid #e2e8f0' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files[0])}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleUploadLogo} disabled={uploading || !logoFile}>
              <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir Logo'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {CONFIG_KEYS.map((item) => (
            <div className="form-group" key={item.key}>
              <label>{item.label}</label>
              {item.type === 'textarea' ? (
                <textarea
                  className="input"
                  rows={3}
                  value={config[item.key] || ''}
                  onChange={(e) => setConfig({ ...config, [item.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input"
                  type={item.type}
                  value={config[item.key] || ''}
                  onChange={(e) => setConfig({ ...config, [item.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        {message && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginTop: 16,
            background: message.includes('Error') ? '#fee2e2' : '#dcfce7',
            color: message.includes('Error') ? '#991b1b' : '#166534',
            fontSize: 14,
          }}>
            {message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}
