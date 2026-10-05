/** Compatibility exports. Active UI obtains assets through the configuration accessor. */
import { getStudioConfig } from '@/services/configuration';
export const STUDIO_LOGO_BASE64 = getStudioConfig().logo;
export const REPRESENTATIVE_SEAL_BASE64 = getStudioConfig().seal;
