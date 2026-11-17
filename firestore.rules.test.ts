/**
 * Phase 0: Payload-First Security TDD Test Suite for Team Sales Pro
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules.
 * Run against Firebase Emulator Suite (@firebase/rules-unit-testing).
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: {
    uid: string;
    email: string;
    emailVerified: boolean;
    role: 'admin' | 'tso' | 'sr' | 'pending';
    distributorId?: string;
    srId?: string;
  };
  payload: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Role Escalation on Registration',
    collectionPath: 'users/attacker_uid',
    operation: 'create',
    actor: { uid: 'attacker_uid', email: 'attacker@example.com', emailVerified: true, role: 'pending' },
    payload: {
      uid: 'attacker_uid',
      displayName: 'Attacker',
      role: 'admin',
      distributorId: '',
      srId: '',
      active: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Profile Role Tampering on Update',
    collectionPath: 'users/sr_uid_1',
    operation: 'update',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: { role: 'admin', active: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field Injection on Product',
    collectionPath: 'products/p2',
    operation: 'update',
    actor: { uid: 'admin_uid', email: 'imran972913@gmail.com', emailVerified: true, role: 'admin' },
    payload: { price: 4.0, isVerified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Scraping across Users',
    collectionPath: 'users/other_uid/private/info',
    operation: 'get',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified Email Admin Spoof',
    collectionPath: 'products/p2',
    operation: 'create',
    actor: { uid: 'spoof_uid', email: 'imran972913@gmail.com', emailVerified: false, role: 'admin' },
    payload: { id: 'p2', name: 'Raja Super', group: 'Condom', price: 3.85, active: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'SR Creating Primary Stock Transaction',
    collectionPath: 'transactions/tx_evil_1',
    operation: 'create',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: {
      id: 'tx_evil_1',
      kind: 'Primary Stock',
      date: '2026-11-17',
      month: '2026-11',
      distributorId: 'd1',
      srId: '',
      totalAmount: 500,
      totalQty: 10,
      itemCount: 1,
      sharedWithUids: [],
      createdByUid: 'sr_uid_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'SR Forging Another Distributor Sale',
    collectionPath: 'transactions/tx_evil_2',
    operation: 'create',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: {
      id: 'tx_evil_2',
      kind: 'Secondary Sales',
      date: '2026-11-17',
      month: '2026-11',
      distributorId: 'd2',
      srId: 's3',
      totalAmount: 500,
      totalQty: 10,
      itemCount: 1,
      sharedWithUids: [],
      createdByUid: 'sr_uid_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Orphaned Transaction Item',
    collectionPath: 'transactionItems/item_orphan',
    operation: 'create',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: {
      id: 'item_orphan',
      transactionId: 'non_existent_tx',
      kind: 'Secondary Sales',
      date: '2026-11-17',
      month: '2026-11',
      distributorId: 'd1',
      srId: 's1',
      productId: 'p2',
      product: 'Raja Super',
      group: 'Condom',
      qty: 5,
      price: 3.85,
      sharedWithUids: [],
      createdByUid: 'sr_uid_1',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'SR Price Modification',
    collectionPath: 'products/p2',
    operation: 'update',
    actor: { uid: 'sr_uid_1', email: 'sr1@example.com', emailVerified: true, role: 'sr', distributorId: 'd1', srId: 's1' },
    payload: { price: 0.01 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning with Illegal Characters',
    collectionPath: 'products/bad$id',
    operation: 'create',
    actor: { uid: 'admin_uid', email: 'imran972913@gmail.com', emailVerified: true, role: 'admin' },
    payload: { id: 'bad$id', name: 'Invalid', group: 'Condom', price: 1, active: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery on Transaction',
    collectionPath: 'transactions/tx_evil_time',
    operation: 'create',
    actor: { uid: 'admin_uid', email: 'imran972913@gmail.com', emailVerified: true, role: 'admin' },
    payload: {
      id: 'tx_evil_time',
      kind: 'Primary Stock',
      date: '2026-11-17',
      month: '2026-11',
      distributorId: 'd1',
      srId: '',
      totalAmount: 38.5,
      totalQty: 10,
      itemCount: 1,
      sharedWithUids: [],
      createdByUid: 'admin_uid',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Blanket List Scraping by Pending User',
    collectionPath: 'transactions',
    operation: 'list',
    actor: { uid: 'pending_uid', email: 'stranger@example.com', emailVerified: true, role: 'pending' },
    payload: {},
    expectedResult: 'PERMISSION_DENIED',
  },
];
