/**
 * Ambient declarations for the Node built-ins used by the test suite.
 *
 * The project does not depend on `@types/node` (the app is browser-only),
 * but a few TEST helpers need a Node builtin — e.g. `node:zlib` to inflate
 * the content streams of a rendered PDF and assert on its printed text
 * (see `src/utils/pdf/multiOptionPdfRender.test.ts`).
 *
 * Only the tiny surface actually used is declared.
 */
declare module 'node:zlib' {
  /** Inflate a zlib (deflate) buffer. */
  export function inflateSync(buffer: Uint8Array): Uint8Array;
}
