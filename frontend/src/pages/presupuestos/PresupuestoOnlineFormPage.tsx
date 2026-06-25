import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPresupuestoOnline, createPresupuestoOnline, updatePresupuestoOnline, getMateriales, getPiletas, getNextPresupuestoNumero, convertirOnlineAOrden, convertirOnlineAOrdenOpcion } from '../../services/api';
import Loading from '../../components/common/Loading';
import PresupuestoOnlineHeader from '../../components/presupuesto/PresupuestoOnlineHeader';
import OnlineItemsTable, { createOpcion, parseNum, type OpcionTab, type PresupuestoOnlineItemLocal, NOMBRES_ESPECIALES, FILAS_INICIALES, ESPECIALES_INICIALES, emptyItem, TIPOS_ESPECIALES } from '../../components/presupuesto/OnlineItemsTable';
import PresupuestoOnlineTotals from '../../components/presupuesto/PresupuestoOnlineTotals';
import PresupuestoOnlineFooter from '../../components/presupuesto/PresupuestoOnlineFooter';
import type { Material } from '../../types/material';
import type { StockPileta } from '../../types/stockPileta';
import type { ConvertirOpcionResponse } from '../../types/orden';

export default function PresupuestoOnlineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);

  const [opciones, setOpciones] = useState<OpcionTab[]>([createOpcion()]);
  const [activeOpcion, setActiveOpcion] = useState<number>(0);
  const [cliente, setCliente] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [tipoObra, setTipoObra] = useState<string>('');
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dolarDia, setDolarDia] = useState<number>(1000);
  const [totalArs, setTotalArs] = useState<number>(0);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [totalConsolidado, setTotalConsolidado] = useState<number>(0);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [piletas, setPiletas] = useState<StockPileta[]>([]);
  const [numero, setNumero] = useState<string>('');
  const [convertingOpcion, setConvertingOpcion] = useState<number | null>(null);

  useEffect(() => {
    getMateriales({ limit: 500 }).then((r: { data: Material[] }) => setMateriales(r.data));
  }, []);
  useEffect(() => {
    getPiletas({}).then((r: { data: StockPileta[] }) => setPiletas(r.data));
  }, []);
  useEffect(() => {
    if (!isEdit) { getNextPresupuestoNumero().then((r: { data: { numero: string } }) => setNumero(r.data.numero)).catch(() => {}); }
  }, [isEdit]);

  // Auto-recalculate totals when active tab, opciones, or dolarDia change
  useEffect(() => {
    const tab = opciones[activeOpcion];
    if (!tab) return;
    let ars = 0, usd = 0;
    [...tab.items, ...tab.especiales].forEach((i: PresupuestoOnlineItemLocal) => {
      if (i.moneda === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    setTotalArs(Math.round(ars * 100) / 100);
    setTotalUsd(Math.round(usd * 100) / 100);
    const dd = Number(dolarDia) || 0;
    setTotalConsolidado(Math.round((ars + usd * dd) * 100) / 100);
  }, [opciones, activeOpcion, dolarDia]);

  useEffect(() => {
    if (isEdit && id) {
      Promise.all([
        getPresupuestoOnline(id),
        getMateriales({ limit: 500 }),
        getPiletas({}),
      ]).then(([presRes, matRes, piletaRes]: unknown[]) => {
        const d = (presRes as { data: Record<string, unknown> }).data;
        const matData = (matRes as { data: Material[] }).data;
        const piletaData = (piletaRes as { data: StockPileta[] }).data;
        setMateriales(matData);
        setPiletas(piletaData);
        setCliente((d.cliente as string) || '');
        setTelefono((d.telefono as string) || '');
        setTipoObra((d.tipo_obra as string) || '');
        setFecha((d.fecha as string) || new Date().toISOString().slice(0, 10));
        setDolarDia((d.dolar_dia as number) ?? 1000);
        setNumero((d.numero as string) || '');
        const items = d.items as PresupuestoOnlineItemLocal[] | undefined;
        if (items?.length) {
          const opcionMap: Record<number, { normales: PresupuestoOnlineItemLocal[]; especiales: PresupuestoOnlineItemLocal[] }> = {};
          items.forEach((i: PresupuestoOnlineItemLocal) => {
            const op = Math.max(0, i.opcion ?? 0);
            if (!opcionMap[op]) opcionMap[op] = { normales: [], especiales: [] };
            const parsed = { ...i, largo: parseNum(i.largo), ancho: parseNum(i.ancho), m2: parseNum(i.m2), cantidad: Math.max(1, parseNum(i.cantidad)), precio_unitario: parseNum(i.precio_unitario), subtotal: parseNum(i.subtotal), mano_de_obra: parseNum(i.mano_de_obra) };
            if (i.es_unidad || NOMBRES_ESPECIALES.has(i.detalle)) {
              if (parsed.detalle === 'PILETA MOD' && !parsed.pileta_id && d.pileta_id) parsed.pileta_id = Number(d.pileta_id);
              opcionMap[op].especiales.push(parsed);
            } else {
              opcionMap[op].normales.push(parsed);
            }
          });
          const opcionKeys = Object.keys(opcionMap).sort((a: string, b: string) => Number(a) - Number(b));
          if (opcionKeys.length > 0) {
            setOpciones(opcionKeys.map((key: string, idx: number) => {
              const group = opcionMap[Number(key)];
              const espList = group.especiales;
              const matEsp: Record<number, string> = {};
              espList.forEach((e: PresupuestoOnlineItemLocal, i: number) => {
                if (e.material) {
                  matEsp[i] = e.material;
                } else {
                  const matched = matData.find((m: Material) => m.nombre === e.detalle || e.detalle.includes(m.nombre) || m.nombre.includes(e.detalle));
                  if (matched) matEsp[i] = matched.nombre;
                }
              });
              return {
                nombre: `Opción ${idx + 1}`,
                items: group.normales.length ? group.normales : FILAS_INICIALES.map((f) => emptyItem(f.detalle, f.es_unidad)),
                especiales: espList.length ? espList : ESPECIALES_INICIALES.map((e) => emptyItem(e.detalle, e.es_unidad)),
                matEspeciales: matEsp,
              };
            }));
          } else {
            setOpciones([createOpcion()]);
          }
        } else {
          setOpciones([createOpcion()]);
        }
        setLoading(false);
      }).catch((err: unknown) => {
        console.error('Error al cargar presupuesto online', err);
        alert('Error al cargar el presupuesto');
        setLoading(false);
      });
    }
  }, [id, isEdit]);

  const handleConvertirOpcion = async (opcionIdx: number) => {
    if (!id) return;
    if (!window.confirm(`¿Convertir a Orden de Trabajo la "${opciones[opcionIdx]?.nombre}"? Solo se copiarán los ítems de esta opción.`)) return;
    setConvertingOpcion(opcionIdx);
    try {
      const res = await convertirOnlineAOrdenOpcion(id as string, opcionIdx);
      const data: ConvertirOpcionResponse = res.data;
      alert(`Orden ${data.numero} creada a partir de ${opciones[opcionIdx]?.nombre}.`);
      navigate('/admin/ordenes');
    } catch (err: unknown) {
      alert('Error al convertir la opción a orden de trabajo.');
    } finally {
      setConvertingOpcion(null);
    }
  };

  const handleWhatsApp = () => {
    navigator.clipboard.writeText(generarWhatsApp());
    alert('Copiado! Pegalo en WhatsApp.');
  };

  const handleConvertirAll = async () => {
    if (!window.confirm('¿Convertir a Orden de Trabajo? Se copiarán todos los ítems.')) return;
    try {
      const res = await convertirOnlineAOrden(id as string);
      alert(`Orden ${(res.data as Record<string, unknown>).numero} creada.`);
      navigate('/admin/ordenes');
    } catch {
      alert('Error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const allItems = opciones.flatMap((tab: OpcionTab, ti: number) => [
        ...tab.items.map((i: PresupuestoOnlineItemLocal) => ({ ...i, opcion: ti })),
        ...tab.especiales.map((e: PresupuestoOnlineItemLocal) => ({ ...e, opcion: ti })),
      ]);
      let ars = 0, usd = 0;
      allItems.forEach((i: PresupuestoOnlineItemLocal) => { if (i.moneda === 'USD') usd += Number(i.subtotal) || 0; else ars += Number(i.subtotal) || 0; });
      const cons = Math.round((ars + usd * Number(dolarDia)) * 100) / 100;
      const piletaItems = opciones.flatMap((tab: OpcionTab) => tab.especiales).filter((e: PresupuestoOnlineItemLocal) => e.detalle === 'PILETA MOD' && e.pileta_id);
      const payload: Record<string, unknown> = {
        cliente, telefono, tipo_obra: tipoObra, fecha,
        dolar_dia: Number(dolarDia),
        items: allItems,
        total_neto_ars: Math.round(ars * 100) / 100,
        total_neto_usd: Math.round(usd * 100) / 100,
        total_consolidado: cons,
        pileta_id: piletaItems.length ? Number(piletaItems[0].pileta_id) : null,
        pileta_precio: piletaItems.length ? (Number(piletaItems[0].precio_unitario) || 0) : 0,
      };
      if (isEdit) await updatePresupuestoOnline(id as string, payload);
      else await createPresupuestoOnline(payload);
      navigate('/admin/presupuestos-online');
    } catch (err: unknown) { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const generarWhatsApp = (): string => {
    const L: string[] = [];
    L.push('AFAMAR - MARMOLES & GRANITOS');
    L.push('LA PLATA, BS AS');
    if (cliente) L.push(`Cliente: ${cliente}`);
    if (tipoObra) L.push(`Obra: ${tipoObra}`);
    if (fecha) L.push(`Fecha: ${fecha}`);
    L.push('');

    const tabItems = opciones[activeOpcion]?.items || [];
    const activeEsps = opciones[activeOpcion]?.especiales || [];
    const all = [...tabItems, ...activeEsps];
    const itemsUsd = all.filter((i) => i.subtotal > 0 && i.moneda === 'USD');
    const itemsArs = all.filter((i) => i.subtotal > 0 && i.moneda === 'ARS');

    if (itemsUsd.length) {
      L.push('Cotizado en DOLARES (USD):');
      itemsUsd.forEach((i) => {
        let t = `. ${i.detalle}`;
        if (i.es_unidad) t += ` | Cant: ${i.cantidad}`;
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(5)} m2`;
        t += ` | USD ${i.precio_unitario.toFixed(2)}/u = USD ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    if (itemsArs.length) {
      L.push('Cotizado en PESOS (ARS):');
      itemsArs.forEach((i) => {
        let t = `. ${i.detalle}`;
        if (i.es_unidad) t += ` | Cant: ${i.cantidad}`;
        else if (i.m2 > 0) t += ` | ${i.largo}x${i.ancho} = ${i.m2.toFixed(5)} m2`;
        t += ` | $ ${i.precio_unitario.toFixed(2)}/u = $ ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    L.push('==============================');
    if (totalUsd > 0) L.push(`TOTAL USD: USD ${totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalArs > 0) L.push(`TOTAL ARS: $ ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalUsd > 0 && dolarDia > 0) {
      L.push(`Dolar del dia: $${Number(dolarDia).toLocaleString('es-AR')}`);
      L.push(`TOTAL CONSOLIDADO: $ ${totalConsolidado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    }
    L.push('');
    L.push('Consultas al WhatsApp');
    return L.join('\n');
  };

  if (loading) return <Loading />;

  const hayUSD = [...(opciones[activeOpcion]?.items || []), ...(opciones[activeOpcion]?.especiales || [])].some((i: PresupuestoOnlineItemLocal) => i.moneda === 'USD');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } as React.CSSProperties}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>
          {isEdit ? `Presupuesto ${numero}` : `Nuevo Presupuesto ${numero || ''}`}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <PresupuestoOnlineHeader
          numero={numero}
          cliente={cliente}
          telefono={telefono}
          tipoObra={tipoObra}
          fecha={fecha}
          dolarDia={dolarDia}
          onClienteChange={setCliente}
          onTelefonoChange={setTelefono}
          onTipoObraChange={setTipoObra}
          onFechaChange={setFecha}
          onDolarDiaChange={(v: number) => setDolarDia(v)}
        />

        <OnlineItemsTable
          opciones={opciones}
          setOpciones={setOpciones}
          activeOpcion={activeOpcion}
          setActiveOpcion={setActiveOpcion}
          materiales={materiales}
          piletas={piletas}
          isEdit={isEdit}
          convertingOpcion={convertingOpcion}
          onConvertirOpcion={handleConvertirOpcion}
        />

        <PresupuestoOnlineTotals
          totalArs={totalArs}
          totalUsd={totalUsd}
          totalConsolidado={totalConsolidado}
          dolarDia={dolarDia}
          hayUSD={hayUSD}
        />

        <PresupuestoOnlineFooter
          onWhatsApp={handleWhatsApp}
          onCancel={() => navigate('/admin/presupuestos-online')}
          isEdit={isEdit}
          onConvertirAll={handleConvertirAll}
          saving={saving}
        />
      </form>
    </div>
  );
}
