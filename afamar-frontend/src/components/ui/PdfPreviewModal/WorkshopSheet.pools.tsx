/**
 * Piletas table of the "FICHA DE TALLER" PDF.
 *
 * Extracted verbatim from `WorkshopSheet.tsx`: same styles, same texts.
 */
import { Text, View } from '@react-pdf/renderer';
import { POOL_MATERIAL_GLOBAL } from '../../../types/budget';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import { styles } from './WorkshopSheet.styles';

interface WorkshopPoolsTableProps {
  pools: WorkshopPdfData['pools'];
}

/** Tabla de piletas con la mesada donde va cada una. */
export function WorkshopPoolsTable({ pools }: WorkshopPoolsTableProps) {
  return (
    <View style={styles.poolsBox}>
      <View style={styles.poolsHeader}>
        <Text style={styles.poolsHeaderModel}>Pileta</Text>
        <Text style={styles.poolsHeaderTarget}>Va en la mesada</Text>
      </View>
      {pools.length > 0 ? (
        pools.map((p) => {
          const global = p.material === POOL_MATERIAL_GLOBAL;
          return (
            <View key={p.label} style={styles.poolsRow}>
              <Text style={styles.poolModel}>{p.label}</Text>
              <View style={styles.poolTargetWrap}>
                {global ? (
                  <Text style={styles.poolGlobal}>Global</Text>
                ) : (
                  <Text style={styles.poolTarget}>{p.display || '—'}</Text>
                )}
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.poolsEmpty}>Sin piletas</Text>
      )}
    </View>
  );
}

interface WorkshopFrontsTableProps {
  fronts: WorkshopPdfData['fronts'];
}

export function WorkshopFrontsTable({ fronts }: WorkshopFrontsTableProps) {
  if (fronts.length === 0) return null;
  return (
    <View style={styles.poolsBox}>
      <View style={styles.poolsHeader}>
        <Text style={styles.poolsHeaderModel}>Frente</Text>
        <Text style={styles.poolsHeaderTarget}>Altura</Text>
      </View>
      {fronts.map((front, index) => (
        <View key={`${front.name}-${index}`} style={styles.poolsRow}>
          <Text style={styles.poolModel}>{front.name}</Text>
          <Text style={styles.poolTarget}>{front.height_cm} cm</Text>
        </View>
      ))}
    </View>
  );
}
