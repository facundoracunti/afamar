/**
 * Campos exclusivos del cobro con tarjeta: Número de Lote / Cupón (Posnet)
 * y el recargo porcentual opcional de la tarjeta.
 */
import {
  FIELD_HINT_STYLE,
  FIELD_LABEL_OPTIONAL_STYLE,
  FIELD_LABEL_STYLE,
  INPUT_FIELD_STYLE,
} from './PaymentModal.styles';

interface PaymentTarjetaFieldsProps {
  loteCupon: string;
  onLoteCuponChange: (value: string) => void;
  tarjetaSurchargePercent: string;
  onTarjetaSurchargeChange: (value: string) => void;
}

export function PaymentTarjetaFields({
  loteCupon,
  onLoteCuponChange,
  tarjetaSurchargePercent,
  onTarjetaSurchargeChange,
}: PaymentTarjetaFieldsProps) {
  return (
    <div>
      <label htmlFor="lote-cupon" style={FIELD_LABEL_STYLE}>
        Número de Lote / Cupón <span style={FIELD_LABEL_OPTIONAL_STYLE}>(opcional)</span>
      </label>
      <input
        id="lote-cupon"
        type="text"
        value={loteCupon}
        onChange={(e) => onLoteCuponChange(e.target.value)}
        placeholder="Ej: 123456"
        style={INPUT_FIELD_STYLE}
      />
      <p style={FIELD_HINT_STYLE}>(Dato opcional del comprobante impreso del Posnet)</p>

      <label
        htmlFor="tarjeta-surcharge"
        style={{ ...FIELD_LABEL_STYLE, marginTop: '12px' }}
      >
        Recargo Tarjeta (%) <span style={FIELD_LABEL_OPTIONAL_STYLE}>(opcional)</span>
      </label>
      <input
        id="tarjeta-surcharge"
        type="number"
        min={0}
        step={0.5}
        value={tarjetaSurchargePercent}
        onChange={(e) => onTarjetaSurchargeChange(e.target.value)}
        placeholder="Ej: 10"
        style={INPUT_FIELD_STYLE}
      />
      <p style={FIELD_HINT_STYLE}>Si lo dejás vacío o en 0, se cobra el monto base sin recargo.</p>
    </div>
  );
}