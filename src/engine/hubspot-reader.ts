// ============================================================================
// OneMetric Campaign Segmentation Engine — HubSpot CRM Buying Committee Reader
// ============================================================================
// Performs domain-level stakeholder discovery via HubSpot REST API v3:
//   1. Search Contacts by Domain (POST /crm/v3/objects/contacts/search)
//   2. Fetch Account Pipeline Deals & Assigned AE
//   3. High-fidelity calibrated fallback committee for simulation & offline mode
// ============================================================================

import type { Contact, Account, Deal } from '../types/index.js';
import { getDefaultConfig } from './scoring.js';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

export const REQUIRED_CONTACT_PROPERTIES = ['current_campaign', 'touch_count_7d'] as const;

export class HubSpotContactSchemaError extends Error {
  readonly missingProperties: string[];
  readonly statusCode = 424;

  constructor(missingProperties: string[] = [...REQUIRED_CONTACT_PROPERTIES]) {
    super(`HubSpot contact schema is incomplete. Required contact properties are unavailable: ${missingProperties.join(', ')}.`);
    this.name = 'HubSpotContactSchemaError';
    this.missingProperties = missingProperties;
  }
}

export async function inspectHubSpotContactSchema(tokenOverride?: string): Promise<{
  ready: boolean;
  missingProperties: string[];
}> {
  const token = tokenOverride || process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return { ready: false, missingProperties: [...REQUIRED_CONTACT_PROPERTIES] };
  const checks = await Promise.all(REQUIRED_CONTACT_PROPERTIES.map(async (property) => {
    try {
      const response = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/properties/contacts/${property}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      });
      return response.ok ? null : property;
    } catch {
      return property;
    }
  }));
  const missingProperties = checks.filter((property): property is typeof REQUIRED_CONTACT_PROPERTIES[number] => property !== null);
  return { ready: missingProperties.length === 0, missingProperties };
}

// ---------------------------------------------------------------------------
// Calibrated Enterprise Buying Committees (Domain-Level Ground Truth)
// ---------------------------------------------------------------------------

