const FNE_TOKEN_KEY   = 'fne_token';
const FNE_URL_KEY     = 'fne_url';
const FNE_ENV_KEY     = 'fne_env';
const FNE_CLIENTS_KEY = 'fne_clients';

// ── Client FNE supplement (stored locally, keyed by client id) ─────────────

export interface FneClientInfo {
  ncc:           string;
  template:      'B2C' | 'B2B' | 'B2G' | 'B2F';
  pointOfSale:   string;
  establishment: string;
  tel:           string;
  email:         string;
}

type FneClientsStore = Record<number, FneClientInfo>;

export function getFneClients(): FneClientsStore {
  try { return JSON.parse(localStorage.getItem(FNE_CLIENTS_KEY) ?? '{}'); } catch { return {}; }
}

export function getFneClient(clientId: number): FneClientInfo | null {
  return getFneClients()[clientId] ?? null;
}

export function setFneClient(clientId: number, info: FneClientInfo) {
  const all = getFneClients();
  all[clientId] = info;
  localStorage.setItem(FNE_CLIENTS_KEY, JSON.stringify(all));
}

export function deleteFneClient(clientId: number) {
  const all = getFneClients();
  delete all[clientId];
  localStorage.setItem(FNE_CLIENTS_KEY, JSON.stringify(all));
}

export const FNE_TEST_URL = 'http://54.247.95.108/ws';

export type FneEnv = 'test' | 'prod';

export function getFneToken()         { return localStorage.getItem(FNE_TOKEN_KEY) ?? ''; }
export function setFneToken(v: string){ localStorage.setItem(FNE_TOKEN_KEY, v); }

export function getFneUrl()           { return localStorage.getItem(FNE_URL_KEY) ?? FNE_TEST_URL; }
export function setFneUrl(v: string)  { localStorage.setItem(FNE_URL_KEY, v); }

export function getFneEnv(): FneEnv   { return (localStorage.getItem(FNE_ENV_KEY) as FneEnv) ?? 'test'; }
export function setFneEnv(env: FneEnv){
  localStorage.setItem(FNE_ENV_KEY, env);
  if (env === 'test') setFneUrl(FNE_TEST_URL);
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface FneCustomTax { name: string; amount: number }

export interface FneItem {
  taxes:           string[];
  customTaxes?:    FneCustomTax[];
  reference?:      string;
  description:     string;
  quantity:        number;
  amount:          number;
  discount?:       number;
  measurementUnit?: string;
}

export interface FneInvoiceRequest {
  invoiceType:       'sale' | 'purchase';
  paymentMethod:     string;
  template:          'B2C' | 'B2G' | 'B2B' | 'B2F';
  isRne:             boolean;
  rne?:              string;
  clientNcc?:        string;
  clientCompanyName: string;
  clientPhone:       string;
  clientEmail:       string;
  clientSellerName?: string;
  pointOfSale:       string;
  establishment:     string;
  commercialMessage?: string;
  footer?:           string;
  foreignCurrency?:  string;
  foreignCurrencyRate?: number;
  items:             FneItem[];
  customTaxes?:      FneCustomTax[];
  discount?:         number;
}

export interface FneInvoice {
  id:                string;
  reference:         string;
  type:              string;
  subtype:           string;
  date:              string;
  paymentMethod:     string;
  amount:            number;
  vatAmount:         number;
  fiscalStamp:       number;
  discount:          number;
  status:            string;
  template:          string;
  clientCompanyName: string;
  clientPhone:       string;
  clientEmail:       string;
  foreignCurrency:   string;
  foreignCurrencyRate: number;
  isRne:             boolean;
}

export interface FneInvoiceResponse {
  ncc:             string;
  reference:       string;
  token:           string;
  warning:         boolean;
  balance_sticker: number;
  invoice:         FneInvoice;
}

export interface FneRefundResponse {
  ncc:             string;
  reference:       string;
  token:           string;
  warning:         boolean;
  balance_sticker: number;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function fneRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getFneToken();
  const url   = getFneUrl();

  if (!token) throw new Error('Token FNE non configuré. Renseignez-le dans Configuration.');

  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.message ?? `Erreur ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const fneService = {
  sign: (body: FneInvoiceRequest) =>
    fneRequest<FneInvoiceResponse>('POST', '/external/invoices/sign', body),

  refund: (invoiceId: string, items: { id: string; quantity: number }[]) =>
    fneRequest<FneRefundResponse>('POST', `/external/invoices/${invoiceId}/refund`, { items }),
};
