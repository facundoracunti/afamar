/**
 * Terms configuration of the work order form.
 *
 * The work order ships two per-document term lists (delivery conditions and
 * warranty) that override the global settings when they are not empty.
 * They are consumed by `EntityFormLayout` through the `terms` slot.
 */
import type { TermConfig } from '../../components/entity/EntityFormLayout';

interface BuildWorkOrderTermsParams {
  deliveryTerms: string[];
  warrantyTerms: string[];
  setDeliveryTerms: (items: string[]) => void;
  setWarrantyTerms: (items: string[]) => void;
  readOnly: boolean;
}

export function buildWorkOrderTerms({
  deliveryTerms,
  warrantyTerms,
  setDeliveryTerms,
  setWarrantyTerms,
  readOnly,
}: BuildWorkOrderTermsParams): TermConfig[] {
  return [
    {
      title: 'Condiciones de Entrega',
      items: deliveryTerms,
      onChange: setDeliveryTerms,
      placeholder: 'Ej: Entrega a convenir, transporte a cargo del cliente…',
      hint: 'Si dejás la lista vacía, se usarán las condiciones globales configuradas.',
      disabled: readOnly,
    },
    {
      title: 'Garantía',
      items: warrantyTerms,
      onChange: setWarrantyTerms,
      placeholder: 'Ej: 12 meses por defectos de fabricación…',
      hint: 'Si dejás la lista vacía, se usará la garantía global configurada.',
      disabled: readOnly,
    },
  ];
}
