/**
 * Workshop spec grid + observations of the "FICHA DE TALLER" PDF.
 *
 * Extracted verbatim from `WorkshopSheet.tsx`: same styles, same texts. The
 * whole block is atomic (`wrap={false}`) so it NEVER splits across pages.
 */
import { Text, View } from '@react-pdf/renderer';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import { styles } from './WorkshopSheet.styles';

interface WorkshopSpecsBlockProps {
  specs: WorkshopPdfData['specs'];
  observations: string;
}

/** Grilla de especificaciones (en blanco) + box de observaciones. */
export function WorkshopSpecsBlock({ specs, observations }: WorkshopSpecsBlockProps) {
  return (
    <View style={styles.specsBlock} wrap={false}>
      <Text style={styles.specsTitle}>Especificaciones para el taller</Text>
      <View style={styles.specsGrid}>
        {specs.map((cell) => (
          <View key={cell.key} style={styles.specCell}>
            <View style={styles.specBox}>
              <View style={styles.specLabelRow}>
                <Text style={styles.specLabel}>{cell.label}</Text>
              </View>
              <Text style={styles.specValue}>
                {cell.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.obsBox}>
        <View style={styles.obsTitleRow}>
          <Text style={styles.obsTitle}>Observaciones</Text>
        </View>
        <Text style={styles.obsBody}>{observations}</Text>
      </View>
    </View>
  );
}
