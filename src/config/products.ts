import { getProducts } from '@/services/configuration';
export { getProductById } from '@/services/configuration';
/** Compatibility export for existing integrations; UI uses the central accessor. */
export const PRODUCTS_CONFIG = getProducts();
