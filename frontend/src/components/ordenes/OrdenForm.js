import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History, Plus, X } from 'lucide-react';
import { getOrden, createOrden, updateOrden, deleteOrden, getNextNumero, getMateriales, getPiletas, getClientes } from '../../services/api';
import { formatCurrency, badgeClass, conceptosFabricacion } from '../../utils/formatters';
import useEntityForm from '../../hooks/useEntityForm';
import CroquisEditor from './CroquisEditor';
import FirmaCanvas from './FirmaCanvas';
import Loading from '../common/Loading';
import ConfirmDialog from '../common/ConfirmDialog';

const ordenServices = {
  getById: getOrden,
  create: createOrden,
  update: updateOrden,
  delete: deleteOrden,
  getNextNumero: getNextNumero,
  getMateriales: getMateriales,
  getPiletas: getPiletas,
  getClientes: getClientes,
  listPath: '/ordenes',
};

export default function OrdenForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const num = (v) => v === '' ? null : parseFloat(v);

  const {
    form, loading, saving, materiales, piletas, logoUrl,
    showClienteDropdown, menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, clientesFiltrados,
    menuRef, clienteRef,
    setForm,
    setMenuOpen, setDeleteConfirm, setShowClienteDropdown, setShowCroquis,
    update,
    handleClienteSelect, handleTrasladoChange,
    handleSenaMonedaChange, handleSenaMontoChange, handleDolarDiaChange,
    handleDetalleChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit, handleDelete, handleCambioEstadoAccion, handlePrint,
    CONCEPTOS_M2,
  } = useEntityForm({
    entityType: 'orden',
    services: ordenServices,
    defaultEstado: 'MEDICION',
    id,
    navigate,
  });

  if (loading) return <Loading />;

  return (
    <div className="orden-form">
      {/* ===== HEADER ===== */}
      <div className="orden-header" style={{ position: 'relative', overflow: 'hidden' }}>
        {logoUrl && (
          <div style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            opacity: 0.10, pointerEvents: 'none', zIndex: 0,
          }}>
            <img src={logoUrl} alt="Logo AFAMAR" style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>Orden N° {form.numero || 'A-_____'}</span>
            <span className={badgeClass(form.estado)} style={{ fontSize: 13, padding: '4px 14px' }}>{form.estado}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {form.estado === 'MEDICION' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('TALLER')} disabled={saving}
              style={{ background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              🏭 Enviar a Taller
            </button>
          )}
          {form.estado === 'TALLER' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('TERMINADA')} disabled={saving}
              style={{ background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ✅ Finalizar Trabajo
            </button>
          )}
          {form.estado === 'TERMINADA' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('ENTREGADA')} disabled={saving}
              style={{ background: '#9333ea', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              🚚 Entregar al Cliente
            </button>
          )}
          {form.estado === 'ENTREGADA' && (
            <span style={{ background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
              📦 Trabajo Entregado
            </span>
          )}
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={16} /> VISTA PREVIA PDF
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
          <button className="btn btn-outline" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> IMPRIMIR
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn btn-outline" onClick={() => setMenuOpen(!menuOpen)} style={{ padding: '8px 10px' }}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Duplicar orden'); }}>
                  <Copy size={16} /> Duplicar
                </div>
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Exportar PDF'); }}>
                  <FileDown size={16} /> Exportar PDF
                </div>
                <div className="dropdown-item" style={{ color: '#ef4444' }} onClick={() => { setMenuOpen(false); setDeleteConfirm(true); }}>
                  <Trash2 size={16} /> Eliminar
                </div>
                <div className="dropdown-item" onClick={() => { setMenuOpen(false); alert('Historial de cambios'); }}>
                  <History size={16} /> Historial
                </div>
              </div>
            )}
          </div>
          </div>
              </div>
            </div>

      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
        {/* ===== DATOS DEL CLIENTE ===== */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="orden-grid-4">
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={(e) => update('fecha', e.target.value)} disabled={readOnly} />
            </div>
            <div className="form-group" style={{ position: 'relative' }} ref={clienteRef}>
              <label>Cliente</label>
              <input className="input" value={form.cliente_nombre} onChange={(e) => { update('cliente_nombre', e.target.value); setShowClienteDropdown(true); }} onFocus={() => setShowClienteDropdown(true)} placeholder="Nombre del cliente" disabled={readOnly} />
              {showClienteDropdown && clientesFiltrados.length > 0 && form.cliente_nombre && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {clientesFiltrados.map((c) => (
                    <div key={c.id} onClick={() => handleClienteSelect(c)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.telefono} {c.email ? `| ${c.email}` : ''}</div>
                    </div>
                  ))}
              </div>
              )}
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="input" value={form.cliente_telefono_orden} onChange={(e) => update('cliente_telefono_orden', e.target.value)} placeholder="Teléfono" disabled={readOnly} />
            </div>
            <div className="form-group">
              <label>E-mail</label>
              <input className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" disabled={readOnly} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
            <label>Domicilio</label>
            <input className="input" value={form.domicilio} onChange={(e) => update('domicilio', e.target.value)} placeholder="Calle N° - Ciudad - Provincia" disabled={readOnly} />
          </div>
        </div>

        {/* ===== BOTÓN CROQUIS COLAPSABLE ===== */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-outline" onClick={() => setShowCroquis(!showCroquis)}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}>
            {showCroquis ? '👁️' : '📐'} {showCroquis ? 'Ocultar Diseño / Croquis' : 'Activar Diseño / Croquis'}
          </button>
          {!showCroquis && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>El croquis está oculto. Hacé clic para diseñar.</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: showCroquis ? '7fr 3fr' : '1fr', gap: 16, marginTop: 16 }}>
          {showCroquis && (
          <div style={{ minWidth: 0 }}>
            <CroquisEditor croquis={form.croquis} onChange={(v) => update('croquis', v)} readOnly={readOnly} />
          </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="section-title">MATERIALES</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select className="input" style={{ flex: 1, fontSize: 13 }} value="" onChange={(e) => { addMaterial(e.target.value); e.target.value = ''; }} disabled={readOnly}>
                  <option value="">+ AGREGAR MATERIAL</option>
                  {materiales.filter((m) => m.nombre).map((m) => (
                    <option key={m.id} value={m.nombre}>{m.nombre}{m.color ? ` - ${m.color}` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {(form.materiales || []).map((mat, idx) => {
                const m2 = Number(mat.largo || 0) * Number(mat.ancho || 0) * (mat.cantidad || 1);
                const subtotal = m2 * (mat.moneda === 'USD' ? (mat.precio_m2_usd || 0) : (mat.precio_m2 || 0));
                return (
                <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#1a202c' }}>{mat.nombre}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#718096', background: '#edf2f7', padding: '2px 8px', borderRadius: 4 }}>{mat.categoria}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="checkbox" checked={mat.es_alternativa || false}
                          onChange={(e) => updateMaterial(idx, 'es_alternativa', e.target.checked)}
                          disabled={readOnly} style={{ width: 14, height: 14 }} />
                        <span>Alternativa</span>
                      </label>
                      <button type="button" onClick={() => removeMaterial(idx)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} disabled={readOnly}>✕</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Cant.</label>
                      <input className="input" type="number" min="1" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
                        value={mat.cantidad || 1} onChange={(e) => updateMaterial(idx, 'cantidad', num(e.target.value))} disabled={readOnly} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Largo (mts)</label>
                      <input className="input" type="number" step="0.01" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
                        value={mat.largo || ''} onChange={(e) => updateMaterial(idx, 'largo', num(e.target.value))} disabled={readOnly} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Ancho (mts)</label>
                      <input className="input" type="number" step="0.01" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
                        value={mat.ancho || ''} onChange={(e) => updateMaterial(idx, 'ancho', num(e.target.value))} disabled={readOnly} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Precio M²</label>
                      <div style={{ fontSize: 13, fontWeight: 700, color: mat.moneda === 'USD' ? '#059669' : '#1e293b', padding: '5px 6px' }}>
                        {mat.moneda === 'USD' ? `USD ${(mat.precio_m2_usd || 0).toLocaleString('es-AR')}` : `$ ${(mat.precio_m2 || 0).toLocaleString('es-AR')}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7fafc', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 13, color: '#4a5568' }}>
                      <span>Rendimiento: <strong style={{ color: '#2b6cb0' }}>{m2.toFixed(3)} m²</strong></span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#2f855a' }}>
                      Subtotal: {mat.moneda === 'USD' ? `USD ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$ ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                    </div>
                  </div>
                </div>
                );
              })}
              </div>
              {(form.materiales || []).length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Sin materiales agregados. Usá "+ AGREGAR MATERIAL" para sumar.
                </div>
              )}
              <div className="form-group">
                <label>Observaciones del diseño</label>
                <textarea className="input" rows={4} value={form.observaciones_diseno} onChange={(e) => update('observaciones_diseno', e.target.value)} placeholder="Zócalo de 7 cm. Frente de 4 cm. Incluye 3 perforaciones..." disabled={readOnly} />
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECCIÓN INFERIOR: 4 paneles ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Panel 1: Detalle de Fabricación y Adicionales */}
          <div className="card">
            <h3 className="section-title">DETALLE DE FABRICACIÓN Y ADICIONALES</h3>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Material</th>
                  <th>Detalle</th>
                  <th style={{ width: 100 }}>Precio</th>
                  <th style={{ width: 50 }}>Cant</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {form.detalles_fabricacion.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <select className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.concepto} onChange={(e) => handleDetalleChange(i, 'concepto', e.target.value)} disabled={readOnly}>
                        {conceptosFabricacion.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      {CONCEPTOS_M2.includes(d.concepto) ? (
                        <select className="input" style={{ fontSize: 11, padding: '4px 4px' }} value={d.material || ''} onChange={(e) => handleDetalleChange(i, 'material', e.target.value)} disabled={readOnly}>
                          <option value="">--</option>
                          {materiales.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
                        </select>
                      ) : null}
                    </td>
                    <td>
                      {CONCEPTOS_M2.includes(d.concepto) ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.largo ?? ''} onChange={(e) => handleDetalleChange(i, 'largo', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                          <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '30%' }} value={d.ancho ?? ''} onChange={(e) => handleDetalleChange(i, 'ancho', num(e.target.value))} placeholder="Ancho" disabled={readOnly} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#1e40af', whiteSpace: 'nowrap' }}>{d.m2 || 0} m²</span>
                        </div>
                      ) : d.concepto === 'OTRA' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle} onChange={(e) => handleDetalleChange(i, 'detalle', e.target.value)} placeholder="DETALLES" disabled={readOnly} />
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.largo ?? ''} onChange={(e) => handleDetalleChange(i, 'largo', num(e.target.value))} placeholder="Largo" disabled={readOnly} />
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>×</span>
                            <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '35%' }} value={d.mano_de_obra ?? ''} onChange={(e) => handleDetalleChange(i, 'mano_de_obra', num(e.target.value))} placeholder="Mano de obra" disabled={readOnly} />
                          </div>
                        </div>
                      ) : (
                        <input className="input" style={{ fontSize: 12, padding: '4px 8px' }} value={d.detalle} onChange={(e) => handleDetalleChange(i, 'detalle', e.target.value)} placeholder="Cant / ML / cm" disabled={readOnly} />
                      )}
                    </td>
                    <td>
                      {CONCEPTOS_M2.includes(d.concepto) ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.moneda === 'USD' ? '#059669' : '#1e293b' }}>{d.moneda === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                      ) : d.concepto === 'OTRA' ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: d.moneda === 'USD' ? '#059669' : '#1e293b' }}>{d.moneda === 'USD' ? 'USD ' : '$'}{Number(d.precio || 0).toLocaleString('es-AR')}</span>
                      ) : ['TRAFORO DE PILETA', 'TRAFORO DE ANAFE', 'TRAFORO DE PILETA DE APOYO'].includes(d.concepto) ? (
                        <input className="input" type="number" step="0.01" min="0" style={{ fontSize: 12, padding: '4px 8px', width: '100%' }} value={d.precio || ''} onChange={(e) => handleDetalleChange(i, 'precio', num(e.target.value))} placeholder="0" disabled={readOnly} />
                      ) : (
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td>
                      <input className="input" type="number" min="1" style={{ width: 45, fontSize: 12, padding: '4px 6px' }}
                        value={d.cantidad || 1} onChange={(e) => handleDetalleChange(i, 'cantidad', num(e.target.value))} disabled={readOnly} />
                    </td>
                    <td>
                      <button type="button" className="btn btn-outline" style={{ padding: '2px 6px' }} onClick={() => removeDetalle(i)} disabled={readOnly}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-outline" onClick={addDetalle} style={{ marginTop: 8, fontSize: 13, padding: '6px 14px' }} disabled={readOnly}>
              <Plus size={14} /> Agregar concepto
            </button>

            {form.estado === 'MEDICION' && form.detalles_presupuestados.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '2px solid #1e40af', paddingTop: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>📐 COMPARATIVA DE MEDICIÓN</h4>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th style={{ textAlign: 'center' }}>M² Presupuestado</th>
                      <th style={{ textAlign: 'center' }}>M² Medición Real</th>
                      <th style={{ textAlign: 'center' }}>Diferencia Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.detalles_fabricacion.map((d, i) => {
                      if (!CONCEPTOS_M2.includes(d.concepto)) return null;
                      const pres = form.detalles_presupuestados[i];
                      if (!pres) return null;
                      const m2Ori = Number(pres.m2) || 0;
                      const m2Real = d.m2 || 0;
                      const dif = Math.round((m2Real - m2Ori) * 100000) / 100000;
                      const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                      return (
                        <tr key={'med_' + i}>
                          <td style={{ fontWeight: 600 }}>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}</td>
                          <td style={{ textAlign: 'center' }}>{m2Ori.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: difColor }}>
                            {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
                          </td>
                        </tr>
                      );
                    })}
                    {(form.materiales || []).filter((m) => Number(m.largo || 0) * Number(m.ancho || 0) > 0).map((m, i) => {
                      const m2Real = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                      const m2Pres = m.m2_presupuestado || 0;
                      const dif = Math.round((m2Real - m2Pres) * 100000) / 100000;
                      const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                      return (
                        <tr key={'mat_' + i}>
                          <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                          <td style={{ textAlign: 'center' }}>{m2Pres.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: difColor }}>
                            {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Panel 2: Pileta */}
          <div className="card">
            <h3 className="section-title">PILETAS</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select className="input" style={{ flex: 1, fontSize: 13 }} value="" onChange={(e) => { addPileta(e.target.value); e.target.value = ''; }} disabled={readOnly}>
                <option value="">+ AGREGAR PILETA</option>
                {piletas.map((p) => (
                  <option key={p.id} value={p.id}>{p.marca} - {p.modelo} (Stock: {p.cantidad})</option>
                ))}
              </select>
            </div>
            {(form.piletas || []).map((pt, idx) => (
              <div key={idx} style={{ marginBottom: 8, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{pt.marca} - {pt.modelo}</span>
                  <button type="button" onClick={() => removePileta(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }} disabled={readOnly}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ margin: 0, width: 70 }}>
                    <label style={{ fontSize: 11 }}>Cant.</label>
                    <input className="input" type="number" min="1" style={{ fontSize: 12, padding: '4px 6px' }}
                      value={pt.cantidad || 1} onChange={(e) => updatePileta(idx, 'cantidad', num(e.target.value))} disabled={readOnly} />
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 1 }}>
                    <label style={{ fontSize: 11 }}>Moneda</label>
                    <select className="input" style={{ fontSize: 12, padding: '4px 6px' }} value={pt.moneda} onChange={(e) => {
                      const mon = e.target.value;
                      const pdata = piletas.find((p) => p.id === Number(pt.pileta_id));
                      const precio = pdata ? (mon === 'USD' ? (pdata.precio_usd || 0) : (pdata.precio || 0)) : pt.precio;
                      const list = [...form.piletas];
                      list[idx] = { ...list[idx], moneda: mon, precio };
                      update('piletas', list);
                    }} disabled={readOnly}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, flex: 2 }}>
                    <label style={{ fontSize: 11 }}>Precio</label>
                    <input className="input" type="number" step="0.01" style={{ fontSize: 12, padding: '4px 6px' }}
                      value={pt.precio || ''} onChange={(e) => updatePileta(idx, 'precio', num(e.target.value))} disabled={readOnly} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Panel 3: Presupuesto */}
          <div className="card">
            <h3 className="section-title">PRESUPUESTO</h3>

            {(() => {
              const matsMain = hayAlternativas ? (form.materiales || []).filter((m) => !m.es_alternativa) : (form.materiales || []);
              const matsAlt = (form.materiales || []).filter((m) => m.es_alternativa);

              return (
              <div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Columna ARS */}
              <div style={{ flex: hayUSD ? '1 1 280px' : '1 1 100%', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (ARS)</span>
                </div>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                  {(form.detalles_fabricacion || []).filter((d) => Number(d.precio) > 0).map((d, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const precioArs = d.moneda === 'ARS' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) * dd2 : 0);
                    return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{d.largo > 0 && d.concepto === 'OTRA' ? ` (${d.largo} m)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(precioArs * (d.cantidad || 1))}</span>
                    </div>
                    );
                  })}
                  {(matsMain || []).map((m, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const m2 = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                    const sub = m.moneda === 'ARS' ? m2 * (m.precio_m2 || 0) : (dd2 > 0 ? m2 * (m.precio_m2_usd || 0) * dd2 : 0);
                    return sub > 0 ? (
                      <div key={'ma' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Material: {m.nombre} ({m2.toFixed(3)} m²){(m.cantidad || 1) > 1 ? ` x${m.cantidad}` : ''}</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(sub)}</span>
                      </div>
                    ) : null;
                  })}
                  {(form.piletas || []).map((pt, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const precioArs = (pt.moneda || 'ARS') === 'ARS' ? (pt.precio || 0) : (dd2 > 0 ? (pt.precio || 0) * dd2 : 0);
                    return (
                    <div key={'pa' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta {pt.marca} - {pt.modelo}{pt.cantidad > 1 ? ` (x${pt.cantidad})` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(precioArs * (pt.cantidad || 1))}</span>
                    </div>
                    );
                  })}
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Traslado</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.traslado}
                    onChange={(e) => handleTrasladoChange(e.target.value, 'ars')}
                    disabled={readOnly} />
                </div>
                {form.recargo_pct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12, color: '#c0392b' }}>
                  <span>Recargo financiero ({form.cuotas} cuotas - {form.recargo_pct}%)</span>
                  <span style={{ fontWeight: 700 }}>+ {formatCurrency(form.recargo_ars || 0)}</span>
                </div>
                )}
                <div style={{ borderTop: form.recargo_pct > 0 ? '1px solid #e5e7eb' : '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL ARS</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(form.total)}</span>
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Seña recibida</label>
                  <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #d1d5db', overflow: 'hidden', width: 180 }}>
                    <select value={form.sena_moneda || 'ARS'} onChange={(e) => handleSenaMonedaChange(e.target.value)} disabled={readOnly}
                      style={{ background: '#f3f4f6', borderRight: '1px solid #d1d5db', padding: '4px 6px', fontSize: 12, fontWeight: 700, border: 'none', outline: 'none' }}>
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                    <input type="number" className="input" style={{ flex: 1, textAlign: 'right', borderRadius: 0, border: 'none' }}
                      value={form.sena_moneda === 'USD' ? form.sena_usd : form.sena_recibida}
                      onChange={(e) => handleSenaMontoChange(e.target.value)}
                      disabled={readOnly} />
                  </div>
                </div>
                {hayUSD && (
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <label style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e40af' }}>DÓLAR DEL DÍA</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right', fontWeight: 700, color: '#1e40af', borderColor: '#93c5fd' }}
                    value={form.dolar_dia}
                    onChange={(e) => handleDolarDiaChange(e.target.value)}
                    disabled={readOnly} />
                </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Saldo pendiente ARS</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{formatCurrency(form.saldo_pendiente)}</span>
                </div>
              </div>

              {hayUSD && (
              <div style={{ flex: '1 1 280px', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#6b7280' }}>SUBTOTALES (USD)</span>
                </div>
                <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 8, marginBottom: 8 }}>
                  {(form.detalles_fabricacion || []).filter((d) => Number(d.precio) > 0).map((d, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const precioUsd = d.moneda === 'USD' ? Number(d.precio) : (dd2 > 0 ? Number(d.precio) / dd2 : 0);
                    return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}{d.material ? ` - ${d.material}` : ''}{d.m2 > 0 ? ` (${d.m2} m²)` : ''}{(d.cantidad || 1) > 1 ? ` x${d.cantidad}` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (d.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    );
                  })}
                  {(matsMain || []).map((m, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const m2 = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                    const sub = m.moneda === 'USD' ? m2 * (m.precio_m2_usd || 0) : (dd2 > 0 ? m2 * (m.precio_m2 || 0) / dd2 : 0);
                    return sub > 0 ? (
                      <div key={'mu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Material: {m.nombre} ({m2.toFixed(3)} m²){(m.cantidad || 1) > 1 ? ` x${m.cantidad}` : ''}</span>
                        <span style={{ fontWeight: 600 }}>USD {sub.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ) : null;
                  })}
                  {(form.piletas || []).map((pt, i) => {
                    const dd2 = Number(form.dolar_dia);
                    const precioUsd = (pt.moneda || 'ARS') === 'USD' ? (pt.precio || 0) : (dd2 > 0 ? (pt.precio || 0) / dd2 : 0);
                    return (
                    <div key={'pu' + i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Pileta {pt.marca} - {pt.modelo}{pt.cantidad > 1 ? ` (x${pt.cantidad})` : ''}</span>
                      <span style={{ fontWeight: 600 }}>USD {(precioUsd * (pt.cantidad || 1)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    );
                  })}
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Traslado (USD)</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.traslado_usd}
                    onChange={(e) => handleTrasladoChange(e.target.value, 'usd')}
                    disabled={readOnly} />
                </div>
                <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 6, marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>TOTAL USD</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                      USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0 }}>Seña recibida (USD)</label>
                  <input type="number" className="input" style={{ width: 130, textAlign: 'right' }}
                    value={form.sena_usd}
                    onChange={(e) => handleSenaMontoChange(e.target.value)}
                    disabled={readOnly} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontWeight: 600 }}>Saldo pendiente USD</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
                    USD {form.saldo_pendiente_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              )}
                </div>

                {hayAlternativas && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ marginBottom: 12, padding: '8px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>📋 PRESUPUESTO COMPARATIVO</span>
                    <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 8 }}>{matsAlt.length} opciones alternativas</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {matsAlt.map((mat, idx) => {
                      const letra = String.fromCharCode(65 + idx);
                      const dd2 = Number(form.dolar_dia) || 1;
                      const m2 = Number(mat.largo || 0) * Number(mat.ancho || 0) * (mat.cantidad || 1);
                      const costoMat = mat.moneda === 'USD' ? m2 * (mat.precio_m2_usd || 0) : m2 * (mat.precio_m2 || 0);
                      const costoMatArs = mat.moneda === 'USD' ? (dd2 > 0 ? costoMat * dd2 : 0) : costoMat;
                      const fijosArsAlt = (form.detalles_fabricacion || []).reduce((s, d) => s + (Number(d.precio) || 0) * (d.cantidad || 1), 0)
                        + (form.piletas || []).reduce((s, pt) => s + (Number(pt.precio) || 0) * (pt.cantidad || 1), 0)
                        + (Number(form.traslado) || 0);
                      const totalArs = costoMatArs + fijosArsAlt;
                      return (
                        <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4 }}>Alternativa {letra}</span>
                              <span style={{ fontSize: 11, color: '#6b7280' }}>{mat.cantidad || 1} pza. ({m2.toFixed(3)} m²)</span>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', marginBottom: 2 }}>{mat.nombre}</div>
                            {mat.moneda === 'USD' && <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 8 }}>USD {costoMat.toFixed(2)}</div>}
                            <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 6, fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Material:</span>
                                <span style={{ fontWeight: 600, color: '#374151' }}>$ {costoMatArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Trabajos + Piletas + Traslado:</span>
                                <span style={{ fontWeight: 600, color: '#374151' }}>$ {fijosArsAlt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, textAlign: 'center', background: '#fff', borderRadius: 6, padding: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Total alternativa</div>
                            <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>$ {Math.round(totalArs).toLocaleString('es-AR')}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
                    * Todos los totales incluyen la misma configuraci&oacute;n de trabajos, piletas y traslados.
                  </div>
                </div>
                )}
              </div>
              );
            })()}

            {!hayAlternativas && (
            <div>
            <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
              <div style={{ marginTop: 12, padding: '10px 14px', background: form.saldo_pagado ? '#d1fae5' : '#fef9c3', borderRadius: 8, border: `1px solid ${form.saldo_pagado ? '#6ee7b7' : '#fde68a'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13, color: form.saldo_pagado ? '#065f46' : '#92400e' }}>
                      {form.saldo_pagado ? '✓ Saldo cobrado' : '⏳ Saldo pendiente de cobro'}
                    </span>
                    {form.saldo_pagado && form.fecha_pago_saldo && (
                      <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>Fecha: {form.fecha_pago_saldo}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!id) return;
                      const nuevo = !form.saldo_pagado;
                      const hoy = new Date().toISOString().slice(0, 10);
                      const payload = {
                        saldo_pagado: nuevo,
                        fecha_pago_saldo: nuevo ? hoy : null,
                      };
                      if (nuevo) {
                        payload.sena_recibida = Number(form.total);
                        payload.sena_moneda = 'ARS';
                        payload.saldo_pendiente = 0;
                        payload.sena_usd = Number(form.total_usd);
                        payload.saldo_pendiente_usd = 0;
                      }
                      await updateOrden(id, payload);
                      setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' }));
                    }}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: form.saldo_pagado ? '#ef4444' : '#059669', color: 'white',
                    }}
                    disabled={saving}
                  >
                    {form.saldo_pagado ? 'Deshacer' : '✓ Confirmar pago'}
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL ARS</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{formatCurrency(form.total)}</div>
                  </div>
                  {hayUSD && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>TOTAL USD</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>
                      USD {form.total_usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  )}
                </div>
              </div>
              {form.recargo_pct > 0 && form.cuotas > 1 && (
                <div style={{ fontSize: 12, color: '#c0392b', fontWeight: 600, marginTop: 8, marginBottom: 8, textAlign: 'center' }}>
                  {form.cuotas} cuotas mensuales fijas de {formatCurrency(Math.round((form.total || 0) / (form.cuotas || 1)))}
                </div>
              )}
              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Forma de pago</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <select className="input" style={{ flex: 1 }} value={form.forma_pago} onChange={(e) => update('forma_pago', e.target.value)} disabled={readOnly}>
                    <option value="">Seleccionar...</option>
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="TRANSFERENCIA BANCARIA">TRANSFERENCIA BANCARIA</option>
                    <option value="TARJETA DE DÉBITO">TARJETA DE DÉBITO</option>
                    <option value="TARJETA DE CRÉDITO">TARJETA DE CRÉDITO</option>
                  </select>
                  {form.forma_pago === 'TARJETA DE CRÉDITO' && (
                    <select className="input" style={{ width: 160 }} value={form.cuotas || 1} onChange={(e) => update('cuotas', num(e.target.value))} disabled={readOnly}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((c) => {
                        const pct = c <= 2 ? 0 : c * 5;
                        return <option key={c} value={c}>{c} cuota{c > 1 ? 's' : ''} ({pct}%)</option>;
                      })}
                    </select>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Fecha de entrega estimada</label>
                <input type="date" className="input" value={form.fecha_entrega} onChange={(e) => update('fecha_entrega', e.target.value)} disabled={readOnly} />
              </div>
            </div>
            </div>
            )}
          </div>

          {/* Panel 4: Aprobación */}
          <div className="card">
            <h3 className="section-title">APROBACIÓN DEL CLIENTE</h3>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              El cliente aprueba el diseño y presupuesto.
            </p>
            <FirmaCanvas
              value={form.firma_cliente}
              onChange={(v) => update('firma_cliente', v)}
              label="Firma del cliente"
              height={140}
              readOnly={readOnly}
            />
            <div className="form-group" style={{ marginTop: 8 }}>
              <label>Fecha de aprobación</label>
              <input type="date" className="input" value={form.fecha_aprobacion} onChange={(e) => update('fecha_aprobacion', e.target.value)} disabled={readOnly} />
            </div>
          </div>
        </div>

        {/* ===== OBSERVACIONES IMPORTANTES ===== */}
        <div className="card" style={{ marginTop: 16, background: '#f9fafb', border: '1px solid #b91c1c' }}>
          <h3 className="section-title" style={{ color: '#b91c1c' }}>OBSERVACIONES IMPORTANTES PARA EL CLIENTE</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: '#374151', marginBottom: 12 }}>
            <div>✓ No se realizan instalaciones.</div>
            <div>✓ No se realizan entregas con lluvia.</div>
            <div>✓ La descarga se realiza al pie del camión.</div>
            <div>✓ Debe haber personas para descargar.</div>
            <div>✓ El traslado lo realiza únicamente el fletero.</div>
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Observaciones adicionales</label>
            <textarea className="input" rows={3} value={form.observaciones_importantes} onChange={(e) => update('observaciones_importantes', e.target.value)} placeholder="Agregar observaciones adicionales..." disabled={readOnly} />
          </div>
        </div>

        {/* ===== BOTONES FINALES ===== */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/ordenes')}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#b91c1c' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
        </div>
      </form>

      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" />
    </div>
  );
}
