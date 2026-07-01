// Re-exports from the legacy services/* (one file per resource).
// New code should import individual services from their own file (e.g. `@/services/clients`).
// TODO: migrate to src/api/resources/* (one file per resource) per the reference architecture.
import api from "../services/api";
export { api };
export default api;
