/**
 * Style sheet + shared constants for the AFAMAR PDF document
 * (`DocumentPdf.tsx`). Extracted so the document definition stays a concise
 * orchestrator and every section component (`components/`) draws from the
 * same palette + layout tokens.
 *
 * Thin orchestrator: the palette / sizes live in
 * `DocumentPdf.styles.tokens`, the page frame in
 * `DocumentPdf.styles.page`, the option blocks in
 * `DocumentPdf.styles.options`, the commercial cover cards in
 * `DocumentPdf.styles.cover`, the piece / croquis / table primitives in
 * `DocumentPdf.styles.pieces` and the totals / payment / terms / signature
 * blocks in `DocumentPdf.styles.totals`. This module re-assembles them
 * into the single `styles` object every consumer uses (`styles.<clave>`) —
 * the exposed keys and their values are unchanged.
 */
import { StyleSheet } from '@react-pdf/renderer';
import { pageStyles } from './DocumentPdf.styles.page';
import { optionStyles } from './DocumentPdf.styles.options';
import { coverStyles } from './DocumentPdf.styles.cover';
import { pieceStyles } from './DocumentPdf.styles.pieces';
import { totalStyles } from './DocumentPdf.styles.totals';

export const styles = StyleSheet.create({
  ...pageStyles,
  ...optionStyles,
  ...coverStyles,
  ...pieceStyles,
  ...totalStyles,
});
