// Barrel re-export. New code should import the http client from
// `@/api/http` or individual resources from `@/api/resources/<name>`.
//
// Example:
//   import http from '@/api/http';
//   import { getClients } from '@/api/resources/clients';

import http from './http';
import { getSettings } from './resources/settings';

export { http };
export default http;

export { getSettings };

export * from './resources/dashboard';
export * from './resources/clients';
export * from './resources/budgets';
export * from './resources/workOrders';
export * from './resources/materials';
export * from './resources/poolStock';
export * from './resources/measurements';
export * from './resources/cash';
export * from './resources/reports';
export * from './resources/completedWorks';
export * from './resources/productPhotos';