/**
 * PDF data types shared between build helpers and DocumentPdf renderer.
 *
 * Thin public barrel: every type now lives in a domain module
 * (`pdfTypes.material`, `pdfTypes.measurement`, `pdfTypes.company`,
 * `pdfTypes.section`, `pdfTypes.piece`, `pdfTypes.options`,
 * `pdfTypes.document`). Consumers keep importing from this single path —
 * the public names and their shapes are unchanged.
 */

import type { MaterialInForm, PoolInForm } from '../../types/budget';

export * from './pdfTypes.material';
export * from './pdfTypes.measurement';
export * from './pdfTypes.company';
export * from './pdfTypes.section';
export * from './pdfTypes.piece';
export * from './pdfTypes.options';
export * from './pdfTypes.document';

export type { MaterialInForm, PoolInForm };
