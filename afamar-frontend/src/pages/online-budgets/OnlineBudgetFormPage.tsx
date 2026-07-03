import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getOnlineBudget, createOnlineBudget, updateOnlineBudget, convertOnlineBudgetToWorkOrder, convertOnlineBudgetToWorkOrderOption } from '@/api/resources/onlineBudgets';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getNextBudgetNumber } from '@/api/resources/budgets';
import Loading from '../../components/common/Loading';
import OnlineBudgetHeader from '../../components/budget/OnlineBudgetHeader';
import OnlineItemsTable, { createOption, parseNum, type OptionTab, type OnlineBudgetItemLocal, SPECIAL_NAMES, INITIAL_ROWS, INITIAL_SPECIALS, emptyItem } from '../../components/budget/OnlineItemsTable';
import OnlineBudgetTotals from '../../components/budget/OnlineBudgetTotals';
import OnlineBudgetFooter from '../../components/budget/OnlineBudgetFooter';
import type { Material } from '../../types/material';
import type { Pool } from '../../types/poolStock';
import type { ConvertOptionResponse } from '../../types/workOrder';
import styles from './OnlineBudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function OnlineBudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [saving, setSaving] = useState<boolean>(false);

  const [opciones, setOpciones] = useState<OptionTab[]>([createOption()]);
  const [activeOption, setActiveOption] = useState<number>(0);
  const [client, setClient] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [workType, setWorkType] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [usdRate, setUsdRate] = useState<number>(1000);
  const [totalArs, setTotalArs] = useState<number>(0);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [totalConsolidated, setTotalConsolidated] = useState<number>(0);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [piletas, setPiletas] = useState<Pool[]>([]);
  const [numberValue, setNumberValue] = useState<string>('');
  const [convertingOption, setConvertingOption] = useState<number | null>(null);

  useEffect(() => {
    getMaterials({ limit: 500 }).then((r: { data: Material[] }) => setMateriales(r.data));
  }, []);
  useEffect(() => {
    getPoolStock({}).then((r: { data: Pool[] }) => setPiletas(r.data));
  }, []);
  useEffect(() => {
    if (!isEdit) { getNextBudgetNumber().then((r: { data: { numero: string } }) => setNumberValue(r.data.numero)).catch(() => {}); }
  }, [isEdit]);

  // Auto-recalculate totals when active tab, opciones, or usdRate change
  useEffect(() => {
    const tab = opciones[activeOption];
    if (!tab) return;
    let ars = 0, usd = 0;
    [...tab.items, ...tab.especiales].forEach((i: OnlineBudgetItemLocal) => {
      if (i.currency === 'USD') usd += i.subtotal || 0;
      else ars += i.subtotal || 0;
    });
    setTotalArs(Math.round(ars * 100) / 100);
    setTotalUsd(Math.round(usd * 100) / 100);
    const dd = Number(usdRate) || 0;
    setTotalConsolidated(Math.round((ars + usd * dd) * 100) / 100);
  }, [opciones, activeOption, usdRate]);

  useEffect(() => {
    if (isEdit && id) {
      Promise.all([
        getOnlineBudget(id),
        getMaterials({ limit: 500 }),
        getPoolStock({}),
      ]).then(([presRes, matRes, poolRes]: unknown[]) => {
        const d = (presRes as { data: Record<string, unknown> }).data;
        const matData = (matRes as { data: Material[] }).data;
        const poolData = (poolRes as { data: Pool[] }).data;
        setMateriales(matData);
        setPiletas(poolData);
        setClient((d.client_name as string) || (d.cliente as string) || '');
        setPhone((d.phone as string) || (d.telefono as string) || '');
        setWorkType((d.work_type as string) || (d.tipo_obra as string) || '');
        setDate((d.date as string) || (d.fecha as string) || new Date().toISOString().slice(0, 10));
        setUsdRate((d.usd_rate as number) ?? (d.dolar_dia as number) ?? 1000);
        setNumberValue((d.number as string) || (d.numero as string) || '');
        const items = d.items as OnlineBudgetItemLocal[] | undefined;
        if (items?.length) {
          const opcionMap: Record<number, { normales: OnlineBudgetItemLocal[]; especiales: OnlineBudgetItemLocal[] }> = {};
          items.forEach((i: OnlineBudgetItemLocal) => {
            const op = Math.max(0, i.option ?? 0);
            if (!opcionMap[op]) opcionMap[op] = { normales: [], especiales: [] };
            const parsed = { ...i, length: parseNum(i.length), width: parseNum(i.width), m2: parseNum(i.m2), quantity: Math.max(1, parseNum(i.quantity)), unitPrice: parseNum(i.unitPrice), subtotal: parseNum(i.subtotal), labor: parseNum(i.labor) };
            if (i.isUnit || SPECIAL_NAMES.has(i.detail)) {
              if (parsed.detail === 'PILETA MOD' && !parsed.poolId) parsed.poolId = Number(d.pool_id ?? d.pileta_id);
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
              espList.forEach((e: OnlineBudgetItemLocal, i: number) => {
                if (e.material) {
                  matEsp[i] = e.material;
                } else {
                  const matched = matData.find((m: Material) => m.name === e.detail || e.detail.includes(m.name) || m.name.includes(e.detail));
                  if (matched) matEsp[i] = matched.name;
                }
              });
              return {
                nombre: `Opción ${idx + 1}`,
                items: group.normales.length ? group.normales : INITIAL_ROWS.map((f) => emptyItem(f.detail, f.isUnit)),
                especiales: espList.length ? espList : INITIAL_SPECIALS.map((e) => emptyItem(e.detail, e.isUnit)),
                matEspeciales: matEsp,
              };
            }));
          } else {
            setOpciones([createOption()]);
          }
        } else {
          setOpciones([createOption()]);
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
    setConvertingOption(opcionIdx);
    try {
      const res = await convertOnlineBudgetToWorkOrderOption(id as string, opcionIdx);
      const data: ConvertOptionResponse = res.data;
      alert(`Orden ${data.number} creada a partir de ${opciones[opcionIdx]?.nombre}.`);
      // Converting an online budget option creates a work order, so both
      // lists become stale.
      queryClient.invalidateQueries({ queryKey: ['online-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      navigate('/admin/work-orders');
    } catch (err: unknown) {
      alert('Error al convertir la opción a orden de trabajo.');
    } finally {
      setConvertingOption(null);
    }
  };

  const handleWhatsApp = () => {
    navigator.clipboard.writeText(generarWhatsApp());
    alert('Copiado! Pegalo en WhatsApp.');
  };

  const handleConvertirAll = async () => {
    if (!window.confirm('¿Convertir a Orden de Trabajo? Se copiarán todos los ítems.')) return;
    try {
      const res = await convertOnlineBudgetToWorkOrder(id as string);
      alert(`Orden ${(res.data as Record<string, unknown>).number} creada.`);
      // Both the online-budgets and work-orders lists change.
      queryClient.invalidateQueries({ queryKey: ['online-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      navigate('/admin/work-orders');
    } catch {
      alert('Error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const allItems = opciones.flatMap((tab: OptionTab, ti: number) => [
        ...tab.items.map((i: OnlineBudgetItemLocal) => ({ ...i, option: ti })),
        ...tab.especiales.map((e: OnlineBudgetItemLocal) => ({ ...e, option: ti })),
      ]);
      let ars = 0, usd = 0;
      allItems.forEach((i: OnlineBudgetItemLocal) => { if (i.currency === 'USD') usd += Number(i.subtotal) || 0; else ars += Number(i.subtotal) || 0; });
      const cons = Math.round((ars + usd * Number(usdRate)) * 100) / 100;
      const piletaItems = opciones.flatMap((tab: OptionTab) => tab.especiales).filter((e: OnlineBudgetItemLocal) => e.detail === 'PILETA MOD' && e.poolId);
      const payload: Record<string, unknown> = {
        client_name: client, phone: phone, work_type: workType, date: date,
        usd_rate: Number(usdRate),
        items: allItems,
        total_net_ars: Math.round(ars * 100) / 100,
        total_net_usd: Math.round(usd * 100) / 100,
        total_consolidated: cons,
        pool_id: piletaItems.length ? Number(piletaItems[0].poolId) : null,
        pool_price: piletaItems.length ? (Number(piletaItems[0].unitPrice) || 0) : 0,
      };
      if (isEdit) await updateOnlineBudget(id as string, payload);
      else await createOnlineBudget(payload);
      queryClient.invalidateQueries({ queryKey: ['online-budgets'] });
      navigate('/admin/online-budgets');
    } catch (err: unknown) { alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const generarWhatsApp = (): string => {
    const L: string[] = [];
    L.push('AFAMAR - MARMOLES & GRANITOS');
    L.push('LA PLATA, BS AS');
    if (client) L.push(`Cliente: ${client}`);
    if (workType) L.push(`Obra: ${workType}`);
    if (date) L.push(`Fecha: ${date}`);
    L.push('');

    const tabItems = opciones[activeOption]?.items || [];
    const activeEsps = opciones[activeOption]?.especiales || [];
    const all = [...tabItems, ...activeEsps];
    const itemsUsd = all.filter((i) => i.subtotal > 0 && i.currency === 'USD');
    const itemsArs = all.filter((i) => i.subtotal > 0 && i.currency === 'ARS');

    if (itemsUsd.length) {
      L.push('Cotizado en DOLARES (USD):');
      itemsUsd.forEach((i) => {
        let t = `. ${i.detail}`;
        if (i.isUnit) t += ` | Cant: ${i.quantity}`;
        else if (i.m2 > 0) t += ` | ${i.length}x${i.width} = ${i.m2.toFixed(5)} m2`;
        t += ` | USD ${i.unitPrice.toFixed(2)}/u = USD ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    if (itemsArs.length) {
      L.push('Cotizado en PESOS (ARS):');
      itemsArs.forEach((i) => {
        let t = `. ${i.detail}`;
        if (i.isUnit) t += ` | Cant: ${i.quantity}`;
        else if (i.m2 > 0) t += ` | ${i.length}x${i.width} = ${i.m2.toFixed(5)} m2`;
        t += ` | $ ${i.unitPrice.toFixed(2)}/u = $ ${i.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        L.push(t);
      });
      L.push('');
    }
    L.push('==============================');
    if (totalUsd > 0) L.push(`TOTAL USD: USD ${totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalArs > 0) L.push(`TOTAL ARS: $ ${totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    if (totalUsd > 0 && usdRate > 0) {
      L.push(`Dolar del dia: $${Number(usdRate).toLocaleString('es-AR')}`);
      L.push(`TOTAL CONSOLIDADO: $ ${totalConsolidated.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
    }
    L.push('');
    L.push('Consultas al WhatsApp');
    return L.join('\n');
  };

  if (loading) return <Loading />;

  const hayUSD = [...(opciones[activeOption]?.items || []), ...(opciones[activeOption]?.especiales || [])].some((i: OnlineBudgetItemLocal) => i.currency === 'USD');

  return (
    <div className={s['online-budget-form']}>
      <div className={s['online-budget-form__header']}>
        <h1 className={s['online-budget-form__title']}>
          {isEdit ? `Presupuesto ${numberValue}` : `Nuevo Presupuesto ${numberValue || ''}`}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <OnlineBudgetHeader
          number={numberValue}
          client={client}
          phone={phone}
          workType={workType}
          date={date}
          usdRate={usdRate}
          onClientChange={setClient}
          onPhoneChange={setPhone}
          onWorkTypeChange={setWorkType}
          onDateChange={setDate}
          onUsdRateChange={(v: number) => setUsdRate(v)}
        />

        <OnlineItemsTable
          opciones={opciones}
          setOpciones={setOpciones}
          activeOpcion={activeOption}
          setActiveOpcion={setActiveOption}
          materiales={materiales}
          piletas={piletas}
          isEdit={isEdit}
          convertingOpcion={convertingOption}
          onConvertirOpcion={handleConvertirOpcion}
        />

        <OnlineBudgetTotals
          totalArs={totalArs}
          totalUsd={totalUsd}
          totalConsolidated={totalConsolidated}
          usdRate={usdRate}
          hayUSD={hayUSD}
        />

        <OnlineBudgetFooter
          onWhatsApp={handleWhatsApp}
          onCancel={() => navigate('/admin/online-budgets')}
          isEdit={isEdit}
          onConvertAll={handleConvertirAll}
          saving={saving}
        />
      </form>
    </div>
  );
}
