import { useEffect } from 'react';
import type { EntityFormState, FabricationDetail, MaterialInForm, PoolInForm } from '../types';

const CONFIG_INSTALLMENTS: Record<number, number> = {};
for (let i = 1; i <= 12; i++) CONFIG_INSTALLMENTS[i] = i <= 2 ? 0 : i * 5;

export function useBudgetCalculations(
  form: EntityFormState,
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>
) {
  useEffect(() => {
    const fabricationDetails = form.fabrication_details || [];
    const materialsData = (form.materials_data as unknown as MaterialInForm[]) || [];
    const poolsData = (form.pools_data as unknown as PoolInForm[]) || [];

    const arsTotal = fabricationDetails.reduce(
      (sum: number, d: FabricationDetail) => sum + (d.moneda === 'USD' ? 0 : (Number(d.precio) || 0) * (d.cantidad || 1)),
      0
    );
    const usdTotal = fabricationDetails.reduce(
      (sum: number, d: FabricationDetail) => sum + (d.moneda === 'USD' ? (Number(d.precio) || 0) * (d.cantidad || 1) : 0),
      0
    );
    const dd = Number(form.usd_rate);
    const ppArs = poolsData
      .filter((pt: PoolInForm) => (pt.currency || 'ARS') !== 'USD')
      .reduce((sum: number, pt: PoolInForm) => sum + (pt.price || 0) * (pt.quantity || 1), 0);
    const ppUsd = poolsData
      .filter((pt: PoolInForm) => (pt.currency || 'ARS') === 'USD')
      .reduce((sum: number, pt: PoolInForm) => sum + (pt.price || 0) * (pt.quantity || 1), 0);
    const matsMain = materialsData.filter((m: MaterialInForm) => !m.isAlternative);
    const matArs = matsMain
      .filter((m: MaterialInForm) => m.currency !== 'USD')
      .reduce((sum: number, m: MaterialInForm) => sum + (Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1) * (m.priceM2 || 0)), 0);
    const matUsd = matsMain
      .filter((m: MaterialInForm) => m.currency === 'USD')
      .reduce((sum: number, m: MaterialInForm) => sum + (Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1) * (m.priceM2Usd || 0)), 0);

    const pctRecargo = form.payment_method === 'TARJETA DE CRÉDITO' ? (CONFIG_INSTALLMENTS[form.installments] || 0) : 0;
    const subtotal = arsTotal + (dd > 0 ? Math.round((usdTotal + matUsd) * dd * 100) / 100 : 0) + matArs + ppArs + (dd > 0 ? Math.round(ppUsd * dd * 100) / 100 : 0);
    const tr = Number(form.transport) || 0;
    const totalBase = Math.max(0, subtotal + tr);

    const descPct = Number(form.discount_percentage) || 0;
    const descFijo = Number(form.discount_fixed_amount) || 0;
    let totalConDescuento = totalBase;
    if (descPct > 0) {
      totalConDescuento = Math.round(totalBase * (1 - descPct / 100));
    } else if (descFijo > 0) {
      totalConDescuento = Math.max(0, totalBase - descFijo);
    }

    const recargoArs = Math.round(totalConDescuento * pctRecargo / 100);
    const total = totalConDescuento + recargoArs;

    const depositArs = Number(form.deposit_received) || 0;
    const depositUsdVal = Number(form.deposit_usd) || 0;
    const depositTotalArs = depositArs + (dd > 0 ? depositUsdVal * dd : 0);
    const depositTotalUsd = depositUsdVal + (dd > 0 ? depositArs / dd : 0);
    const balanceDue = Math.max(0, total - depositTotalArs);

    const tr_usd = Number(form.transport_usd) || 0;
    const subtotal_usd = usdTotal + matUsd + ppUsd + (dd > 0 ? (arsTotal + matArs + ppArs) / dd : 0);
    const totalBaseUsd = Math.max(0, subtotal_usd + tr_usd);
    let totalConDescuentoUsd = totalBaseUsd;
    if (descPct > 0) {
      totalConDescuentoUsd = totalBaseUsd * (1 - descPct / 100);
    } else if (descFijo > 0 && dd > 0) {
      totalConDescuentoUsd = Math.max(0, totalBaseUsd - descFijo / dd);
    }
    const recargoUsd = Math.round(totalConDescuentoUsd * pctRecargo / 100);
    const total_usd = totalConDescuentoUsd + recargoUsd;
    const balance_due_usd = Math.max(0, total_usd - depositTotalUsd);

    const hasAlternative = materialsData.some((m: MaterialInForm) => m.isAlternative);
    let totalFinal = total;
    let totalUsdFinal = total_usd;
    let balanceDueFinal = balanceDue;
    let balanceDueUsdFinal = balance_due_usd;
    if (hasAlternative) {
      const primeraAlt = materialsData.find((m: MaterialInForm) => m.isAlternative);
      if (primeraAlt) {
        const dd2 = dd || 1;
        const m2 = Number(primeraAlt.length || 0) * Number(primeraAlt.width || 0) * (primeraAlt.quantity || 1);
        const precioMat = primeraAlt.currency === 'USD' ? (primeraAlt.priceM2Usd || 0) : (primeraAlt.priceM2 || 0);
        const costoMatArs = primeraAlt.currency === 'USD' ? m2 * precioMat * dd2 : m2 * precioMat;
        const fijosArs = arsTotal + (dd2 > 0 ? usdTotal * dd2 : 0) + ppArs + (dd2 > 0 ? ppUsd * dd2 : 0) + tr;
        const totalAlt = Math.round(costoMatArs + fijosArs);
        const totalAltConDesc = descPct > 0 ? Math.round(totalAlt * (1 - descPct / 100)) : (descFijo > 0 ? Math.max(0, totalAlt - descFijo) : totalAlt);
        totalFinal = totalAltConDesc + (totalAltConDesc > 0 ? Math.round(totalAltConDesc * pctRecargo / 100) : 0);
        const costoMatUsd = primeraAlt.currency === 'USD' ? m2 * precioMat : m2 * precioMat / dd2;
        const fijosUsd = usdTotal + (dd2 > 0 ? arsTotal / dd2 : 0) + ppUsd + (dd2 > 0 ? ppArs / dd2 : 0) + (dd2 > 0 ? tr / dd2 : 0);
        const totalAltUsd = Math.round((costoMatUsd + fijosUsd) * 100) / 100;
        const totalAltConDescUsd = descPct > 0 ? totalAltUsd * (1 - descPct / 100) : (descFijo > 0 && dd2 > 0 ? Math.max(0, totalAltUsd - descFijo / dd2) : totalAltUsd);
        totalUsdFinal = totalAltConDescUsd + (totalAltConDescUsd > 0 ? Math.round(totalAltConDescUsd * pctRecargo / 100 * 100) / 100 : 0);
        balanceDueFinal = Math.max(0, totalFinal - depositTotalArs);
        balanceDueUsdFinal = Math.max(0, totalUsdFinal - depositTotalUsd);
      }
    }

    setForm((prev: EntityFormState) => ({
      ...prev,
      subtotal,
      total: totalFinal,
      subtotal_usd,
      total_usd: totalUsdFinal,
      balance_due: balanceDueFinal,
      balance_due_usd: balanceDueUsdFinal,
    }));
  }, [
    JSON.stringify(form.fabrication_details),
    JSON.stringify(form.materials_data),
    JSON.stringify(form.pools_data),
    form.transport, form.transport_usd, form.usd_rate,
    form.payment_method, form.installments,
    form.discount_percentage, form.discount_fixed_amount,
    form.deposit_received, form.deposit_usd, form.deposit_currency,
  ]);
}
