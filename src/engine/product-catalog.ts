import type { ProductPersonaMap } from '../types/index.js';

/** Product and BU ownership used by live event validation and FSM guards. */
export const PRODUCT_PERSONA_MAP: ProductPersonaMap[] = [
  {
    productId: 'product_a',
    productName: 'CloudSecure (Security Platform)',
    relevantPersonas: ['security', 'engineering', 'devops', 'cto'],
    ownerBU: 'BU_Security',
  },
  {
    productId: 'product_b',
    productName: 'DataFlow (Analytics Suite)',
    relevantPersonas: ['data', 'analytics', 'engineering', 'marketing'],
    ownerBU: 'BU_Analytics',
  },
  {
    productId: 'product_c',
    productName: 'FinanceOS (Finance ERP)',
    relevantPersonas: ['finance', 'cfo', 'accounting', 'operations'],
    ownerBU: 'BU_Finance',
  },
];

const PRODUCT_IDS = new Set(PRODUCT_PERSONA_MAP.map(({ productId }) => productId));

export function isSupportedProductId(value: string): boolean {
  return PRODUCT_IDS.has(value);
}
