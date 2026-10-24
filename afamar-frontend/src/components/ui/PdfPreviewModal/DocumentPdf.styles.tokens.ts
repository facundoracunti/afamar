/**
 * Shared design tokens for the AFAMAR PDF document (`DocumentPdf.tsx`).
 *
 * Extracted from `DocumentPdf.styles.ts` (which stays the public
 * orchestrator). Every colour / font / size used by the style sheets lives
 * here so the different style modules draw from the SAME palette. The
 * values are the approved PDF design — they must not change.
 */
import { SKETCH_STAGE_WIDTH, SKETCH_STAGE_HEIGHT } from '../../../constants';

// The croquis rectángulo que ve el usuario en el editor es el `Stage` de
// Konva con tamaño fijo `SKETCH_STAGE_WIDTH × SKETCH_STAGE_HEIGHT`
// (definido en `components/sketch/CanvasArea`). El `SketchImageExtractor`
// re-renderiza el mismo contenido a esa resolución y exporta un PNG.
//
// Para que el PDF muestre el **mismo rectángulo** (mismo aspect ratio, no
// un rectángulo más chico con bandas negras), el frame de la sección
// "Croquis" tiene que tener exactamente el aspect ratio del stage. El
// ancho se calcula para ocupar casi todo el content area del PDF; la
// altura sale del aspect ratio.
export const SKETCH_STAGE_ASPECT = SKETCH_STAGE_WIDTH / SKETCH_STAGE_HEIGHT;
// A4 landscape = 842pt, paddingHorizontal 34pt → content area ≈ 774pt.
export const SKETCH_CONTENT_WIDTH_LANDSCAPE = 774;
// Two display sizes for the croquis frame:
//  - SKETCH_PDF_WIDTH (≈460pt) is the inline size used when the croquis
//    shares a page with the rest of the document — leaves room for the
//    items table + totals + terms below it.
//  - SKETCH_PDF_LARGE_WIDTH (≈766pt, landscape A4) is the dedicated-page
//    size — when the croquis gets its own A4 page, we flip the page to
//    landscape so the wide editor rectángulo has room to breathe (A4
//    portrait leaves ~630pt of blank space below a 210pt-tall croquis;
//    landscape with the same content width gives 313pt of height).
export const SKETCH_PDF_WIDTH = 460;
export const SKETCH_PDF_HEIGHT = SKETCH_PDF_WIDTH / SKETCH_STAGE_ASPECT;
export const SKETCH_PDF_LARGE_WIDTH = SKETCH_CONTENT_WIDTH_LANDSCAPE - 8; // 4pt margin each side
export const SKETCH_PDF_LARGE_HEIGHT = SKETCH_PDF_LARGE_WIDTH / SKETCH_STAGE_ASPECT;

export const FONT = 'Helvetica';
export const ACCENT = '#B6403A';
export const HEADER_RED = '#B6403A';
export const SLATE_700 = '#334155';
export const SLATE_600 = '#475569';
export const SLATE_900 = '#0f172a';
export const SLATE_800 = '#1e293b';
export const SLATE_500 = '#64748b';
export const SLATE_400 = '#94a3b8';
export const SLATE_300 = '#cbd5e1';
export const SLATE_200 = '#e2e8f0';
export const SLATE_100 = '#f1f5f9';
export const AFAMAR_RED = '#B6403A';
export const GRAPHITE = '#252B33';
export const SECONDARY_TEXT = '#69717C';
export const LIGHT_SURFACE = '#F4F5F6';
export const SOFT_BORDER = '#E5E7EB';
export const SLATE_50 = '#f8fafc';
export const AMBER_700 = '#92400e';
export const AMBER_200 = '#fde68a';
export const AMBER_50 = '#fffbeb';
export const TEXT_DARK = '#1a1a1a';
