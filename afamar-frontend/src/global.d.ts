export {};

declare global {
  interface Window {
    APP_CONFIG?: {
      API_URL?: string;
      /** Public origin used to build client-facing share links (see
       *  `src/utils/whatsapp.ts`). Empty/absent → falls back to
       *  `VITE_PUBLIC_URL` then `window.location.origin`. */
      PUBLIC_URL?: string;
    };
  }

  interface ImportMeta {
    env: {
      /** Build-time public origin for client-facing share links. */
      VITE_PUBLIC_URL?: string;
      /** Backend base URL (e.g. `https://tunnel.ngrok-free.dev/api/v1` or a
       *  relative `/api/v1`). When absolute, its origin is used as a source
       *  for the public share-link origin. */
      VITE_API_BASE_URL?: string;
    };
  }
}