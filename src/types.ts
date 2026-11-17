export type UserRole = 'admin' | 'tso' | 'dealer' | 'sr' | 'pending';
export type Lang = 'en' | 'bn';

export type NavPage =
  | 'Dashboard'
  | 'Sales Entry'
  | 'Primary Stock'
  | 'Stock Ledger'
  | 'Master Sheet'
  | 'Distributors'
  | 'SR Team'
  | 'Products & Prices'
  | 'Reports'
  | 'Territories'
  | 'Team Access';

export interface Territory {
  id: string;
  name: string;
  active: boolean;
  managerUids: string[];
  teamUids: string[];
  sharedWithUids: string[];
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  territoryId: string;
  distributorId: string;
  srId: string;
  active: boolean;
  email?: string;
  phone?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TerritoryConfig {
  id: string;
  managerUids: string[];
  teamUids: string[];
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  name: string;
  group: string;
  price: number;
  active: boolean;
  sharedWithUids: string[];
  createdByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Distributor {
  id: string;
  territoryId: string;
  name: string;
  active: boolean;
  sharedWithUids: string[];
  createdByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SalesRep {
  id: string;
  territoryId: string;
  name: string;
  distributorId: string;
  active: boolean;
  sharedWithUids: string[];
  createdByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type TransactionKind = 'Primary Stock' | 'Secondary Sales';

export interface Transaction {
  id: string;
  territoryId: string;
  kind: TransactionKind;
  date: string;
  month: string;
  distributorId: string;
  srId: string;
  totalAmount: number;
  totalQty: number;
  itemCount: number;
  sharedWithUids: string[];
  createdByUid: string;
  createdAt?: unknown;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  territoryId: string;
  kind: TransactionKind;
  date: string;
  month: string;
  distributorId: string;
  srId: string;
  productId: string;
  product: string;
  group: string;
  qty: number;
  price: number;
  sharedWithUids: string[];
  createdByUid: string;
  createdAt?: unknown;
}

export interface OpeningStock {
  id: string;
  territoryId: string;
  month: string;
  distributorId: string;
  productId: string;
  qty: number;
  sharedWithUids: string[];
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  effectiveDate: string;
  sharedWithUids: string[];
  changedByUid: string;
  createdAt?: unknown;
}

export interface LegacyBackupPayload {
  products: Array<{ id: string; name: string; group: string; price: number; active?: boolean }>;
  distributors: Array<{ id: string; territoryId?: string; name: string; active?: boolean }>;
  srs: Array<{ id: string; territoryId?: string; name: string; distributorId: string; active?: boolean }>;
  transactions: Array<{
    id: string;
    territoryId?: string;
    kind: TransactionKind;
    date: string;
    distributorId: string;
    srId?: string | null;
    items: Array<{ productId: string; product: string; group: string; qty: number; price: number }>;
  }>;
  priceHistory?: Array<{ date: string; name: string; oldPrice: number; newPrice: number }>;
  opening?: Record<string, number>;
}
