/**
 * Croquis block of the "FICHA DE TALLER" PDF.
 *
 * Extracted verbatim from `WorkshopSheet.tsx`: same styles, same texts. The
 * image height is computed by the parent (see `WorkshopSheet.tsx`) so the
 * whole sheet stays on ONE page.
 */
import { Image, Text, View } from '@react-pdf/renderer';
import type { WorkshopPdfData } from '../../../utils/pdf/buildWorkshopPdfData';
import { styles } from './WorkshopSheet.styles';

interface WorkshopSketchProps {
  pages: WorkshopPdfData['sketch_pages'];
  imageHeight: number;
}

/** Plano / croquis: una imagen por página de croquis. */
export function WorkshopSketch({ pages, imageHeight }: WorkshopSketchProps) {
  return (
    <View style={styles.sketchBox}>
      <Text style={styles.sketchTitle}>Plano / Croquis</Text>
      {pages.length > 0 ? (
        pages.map((pg) => (
          <View key={(pg.image || '').slice(0, 32)} style={styles.sketchPage} wrap={false}>
            <Text style={styles.sketchPageCaption}>
              {[pg.name, pg.material].filter(Boolean).join(' — ')}
            </Text>
            <Image
              style={[styles.sketchImg, { height: imageHeight }]}
              src={pg.image}
            />
          </View>
        ))
      ) : (
        <Text style={styles.sketchEmpty}>Sin croquis cargado</Text>
      )}
    </View>
  );
}