export const CALIBRATED_COMMITTEES: Record<string, { account: Account; contacts: Contact[] }> = {
  'techcorp.com': {
    account: {
      accountId: 'acc_techcorp_001',
      domain: 'techcorp.com',
      name: 'TechCorp International',
      industry: 'Enterprise SaaS & Cloud Infrastructure',
      tier: 1,
      ownerBU: 'BU_Analytics',
      activeDeals: [
        {
          dealId: 'deal_tc_120k',
          dealStage: 'Demo Scheduled',
          amount: 120000,
          owner: 'Strategic AE John Smith',
          productId: 'product_b',
        },
      ],
    },
    contacts: [
      {
        contactId: 'con_sarah_001',
        email: 'sarah.chen@techcorp.com',
        firstName: 'Sarah',
        lastName: 'Chen',
        jobTitle: 'VP of Engineering',
        persona: 'engineering',
        accountId: 'acc_techcorp_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        lastTouchDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        touchCount7d: 1, // Within fatigue limit (1/2) -> Eligible for cooldown hold
      },
      {
        contactId: 'con_alex_002',
        email: 'alex.rivera@techcorp.com',
        firstName: 'Alex',
        lastName: 'Rivera',
        jobTitle: 'DevOps & Reliability Lead',
        persona: 'devops',
        accountId: 'acc_techcorp_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        lastTouchDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        touchCount7d: 2, // Fatigue cap hit (2/2) -> Must PAUSE sequence
      },
      {
        contactId: 'con_marcus_003',
        email: 'marcus.vance@techcorp.com',
        firstName: 'Marcus',
        lastName: 'Vance',
        jobTitle: 'Chief Information Security Officer (CISO)',
        persona: 'security',
        accountId: 'acc_techcorp_001',
        currentCampaign: null, // Unenrolled -> Exact buyer persona for Product A (CloudSecure)
        enrollmentDate: null,
        lastTouchDate: null,
        touchCount7d: 0, // Fresh contact -> Direct candidate for Product A enrollment
      },
      {
        contactId: 'con_rachel_004',
        email: 'rachel.green@techcorp.com',
        firstName: 'Rachel',
        lastName: 'Green',
        jobTitle: 'Director of Financial Planning',
        persona: 'finance',
        accountId: 'acc_techcorp_001',
        currentCampaign: 'product_c', // Enrolled in FinanceOS
        enrollmentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastTouchDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        touchCount7d: 0, // Persona mismatch for security -> Must stay in FinanceOS
      },
    ],
  },
  'stripe.com': {
    account: {
      accountId: 'acc_stripe_001',
      domain: 'stripe.com',
      name: 'Stripe Inc.',
      industry: 'Fintech & Global Payment Infrastructure',
      tier: 1,
      ownerBU: 'BU_Security',
      activeDeals: [
        {
          dealId: 'deal_stripe_250k',
          dealStage: 'Demo Scheduled',
          amount: 250000,
          owner: 'Strategic AE Sarah Jenkins',
          productId: 'product_a',
        },
      ],
    },
    contacts: [
      {
        contactId: 'con_stripe_001',
        email: 'david.sterling@stripe.com',
        firstName: 'David',
        lastName: 'Sterling',
        jobTitle: 'Head of Information Security',
        persona: 'security',
        accountId: 'acc_stripe_001',
        currentCampaign: null,
        enrollmentDate: null,
        lastTouchDate: null,
        touchCount7d: 0,
      },
      {
        contactId: 'con_stripe_002',
        email: 'clara.simmons@stripe.com',
        firstName: 'Clara',
        lastName: 'Simmons',
        jobTitle: 'VP of Financial Infrastructure',
        persona: 'finance',
        accountId: 'acc_stripe_001',
        currentCampaign: 'product_c',
        enrollmentDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        touchCount7d: 1,
      },
      {
        contactId: 'con_stripe_003',
        email: 'elena.rostova@stripe.com',
        firstName: 'Elena',
        lastName: 'Rostova',
        jobTitle: 'Principal Cloud Platform Architect',
        persona: 'engineering',
        accountId: 'acc_stripe_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 15 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        touchCount7d: 1,
      },
      {
        contactId: 'con_stripe_004',
        email: 'marcus.brody@stripe.com',
        firstName: 'Marcus',
        lastName: 'Brody',
        jobTitle: 'SRE Reliability Engineering Lead',
        persona: 'devops',
        accountId: 'acc_stripe_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 25 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        touchCount7d: 2, // Fatigue cap hit
      },
    ],
  },
  'snowflake.com': {
    account: {
      accountId: 'acc_snowflake_001',
      domain: 'snowflake.com',
      name: 'Snowflake Inc.',
      industry: 'Cloud Data Platform & Analytics',
      tier: 1,
      ownerBU: 'BU_Analytics',
      activeDeals: [
        {
          dealId: 'deal_snow_180k',
          dealStage: 'Proposal Review',
          amount: 180000,
          owner: 'Enterprise Director Michael Scott',
          productId: 'product_b',
        },
      ],
    },
    contacts: [
      {
        contactId: 'con_snow_001',
        email: 'benoit.dupont@snowflake.com',
        firstName: 'Benoit',
        lastName: 'Dupont',
        jobTitle: 'Chief Technology Officer',
        persona: 'engineering',
        accountId: 'acc_snowflake_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 12 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        touchCount7d: 1,
      },
      {
        contactId: 'con_snow_002',
        email: 'maya.lin@snowflake.com',
        firstName: 'Maya',
        lastName: 'Lin',
        jobTitle: 'Director of Cloud Governance & SecOps',
        persona: 'security',
        accountId: 'acc_snowflake_001',
        currentCampaign: null,
        enrollmentDate: null,
        lastTouchDate: null,
        touchCount7d: 0,
      },
      {
        contactId: 'con_snow_003',
        email: 'jason.brody@snowflake.com',
        firstName: 'Jason',
        lastName: 'Brody',
        jobTitle: 'Principal Data Engineer',
        persona: 'analytics',
        accountId: 'acc_snowflake_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 18 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        touchCount7d: 0,
      },
    ],
  },
  'datadog.com': {
    account: {
      accountId: 'acc_datadog_001',
      domain: 'datadog.com',
      name: 'Datadog Inc.',
      industry: 'Cloud Observability & Security Monitoring',
      tier: 2,
      ownerBU: 'BU_Analytics',
      activeDeals: [], // No active deal -> Fully automated routing
    },
    contacts: [
      {
        contactId: 'con_dd_001',
        email: 'alexis.v@datadog.com',
        firstName: 'Alexis',
        lastName: 'Vance',
        jobTitle: 'VP Cloud Architecture',
        persona: 'engineering',
        accountId: 'acc_datadog_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 8 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        touchCount7d: 1,
      },
      {
        contactId: 'con_dd_002',
        email: 'tariq.mansoor@datadog.com',
        firstName: 'Tariq',
        lastName: 'Al-Mansoor',
        jobTitle: 'Security Operations Lead',
        persona: 'security',
        accountId: 'acc_datadog_001',
        currentCampaign: null,
        enrollmentDate: null,
        lastTouchDate: null,
        touchCount7d: 0,
      },
    ],
  },
  'uber.com': {
    account: {
      accountId: 'acc_uber_001',
      domain: 'uber.com',
      name: 'Uber Technologies',
      industry: 'Global Mobility & Platform Logistics',
      tier: 1,
      ownerBU: 'BU_Cloud',
      activeDeals: [
        {
          dealId: 'deal_uber_95k',
          dealStage: 'Contract Sent',
          amount: 95000,
          owner: 'Strategic AE Lisa Thorne',
          productId: 'product_a',
        },
      ],
    },
    contacts: [
      {
        contactId: 'con_uber_001',
        email: 'ryan.patel@uber.com',
        firstName: 'Ryan',
        lastName: 'Patel',
        jobTitle: 'Director of Distributed Systems',
        persona: 'engineering',
        accountId: 'acc_uber_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 14 * 86400000).toISOString(),
        lastTouchDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        touchCount7d: 2, // Fatigue cap reached!
      },
      {
        contactId: 'con_uber_002',
        email: 'priya.nair@uber.com',
        firstName: 'Priya',
        lastName: 'Nair',
        jobTitle: 'Head of Infrastructure Compliance',
        persona: 'security',
        accountId: 'acc_uber_001',
        currentCampaign: null,
        enrollmentDate: null,
        lastTouchDate: null,
        touchCount7d: 0,
      },
    ],
  },
  'megacorp.com': {
    account: {
      accountId: 'acc_enterprise_001',
      domain: 'megacorp.com',
      name: 'MegaCorp Enterprise',
      industry: 'Financial Services',
      tier: 1,
      ownerBU: 'BU_Analytics',
      activeDeals: [
        {
          dealId: 'deal_001',
          dealStage: 'Demo Scheduled',
          amount: 120000,
          owner: 'ae_john_smith',
          productId: 'product_b',
        },
      ],
    },
    contacts: [
      {
        contactId: '557293910732',
        email: 'sarah.chen@megacorp.com',
        firstName: 'Sarah',
        lastName: 'Chen',
        jobTitle: 'VP Engineering',
        persona: 'engineering',
        accountId: 'acc_enterprise_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        lastTouchDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        touchCount7d: 1,
      },
      {
        contactId: '557357306602',
        email: 'james.wilson@megacorp.com',
        firstName: 'James',
        lastName: 'Wilson',
        jobTitle: 'Enterprise Architect',
        persona: 'engineering',
        accountId: 'acc_enterprise_001',
        currentCampaign: 'product_b',
        enrollmentDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        lastTouchDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        touchCount7d: 2,
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Search Contacts by Domain (Live REST API v3 with Calibrated Fallback)
// ---------------------------------------------------------------------------

export async function searchContactsByDomain(
  domain: string,
  tokenOverride?: string,
  searchKeyOverride?: string
): Promise<Contact[]> {
  const token = tokenOverride || (typeof process !== 'undefined' ? process.env?.HUBSPOT_ACCESS_TOKEN : undefined);
  const normalizedDomain = domain.toLowerCase().trim();
  if (!token || token.includes('your_hubspot_access_token')) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new Error('Live HubSpot contact reads require HUBSPOT_ACCESS_TOKEN in production.');
    }
    const calibrated = CALIBRATED_COMMITTEES[normalizedDomain];
    const fallbackContacts = calibrated?.contacts ?? await discoverDynamicStakeholders(normalizedDomain, searchKeyOverride);
    console.log(`[HubSpotReader] No live token. Returning calibrated committee for ${domain} (${fallbackContacts.length} contacts)`);
    return fallbackContacts;
  }

  try {
    console.log(`[HubSpotReader] Querying HubSpot REST API v3 search for domain: ${normalizedDomain}...`);
    const searchUrl = `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`;
    
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'CONTAINS_TOKEN',
                value: normalizedDomain,
              },
            ],
          },
        ],
        properties: [
          'firstname',
          'lastname',
          'email',
          'jobtitle',
          'hs_lead_status',
          'current_campaign',
          'touch_count_7d',
          'num_associated_deals',
          'hs_createdate',
          'notes_last_updated',
        ],
        limit: 20,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];
      console.log(`[HubSpotReader] HubSpot search returned ${results.length} live contacts for ${normalizedDomain}`);

      return results.map((c: any) => {
          const props = c.properties || {};
          if (!Object.prototype.hasOwnProperty.call(props, 'current_campaign') ||
              !Object.prototype.hasOwnProperty.call(props, 'touch_count_7d')) {
            const missingProperties = REQUIRED_CONTACT_PROPERTIES.filter((property) =>
              !Object.prototype.hasOwnProperty.call(props, property)
            );
            throw new HubSpotContactSchemaError(missingProperties);
          }
          const title = props.jobtitle || 'Enterprise Stakeholder';
          const rawTouchCount = props.touch_count_7d;
          const parsedTouchCount = rawTouchCount === null || rawTouchCount === undefined || rawTouchCount === ''
            ? Number.NaN
            : Number(rawTouchCount);
          // Unknown cadence data must pause automation; treating a blank CRM field as zero is unsafe.
          const touchCount7d = Number.isFinite(parsedTouchCount) && parsedTouchCount >= 0
            ? Math.floor(parsedTouchCount)
            : getDefaultConfig().fatigueMaxTouches;
          return {
            contactId: String(c.id),
            email: props.email || `contact_${c.id}@${normalizedDomain}`,
            firstName: props.firstname || 'Team',
            lastName: props.lastname || 'Member',
            jobTitle: title,
            persona: inferPersonaFromTitle(title),
            accountId: `acc_${normalizedDomain.replace(/[^a-z0-9]/g, '_')}`,
            currentCampaign: props.current_campaign || null,
            enrollmentDate: props.hs_createdate || null,
            lastTouchDate: props.notes_last_updated || null,
            touchCount7d,
          };
        });
    } else {
      throw new Error(`HubSpot contact search failed with HTTP ${response.status}`);
    }
  } catch (err: unknown) {
    console.error('[HubSpotReader] Live contact search failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Get Account Pipeline Deals
// ---------------------------------------------------------------------------

export async function getAccountDeals(
  domain: string,
  tokenOverride?: string
): Promise<{ account: Account; activeDeals: Deal[] }> {
  const token = tokenOverride || (typeof process !== 'undefined' ? process.env?.HUBSPOT_ACCESS_TOKEN : undefined);
  const normalizedDomain = domain.toLowerCase().trim();
  if (!token || token.includes('your_hubspot_access_token')) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new Error('Live HubSpot account and deal reads require HUBSPOT_ACCESS_TOKEN in production.');
    }
    const calibrated = CALIBRATED_COMMITTEES[normalizedDomain];
    if (calibrated) return { account: { ...calibrated.account }, activeDeals: [...calibrated.account.activeDeals] };
    const companyClean = normalizedDomain.split('.')[0];
    const companyTitle = companyClean.charAt(0).toUpperCase() + companyClean.slice(1);
    const account: Account = {
      accountId: `acc_${normalizedDomain.replace(/[^a-z0-9]/g, '_')}`,
      domain: normalizedDomain,
      name: `${companyTitle} Inc.`,
      industry: 'Unknown',
      tier: 2,
      ownerBU: 'unassigned',
      activeDeals: [],
    };
    return { account, activeDeals: [] };
  }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const companyResponse = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/companies/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: normalizedDomain }] }],
      properties: ['name', 'domain', 'industry'],
      limit: 1,
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!companyResponse.ok) throw new Error(`HubSpot company search failed with HTTP ${companyResponse.status}`);
  const companyData = await companyResponse.json();
  const company = companyData.results?.[0];
  if (!company?.id) throw new Error(`No HubSpot company found for ${normalizedDomain}`);

  const associationsResponse = await fetch(
    `${HUBSPOT_BASE_URL}/crm/v4/objects/companies/${company.id}/associations/deals?limit=100`,
    { headers, signal: AbortSignal.timeout(6000) }
  );
  if (!associationsResponse.ok) throw new Error(`HubSpot deal association read failed with HTTP ${associationsResponse.status}`);
  const associationData = await associationsResponse.json();
  const dealIds = (associationData.results ?? []).map((item: { toObjectId?: number | string }) => String(item.toObjectId)).filter(Boolean);

  let deals: Deal[] = [];
  if (dealIds.length) {
    const dealsResponse = await fetch(`${HUBSPOT_BASE_URL}/crm/v3/objects/deals/batch/read`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        properties: ['dealname', 'amount', 'dealstage', 'hs_is_closed', 'hubspot_owner_id'],
        inputs: dealIds.map((id: string) => ({ id })),
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!dealsResponse.ok) throw new Error(`HubSpot deal read failed with HTTP ${dealsResponse.status}`);
    const dealsData = await dealsResponse.json();
    deals = (dealsData.results ?? []).filter((deal: any) => deal.properties?.hs_is_closed !== 'true').map((deal: any) => ({
      dealId: String(deal.id),
      dealStage: deal.properties?.dealstage || 'unknown',
      amount: Number(deal.properties?.amount || 0),
      owner: deal.properties?.hubspot_owner_id || 'unassigned',
    }));
  }

  const account: Account = {
    accountId: String(company.id),
    domain: normalizedDomain,
    name: company.properties?.name || normalizedDomain,
    industry: company.properties?.industry || 'Unknown',
    tier: 2,
    ownerBU: 'unassigned',
    activeDeals: deals,
  };
  return { account, activeDeals: deals };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferPersonaFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('security') || t.includes('ciso') || t.includes('secops') || t.includes('infosec')) return 'security';
  if (t.includes('devops') || t.includes('sre') || t.includes('infrastructure')) return 'devops';
  if (t.includes('engineer') || t.includes('architect') || t.includes('cto') || t.includes('vp eng')) return 'engineering';
  if (t.includes('finance') || t.includes('cfo') || t.includes('controller') || t.includes('accounting')) return 'finance';
  if (t.includes('data') || t.includes('analytics') || t.includes('bi')) return 'analytics';
  return 'engineering';
}

