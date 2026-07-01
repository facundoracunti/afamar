import { useEffect } from 'react';
import type { EntityFormState, FabricacionDetalle, MaterialEnForm, PiletaEnForm } from '../types';

const CONFIG_CUOTAS: Record<number, number> = {};
for (let i = 1; i <= 12; i++) CONFIG_CUOTAS[i] = i <= 2 ? 0 : i * 5;

export function useCalculosPresupuesto(
  form: EntityFormState,
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>
) {
  useEffect(() => {
    const arsTotal = (form.detalles_fabricacion || []).reduce(
      (sum: number, d: FabricacionDetalle) => sum + (d.moneda === 'USD' ? 0 : (Number(d.precio) || 0) * (d.cantidad || 1)),
      0
    );
    const usdTotal = (form.detalles_fabricacion || []).reduce(
      (sum: number, d: FabricacionDetalle) => sum + (d.moneda === 'USD' ? (Number(d.precio) || 0) * (d.cantidad || 1) : 0),
      0
    );
    const dd = Number(form.dolar_dia);
    const ppArs = (form.piletas || [])
      .filter((pt: PiletaEnForm) => (pt.moneda || 'ARS') !== 'USD')
      .reduce((sum: number, pt: PiletaEnForm) => sum + (pt.precio || 0) * (pt.cantidad || 1), 0);
    const ppUsd = (form.piletas || [])
      .filter((pt: PiletaEnForm) => (pt.moneda || 'ARS') === 'USD')
      .reduce((sum: number, pt: PiletaEnForm) => sum + (pt.precio || 0) * (pt.cantidad || 1), 0);
    const matsMain = (form.materiales || []).filter((m: MaterialEnForm) => !m.es_alternativa);
    const matArs = matsMain
      .filter((m: MaterialEnForm) => m.moneda !== 'USD')
      .reduce((sum: number, m: MaterialEnForm) => sum + (Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1) * (m.precio_m2 || 0)), 0);
    const matUsd = matsMain
      .filter((m: MaterialEnForm) => m.moneda === 'USD')
      .reduce((sum: number, m: MaterialEnForm) => sum + (Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1) * (m.precio_m2_usd || 0)), 0);

    const pctRecargo = form.forma_pago === 'TARJETA DE CRÉDITO' ? (CONFIG_CUOTAS[form.cuotas] || 0) : 0;
    const subtotal = arsTotal + (dd > 0 ? Math.round((usdTotal + matUsd) * dd * 100) / 100 : 0) + matArs + ppArs + (dd > 0 ? Math.round(ppUsd * dd * 100) / 100 : 0);
    const tr = Number(form.traslado) || 0;
    const totalBase = Math.max(0, subtotal + tr);

    const descPct = Number(form.descuento_porcentaje) || 0;
    const descFijo = Number(form.descuento_monto_fijo) || 0;
    let totalConDescuento = totalBase;
    if (descPct > 0) {
      totalConDescuento = Math.round(totalBase * (1 - descPct / 100));
    } else if (descFijo > 0) {
      totalConDescuento = Math.max(0, totalBase - descFijo);
    }

    const recargoArs = Math.round(totalConDescuento * pctRecargo / 100);
    const total = totalConDescuento + recargoArs;

    const senaArs = Number(form.sena_recibida) || 0;
    const senaUsdVal = Number(form.sena_usd) || 0;
    const senaTotalArs = senaArs + (dd > 0 ? senaUsdVal * dd : 0);
    const senaTotalUsd = senaUsdVal + (dd > 0 ? senaArs / dd : 0);
    const saldo = Math.max(0, total - senaTotalArs);

    const tr_usd = Number(form.traslado_usd) || 0;
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
    const saldo_pendiente_usd = Math.max(0, total_usd - senaTotalUsd);

    const esComparativo = (form.materiales || []).some((m: MaterialEnForm) => m.es_alternativa);
    let totalFinal = total;
    let totalUsdFinal = total_usd;
    let saldoFinal = saldo;
    let saldoUsdFinal = saldo_pendiente_usd;
    if (esComparativo) {
      const primeraAlt = (form.materiales || []).find((m: MaterialEnForm) => m.es_alternativa);
      if (primeraAlt) {
        const dd2 = dd || 1;
        const m2 = Number(primeraAlt.largo || 0) * Number(primeraAlt.ancho || 0) * (primeraAlt.cantidad || 1);
        const precioMat = primeraAlt.moneda === 'USD' ? (primeraAlt.precio_m2_usd || 0) : (primeraAlt.precio_m2 || 0);
        const costoMatArs = primeraAlt.moneda === 'USD' ? m2 * precioMat * dd2 : m2 * precioMat;
        const fijosArs = arsTotal + (dd2 > 0 ? usdTotal * dd2 : 0) + ppArs + (dd2 > 0 ? ppUsd * dd2 : 0) + tr;
        const totalAlt = Math.round(costoMatArs + fijosArs);
        const totalAltConDesc = descPct > 0 ? Math.round(totalAlt * (1 - descPct / 100)) : (descFijo > 0 ? Math.max(0, totalAlt - descFijo) : totalAlt);
        totalFinal = totalAltConDesc + (totalAltConDesc > 0 ? Math.round(totalAltConDesc * pctRecargo / 100) : 0);
        const costoMatUsd = primeraAlt.moneda === 'USD' ? m2 * precioMat : m2 * precioMat / dd2;
        const fijosUsd = usdTotal + (dd2 > 0 ? arsTotal / dd2 : 0) + ppUsd + (dd2 > 0 ? ppArs / dd2 : 0) + (dd2 > 0 ? tr / dd2 : 0);
        const totalAltUsd = Math.round((costoMatUsd + fijosUsd) * 100) / 100;
        const totalAltConDescUsd = descPct > 0 ? totalAltUsd * (1 - descPct / 100) : (descFijo > 0 && dd2 > 0 ? Math.max(0, totalAltUsd - descFijo / dd2) : totalAltUsd);
        totalUsdFinal = totalAltConDescUsd + (totalAltConDescUsd > 0 ? Math.round(totalAltConDescUsd * pctRecargo / 100 * 100) / 100 : 0);
        saldoFinal = Math.max(0, totalFinal - senaTotalArs);
        saldoUsdFinal = Math.max(0, totalUsdFinal - senaTotalUsd);
      }
    }

    setForm((prev: EntityFormState) => ({
      ...prev,
      subtotal,
      total: totalFinal,
      recargo_ars: recargoArs,
      recargo_usd: recargoUsd,
      recargo_pct: pctRecargo,
      saldo_pendiente: saldoFinal,
      subtotal_usd,
      total_usd: totalUsdFinal,
      saldo_pendiente_usd: saldoUsdFinal,
    }));
  }, [form.detalles_fabricacion, form.traslado, form.piletas, form.materiales,
      form.sena_moneda, form.sena_recibida, form.traslado_usd, form.sena_usd,
      form.dolar_dia, form.cuotas, form.forma_pago, form.descuento_porcentaje, form.descuento_monto_fijo]);
}