const ENTERPRISE_FIRST_NAMES = [
  'Arjun', 'Elena', 'Marcus', 'Priya', 'Klaus', 'Mei-Ling', 'Devon', 'Sofia', 'Dmitri', 'Amara',
  'Carlos', 'Fatima', 'Liam', 'Ananya', 'Tariq', 'Siobhan', 'Kenji', 'Zoe', 'Henrik', 'Soraya',
  'Javier', 'Nadia', 'Benoit', 'Sunita', 'Oliver', 'Chioma', 'Mateo', 'Amina', 'Gabriel', 'Ingrid',
  'Vikram', 'Chloe', 'Jin', 'Leila', 'Anders', 'Camila', 'Rohan', 'Freja', 'Zayn', 'Yasmin',
  'Lucas', 'Nia', 'Stefan', 'Tara', 'Arno', 'Noor', 'Ethan', 'Kavita', 'Sven', 'Danielle',
  'Alistair', 'Roxanne', 'Matteo', 'Linnea', 'Callum', 'Mira', 'Nikolai', 'Aaliyah', 'Keanu', 'Thalita'
];

const ENTERPRISE_LAST_NAMES = [
  'Vance', 'Lindqvist', 'Nakamura', 'Okafor', 'Sterling', 'Dubois', 'Gupta', 'Kowalski', 'Al-Mansoor', 'Mercer',
  'Rostova', 'Castillo', 'Novak', 'Bhandari', 'Bergstrom', 'Adel', 'Van der Meer', 'Karpov', 'Moreau', 'Choudhury',
  'Tanaka', 'Fontaine', 'Vargas', "O'Connor", 'Patel', 'Schneider', 'Kassaye', 'De Vries', 'Lombardi', 'Haddad',
  'Lindholm', 'Siddiqui', 'Horvat', 'Eze', 'MacDonald', 'Salazar', 'Kim', 'Petrov', 'Mayer', 'Sinclair',
  'Holm', 'Chen', 'Bauer', 'Kovacs', 'Gomez', 'Takahashi', 'Larsson', 'Nielsen', 'Morales', 'Abebe',
  'Vogel', 'Santos', 'Cabrera', 'Romano', 'Mendoza', 'Fischer', 'Abdi', 'Koster', 'Dela Cruz', 'Ritter'
];

function hashDomain(domain: string): number {
  let hash = 2166136261;
  for (let i = 0; i < domain.length; i++) {
    hash ^= domain.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function generateFallbackCommittee(domain: string): Contact[] {
  const cleanDomain = domain.toLowerCase().trim();
  const companyPrefix = cleanDomain.split('.')[0];
  const accId = `acc_${cleanDomain.replace(/[^a-z0-9]/g, '_')}`;
  const seed = hashDomain(cleanDomain);

  const getPersona = (
    seedOffset: number,
    roleTitle: string,
    persona: string,
    currentCampaign: string | null,
    touchCount7d: number,
    daysAgoEnroll: number,
    daysAgoTouch: number | null
  ): Contact => {
    const fn = ENTERPRISE_FIRST_NAMES[(seed + seedOffset * 17) % ENTERPRISE_FIRST_NAMES.length];
    const ln = ENTERPRISE_LAST_NAMES[(seed + seedOffset * 31) % ENTERPRISE_LAST_NAMES.length];
    const email = `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, '')}@${cleanDomain}`;
    return {
      contactId: `con_${companyPrefix}_${seedOffset + 1}`,
      email,
      firstName: fn,
      lastName: ln,
      jobTitle: roleTitle,
      persona,
      accountId: accId,
      currentCampaign,
      enrollmentDate: daysAgoEnroll > 0 ? new Date(Date.now() - daysAgoEnroll * 86400000).toISOString() : null,
      lastTouchDate: daysAgoTouch !== null ? new Date(Date.now() - daysAgoTouch * 86400000).toISOString() : null,
      touchCount7d,
    };
  };

  return [
    getPersona(0, 'VP of Platform Engineering', 'engineering', 'product_b', 1, 14, 3),
    getPersona(1, 'Director of Cloud SRE & DevOps', 'devops', 'product_b', 2, 20, 1),
    getPersona(2, 'Chief Information Security Officer (CISO)', 'security', null, 0, 0, null),
    getPersona(3, 'VP of Financial Systems & Tech Ops', 'finance', 'product_c', 0, 30, 10),
  ];
}

export async function discoverDynamicStakeholders(
  domain: string,
  searchKeyOverride?: string
): Promise<Contact[]> {
  const cleanDomain = domain.toLowerCase().trim();
  const companyClean = cleanDomain.split('.')[0];
  const companyTitle = companyClean.charAt(0).toUpperCase() + companyClean.slice(1);

  const baseline = generateFallbackCommittee(cleanDomain);

  const apiKey =
    searchKeyOverride ||
    (typeof process !== 'undefined'
      ? process.env?.TINYFISH_API_KEY
      : undefined);

  if (!apiKey || apiKey.includes('your_tinyfish_key')) {
    return baseline;
  }

  try {
    const query = `"${companyTitle}" ("VP of Engineering" OR "CISO" OR "Head of Security" OR "Director of DevOps" OR "VP of Finance") linkedin`;
    const searchUrl = new URL('https://api.search.tinyfish.ai/');
    searchUrl.searchParams.set('query', query);

    const res = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      return baseline;
    }

    const data = await res.json();
    const results = (data.results || []) as Array<{
      title?: string;
      snippet?: string;
      url?: string;
    }>;

    if (!results || results.length === 0) {
      return baseline;
    }

    // Parse real executives from LinkedIn search results
    const parsedExecutives: Array<{ firstName: string; lastName: string; jobTitle: string; persona: string }> = [];
    const seenNames = new Set<string>();

    for (const r of results) {
      const title = r.title || '';
      const match = title.match(/^([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\s*[-–|:]\s*([^|\-–]+)/);
      if (match) {
        const fullName = match[1].trim();
        const rawRole = match[2].trim();
        const persona = inferPersonaFromTitle(rawRole);
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];

        if (
          !seenNames.has(fullName.toLowerCase()) &&
          !['linkedin', 'profile', 'directory', 'top', 'jobs'].includes(firstName.toLowerCase())
        ) {
          seenNames.add(fullName.toLowerCase());
          parsedExecutives.push({
            firstName,
            lastName,
            jobTitle: rawRole,
            persona,
          });
        }
      }
    }

    if (parsedExecutives.length === 0) {
      return baseline;
    }

    // Merge parsed real executives onto baseline personas to maintain state machine invariants
    const updated = [...baseline];
    for (const exec of parsedExecutives) {
      const slotIdx = updated.findIndex(c => c.persona === exec.persona);
      if (slotIdx !== -1) {
        updated[slotIdx] = {
          ...updated[slotIdx],
          firstName: exec.firstName,
          lastName: exec.lastName,
          jobTitle: exec.jobTitle,
          email: `${exec.firstName.toLowerCase()}.${exec.lastName.toLowerCase().replace(/[^a-z]/g, '')}@${cleanDomain}`,
        };
      }
    }

    return updated;
  } catch (err) {
    console.warn(`[HubSpotReader] Live web stakeholder discovery failed for ${cleanDomain}:`, err);
    return baseline;
  }
}
