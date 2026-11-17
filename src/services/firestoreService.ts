import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  INITIAL_DISTRIBUTORS,
  INITIAL_PRODUCTS,
  INITIAL_SRS,
  TERRITORY_ID,
} from '../data/initialSeed';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Distributor,
  LegacyBackupPayload,
  OpeningStock,
  PriceHistoryEntry,
  Product,
  SalesRep,
  Territory,
  TerritoryConfig,
  Transaction,
  TransactionItem,
  TransactionKind,
  UserProfile,
  UserRole,
} from '../types';

function clampStr(val: string, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function safeId(prefix = 'id'): string {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${raw}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

function sanitizeUidList(uids: string[], maxLen: number): string[] {
  const unique = Array.from(
    new Set(uids.filter((u) => typeof u === 'string' && u.length > 0 && u.length <= 128))
  );
  return unique.slice(0, maxLen);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const privRef = doc(db, 'users', user.uid, 'private', 'info');
  const isBootstrap =
    user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase() && user.emailVerified;

  try {
    const snap = await getDoc(userRef);
    const displayName = clampStr(
      user.displayName || user.email?.split('@')[0] || 'Team Member',
      80
    );
    const email = clampStr(user.email || '', 120);

    if (!snap.exists()) {
      const profile: UserProfile = {
        uid: user.uid,
        displayName,
        role: isBootstrap ? 'admin' : 'pending',
        territoryId: '',
        distributorId: '',
        srId: '',
        active: true,
      };
      await setDoc(userRef, {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(privRef, {
        email,
        phone: '',
        updatedAt: serverTimestamp(),
      });

      if (isBootstrap) {
        const adminRef = doc(db, 'admins', user.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: user.uid,
            grantedBy: 'bootstrap',
            createdAt: serverTimestamp(),
          });
        }
        await ensureDefaultTerritory(user.uid);
      }

      return { ...profile, email };
    }

    await setDoc(
      privRef,
      {
        email,
        phone: '',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const raw = snap.data() as Partial<UserProfile>;
    const data: UserProfile = {
      uid: raw.uid || user.uid,
      displayName: raw.displayName || displayName,
      role: (raw.role as UserRole) || 'pending',
      territoryId: raw.territoryId || '',
      distributorId: raw.distributorId || '',
      srId: raw.srId || '',
      active: raw.active !== false,
    };

    if (isBootstrap) {
      const adminRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          grantedBy: 'bootstrap',
          createdAt: serverTimestamp(),
        });
      }
      if (
        data.role !== 'admin' ||
        !data.active ||
        raw.territoryId === undefined ||
        raw.distributorId === undefined ||
        raw.srId === undefined
      ) {
        await updateDoc(userRef, {
          role: 'admin',
          territoryId: data.territoryId,
          distributorId: data.distributorId,
          srId: data.srId,
          active: true,
          updatedAt: serverTimestamp(),
        });
        data.role = 'admin';
        data.active = true;
      }
      await ensureDefaultTerritory(user.uid);
    }

    return { ...data, email };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function ensureDefaultTerritory(adminUid: string): Promise<void> {
  try {
    const terRef = doc(db, 'territories', TERRITORY_ID);
    const terSnap = await getDoc(terRef);
    if (!terSnap.exists()) {
      await setDoc(terRef, {
        id: TERRITORY_ID,
        name: 'Laxmipur Territory',
        active: true,
        managerUids: [adminUid],
        teamUids: [adminUid],
        sharedWithUids: [adminUid],
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const cfgRef = doc(db, 'territoryConfig', TERRITORY_ID);
    const cfgSnap = await getDoc(cfgRef);
    if (!cfgSnap.exists()) {
      await setDoc(cfgRef, {
        id: TERRITORY_ID,
        managerUids: [adminUid],
        teamUids: [adminUid],
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });
    }

    // Backfill any legacy docs that were created before multi-territory territoryId was added
    const collectionsToCheck = [
      'distributors',
      'srs',
      'openingStocks',
      'transactions',
      'transactionItems',
    ];
    let batch = writeBatch(db);
    let count = 0;

    for (const collName of collectionsToCheck) {
      const snap = await getDocs(collection(db, collName));
      for (const d of snap.docs) {
        if (!d.data().territoryId) {
          if (collName === 'distributors' || collName === 'srs') {
            batch.update(d.ref, {
              territoryId: TERRITORY_ID,
              updatedAt: serverTimestamp(),
            });
          } else if (collName === 'openingStocks') {
            batch.update(d.ref, {
              territoryId: TERRITORY_ID,
              updatedByUid: adminUid,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(d.ref, {
              territoryId: TERRITORY_ID,
            });
          }
          count++;
          if (count >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
      }
    }
    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `territories/${TERRITORY_ID}`);
  }
}

export async function seedInitialTerritoryCatalog(
  adminUid: string,
  teamUids: string[]
): Promise<{ seeded: boolean }> {
  const shared = sanitizeUidList([adminUid, ...teamUids], 500);
  const territoryShared = sanitizeUidList([adminUid, ...teamUids], 100);
  try {
    await ensureDefaultTerritory(adminUid);

    const existingProducts = await getDocs(collection(db, 'products'));
    if (!existingProducts.empty) {
      return { seeded: false };
    }

    // Batch 1: Distributors (must exist before SRs because of exists() rule on srs)
    const batch1 = writeBatch(db);
    for (const d of INITIAL_DISTRIBUTORS) {
      batch1.set(doc(db, 'distributors', d.id), {
        id: d.id,
        territoryId: TERRITORY_ID,
        name: clampStr(d.name, 100),
        active: d.active,
        sharedWithUids: territoryShared,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch1.commit();

    // Batch 2: SRs + Shared SMC Products
    const batch2 = writeBatch(db);
    for (const s of INITIAL_SRS) {
      batch2.set(doc(db, 'srs', s.id), {
        id: s.id,
        territoryId: TERRITORY_ID,
        name: clampStr(s.name, 100),
        distributorId: s.distributorId,
        active: s.active,
        sharedWithUids: territoryShared,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const p of INITIAL_PRODUCTS) {
      batch2.set(doc(db, 'products', p.id), {
        id: p.id,
        name: clampStr(p.name, 120),
        group: clampStr(p.group, 60),
        price: Math.max(0, Number(p.price)),
        active: p.active,
        sharedWithUids: shared,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch2.commit();
    return { seeded: true };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'seed_territory_catalog');
  }
}

export async function saveTerritoryRecord(params: {
  id?: string;
  name: string;
  active?: boolean;
  uid: string;
}): Promise<void> {
  const { id, name, active = true, uid } = params;
  const cleanName = clampStr(name, 100);
  const docId =
    id ||
    cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) ||
    safeId('ter');

  try {
    if (id) {
      await updateDoc(doc(db, 'territories', id), {
        name: cleanName,
        active,
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = await getDoc(doc(db, 'territories', docId));
      const finalId = existing.exists() ? safeId('ter') : docId;
      const globalManagers: string[] = [uid];
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        for (const uDoc of userSnap.docs) {
          const u = uDoc.data() as Partial<UserProfile>;
          if (
            u.active !== false &&
            (u.role === 'admin' || (u.role === 'tso' && (u.territoryId || '') === ''))
          ) {
            globalManagers.push(u.uid || uDoc.id);
          }
        }
      } catch {
        // Non-bootstrapped admins cannot list users; fallback to [uid]
      }
      const managers = sanitizeUidList(globalManagers, 25);
      const team = sanitizeUidList(globalManagers, 100);
      await setDoc(doc(db, 'territories', finalId), {
        id: finalId,
        name: cleanName,
        active: true,
        managerUids: managers,
        teamUids: team,
        sharedWithUids: team,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `territories/${docId}`);
  }
}

export async function toggleTerritoryActive(territory: Territory): Promise<void> {
  try {
    await updateDoc(doc(db, 'territories', territory.id), {
      active: !territory.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `territories/${territory.id}`);
  }
}

export interface EntryLinePayload {
  productId: string;
  product: string;
  group: string;
  qty: number;
  price: number;
}

export async function createTransactionEntry(params: {
  territoryId: string;
  kind: TransactionKind;
  date: string;
  distributorId: string;
  srId: string;
  items: EntryLinePayload[];
  createdByUid: string;
  managerUids: string[];
}): Promise<string> {
  const { territoryId, kind, date, distributorId, srId, items, createdByUid, managerUids } =
    params;
  const txId = safeId('tx');
  const month = date.slice(0, 7);
  const validItems = items.filter((i) => i.qty > 0);
  if (validItems.length === 0) {
    throw new Error('At least one product quantity must be greater than zero.');
  }

  const totalAmount = Number(
    validItems.reduce((sum, i) => sum + i.qty * i.price, 0).toFixed(4)
  );
  const totalQty = Number(validItems.reduce((sum, i) => sum + i.qty, 0).toFixed(4));
  const shared = sanitizeUidList([createdByUid, ...managerUids], 25);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'transactions', txId), {
      id: txId,
      territoryId,
      kind,
      date,
      month,
      distributorId,
      srId: kind === 'Secondary Sales' ? srId : '',
      totalAmount,
      totalQty,
      itemCount: validItems.length,
      sharedWithUids: shared,
      createdByUid,
      createdAt: serverTimestamp(),
    });

    for (const line of validItems) {
      const itemId = safeId('ti');
      batch.set(doc(db, 'transactionItems', itemId), {
        id: itemId,
        transactionId: txId,
        territoryId,
        kind,
        date,
        month,
        distributorId,
        srId: kind === 'Secondary Sales' ? srId : '',
        productId: line.productId,
        product: clampStr(line.product, 120),
        group: clampStr(line.group, 60),
        qty: Number(line.qty),
        price: Math.max(0, Number(line.price)),
        sharedWithUids: shared,
        createdByUid,
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
    return txId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `transactions/${txId}`);
  }
}

export async function deleteTransactionEntry(
  txId: string,
  relatedItems: TransactionItem[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const item of relatedItems) {
      batch.delete(doc(db, 'transactionItems', item.id));
    }
    batch.delete(doc(db, 'transactions', txId));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `transactions/${txId}`);
  }
}

export async function saveDistributorRecord(params: {
  id?: string;
  territoryId: string;
  name: string;
  active?: boolean;
  uid: string;
  territoryTeamUids: string[];
}): Promise<void> {
  const { id, territoryId, name, active = true, uid, territoryTeamUids } = params;
  const cleanName = clampStr(name, 100);
  const shared = sanitizeUidList([uid, ...territoryTeamUids], 100);
  const docId = id || safeId('d');
  try {
    if (id) {
      await updateDoc(doc(db, 'distributors', id), {
        territoryId,
        name: cleanName,
        active,
        sharedWithUids: shared,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'distributors', docId), {
        id: docId,
        territoryId,
        name: cleanName,
        active: true,
        sharedWithUids: shared,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `distributors/${docId}`);
  }
}

export async function toggleDistributorActive(d: Distributor): Promise<void> {
  try {
    await updateDoc(doc(db, 'distributors', d.id), {
      active: !d.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `distributors/${d.id}`);
  }
}

export async function saveSrRecord(params: {
  id?: string;
  territoryId: string;
  name: string;
  distributorId: string;
  active?: boolean;
  uid: string;
  territoryTeamUids: string[];
}): Promise<void> {
  const { id, territoryId, name, distributorId, active = true, uid, territoryTeamUids } = params;
  const cleanName = clampStr(name, 100);
  const shared = sanitizeUidList([uid, ...territoryTeamUids], 100);
  const docId = id || safeId('s');
  try {
    if (id) {
      await updateDoc(doc(db, 'srs', id), {
        territoryId,
        name: cleanName,
        distributorId,
        active,
        sharedWithUids: shared,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'srs', docId), {
        id: docId,
        territoryId,
        name: cleanName,
        distributorId,
        active: true,
        sharedWithUids: shared,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `srs/${docId}`);
  }
}

export async function toggleSrActive(s: SalesRep): Promise<void> {
  try {
    await updateDoc(doc(db, 'srs', s.id), {
      active: !s.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `srs/${s.id}`);
  }
}

export async function saveProductRecord(params: {
  existing?: Product;
  name: string;
  group: string;
  price: number;
  effectiveDate: string;
  uid: string;
  allTeamUids: string[];
}): Promise<void> {
  const { existing, name, group, price, effectiveDate, uid, allTeamUids } = params;
  const cleanName = clampStr(name, 120);
  const cleanGroup = clampStr(group, 60);
  const cleanPrice = Math.max(0, Number(price));
  const shared = sanitizeUidList([uid, ...allTeamUids], 500);
  const prodId = existing?.id || safeId('p');

  try {
    const batch = writeBatch(db);
    if (existing) {
      batch.update(doc(db, 'products', prodId), {
        name: cleanName,
        group: cleanGroup,
        price: cleanPrice,
        sharedWithUids: shared,
        updatedAt: serverTimestamp(),
      });
      if (existing.price !== cleanPrice) {
        const histId = safeId('ph');
        batch.set(doc(db, 'priceHistory', histId), {
          id: histId,
          productId: prodId,
          productName: cleanName,
          oldPrice: existing.price,
          newPrice: cleanPrice,
          effectiveDate,
          sharedWithUids: shared,
          changedByUid: uid,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      batch.set(doc(db, 'products', prodId), {
        id: prodId,
        name: cleanName,
        group: cleanGroup,
        price: cleanPrice,
        active: true,
        sharedWithUids: shared,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `products/${prodId}`);
  }
}

export async function toggleProductActive(p: Product): Promise<void> {
  try {
    await updateDoc(doc(db, 'products', p.id), {
      active: !p.active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${p.id}`);
  }
}

export async function saveOpeningStockRecord(params: {
  territoryId: string;
  month: string;
  distributorId: string;
  productId: string;
  qty: number;
  uid: string;
  territoryTeamUids: string[];
}): Promise<void> {
  const { territoryId, month, distributorId, productId, qty, uid, territoryTeamUids } = params;
  const openingId = `${month}_${distributorId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const shared = sanitizeUidList([uid, ...territoryTeamUids], 100);
  try {
    await setDoc(doc(db, 'openingStocks', openingId), {
      id: openingId,
      territoryId,
      month,
      distributorId,
      productId,
      qty: Math.max(0, Number(qty)),
      sharedWithUids: shared,
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `openingStocks/${openingId}`);
  }
}

export async function fetchAdminTeamUsers(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const list: UserProfile[] = [];
    for (const d of snap.docs) {
      const raw = d.data() as Partial<UserProfile>;
      const profile: UserProfile = {
        uid: raw.uid || d.id,
        displayName: raw.displayName || 'Team Member',
        role: (raw.role as UserRole) || 'pending',
        territoryId: raw.territoryId || '',
        distributorId: raw.distributorId || '',
        srId: raw.srId || '',
        active: raw.active !== false,
      };
      try {
        const privSnap = await getDoc(doc(db, 'users', d.id, 'private', 'info'));
        if (privSnap.exists()) {
          const priv = privSnap.data() as { email?: string; phone?: string };
          profile.email = priv.email;
          profile.phone = priv.phone;
        }
      } catch {
        // Ignore if private info isn't present yet
      }
      list.push(profile);
    }
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function updateTeamMemberAccess(params: {
  adminUid: string;
  targetUser: UserProfile;
  newRole: UserRole;
  territoryId: string;
  distributorId: string;
  srId: string;
  active: boolean;
  allUsers: UserProfile[];
  territories: Territory[];
}): Promise<void> {
  const {
    adminUid,
    targetUser,
    newRole,
    territoryId,
    distributorId,
    srId,
    active,
    allUsers,
    territories,
  } = params;

  const finalTerritoryId = newRole === 'pending' ? '' : territoryId;

  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      role: newRole,
      territoryId: finalTerritoryId,
      distributorId: newRole === 'sr' || newRole === 'dealer' ? distributorId : '',
      srId: newRole === 'sr' ? srId : '',
      active,
      updatedAt: serverTimestamp(),
    });

    if (newRole === 'admin' && active) {
      await setDoc(doc(db, 'admins', targetUser.uid), {
        uid: targetUser.uid,
        grantedBy: adminUid,
        createdAt: serverTimestamp(),
      });
    } else if (targetUser.email?.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
      await deleteDoc(doc(db, 'admins', targetUser.uid)).catch(() => undefined);
    }

    const updatedRoster = allUsers.map((u) =>
      u.uid === targetUser.uid
        ? {
            ...u,
            role: newRole,
            territoryId: finalTerritoryId,
            distributorId: newRole === 'sr' || newRole === 'dealer' ? distributorId : '',
            srId: newRole === 'sr' ? srId : '',
            active,
          }
        : u
    );

    const distributorDealersMap = new Map<string, string[]>();
    for (const u of updatedRoster) {
      if (u.active && u.role === 'dealer' && u.distributorId) {
        const list = distributorDealersMap.get(u.distributorId) || [];
        list.push(u.uid);
        distributorDealersMap.set(u.distributorId, list);
      }
    }

    const globalAdmins = updatedRoster
      .filter((u) => u.active && u.role === 'admin')
      .map((u) => u.uid);

    const allApprovedUids = sanitizeUidList(
      [
        adminUid,
        ...updatedRoster.filter((u) => u.active && u.role !== 'pending').map((u) => u.uid),
      ],
      500
    );

    // Build per-territory managerUids & teamUids
    const territoryUidsMap = new Map<string, { managers: string[]; team: string[] }>();
    for (const ter of territories) {
      const managers = sanitizeUidList(
        [
          adminUid,
          ...globalAdmins,
          ...updatedRoster
            .filter(
              (u) =>
                u.active &&
                u.role === 'tso' &&
                (u.territoryId === ter.id || u.territoryId === '')
            )
            .map((u) => u.uid),
        ],
        25
      );
      const team = sanitizeUidList(
        [
          adminUid,
          ...globalAdmins,
          ...updatedRoster
            .filter(
              (u) =>
                u.active &&
                u.role !== 'pending' &&
                (u.territoryId === ter.id || u.territoryId === '')
            )
            .map((u) => u.uid),
        ],
        100
      );
      territoryUidsMap.set(ter.id, { managers, team });

      await updateDoc(doc(db, 'territories', ter.id), {
        managerUids: managers,
        teamUids: team,
        sharedWithUids: team,
        updatedAt: serverTimestamp(),
      });
    }

    // Update global company catalog (products & priceHistory)
    let batch = writeBatch(db);
    let opCount = 0;

    for (const collName of ['products', 'priceHistory']) {
      const snap = await getDocs(collection(db, collName));
      for (const d of snap.docs) {
        if (collName === 'products') {
          batch.update(d.ref, { sharedWithUids: allApprovedUids, updatedAt: serverTimestamp() });
        } else {
          batch.update(d.ref, { sharedWithUids: allApprovedUids });
        }
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }

    // Update territory-scoped collections
    for (const collName of [
      'distributors',
      'srs',
      'openingStocks',
      'transactions',
      'transactionItems',
    ]) {
      const snap = await getDocs(collection(db, collName));
      for (const d of snap.docs) {
        const terId = String(d.data().territoryId || TERRITORY_ID);
        const uids = territoryUidsMap.get(terId) || {
          managers: sanitizeUidList([adminUid, ...globalAdmins], 25),
          team: sanitizeUidList([adminUid, ...globalAdmins], 100),
        };

        if (collName === 'transactions' || collName === 'transactionItems') {
          const distDealers =
            distributorDealersMap.get(String(d.data().distributorId || '')) || [];
          const merged = sanitizeUidList(
            [String(d.data().createdByUid || ''), ...uids.managers, ...distDealers],
            25
          );
          batch.update(d.ref, { territoryId: terId, sharedWithUids: merged });
        } else if (collName === 'openingStocks') {
          batch.update(d.ref, {
            territoryId: terId,
            sharedWithUids: uids.team,
            updatedByUid: adminUid,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(d.ref, {
            territoryId: terId,
            sharedWithUids: uids.team,
            updatedAt: serverTimestamp(),
          });
        }

        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${targetUser.uid}`);
  }
}

export async function importLegacyBackupToFirestore(params: {
  backup: LegacyBackupPayload;
  defaultTerritoryId: string;
  adminUid: string;
  allTeamUids: string[];
  territoryTeamUids: string[];
  territoryManagerUids: string[];
}): Promise<{ importedTxCount: number }> {
  const {
    backup,
    defaultTerritoryId,
    adminUid,
    allTeamUids,
    territoryTeamUids,
    territoryManagerUids,
  } = params;
  const sharedCatalog = sanitizeUidList([adminUid, ...allTeamUids], 500);
  const sharedTeam = sanitizeUidList([adminUid, ...territoryTeamUids], 100);
  const sharedManagers = sanitizeUidList([adminUid, ...territoryManagerUids], 25);

  try {
    await ensureDefaultTerritory(adminUid);

    let batch = writeBatch(db);
    let count = 0;
    for (const d of backup.distributors || []) {
      const id = String(d.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      batch.set(doc(db, 'distributors', id), {
        id,
        territoryId: d.territoryId || defaultTerritoryId,
        name: clampStr(d.name, 100),
        active: d.active !== false,
        sharedWithUids: sharedTeam,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    batch = writeBatch(db);
    count = 0;
    for (const s of backup.srs || []) {
      const id = String(s.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const distId = String(s.distributorId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      batch.set(doc(db, 'srs', id), {
        id,
        territoryId: s.territoryId || defaultTerritoryId,
        name: clampStr(s.name, 100),
        distributorId: distId,
        active: s.active !== false,
        sharedWithUids: sharedTeam,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    for (const p of backup.products || []) {
      const id = String(p.id).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      batch.set(doc(db, 'products', id), {
        id,
        name: clampStr(p.name, 120),
        group: clampStr(p.group, 60),
        price: Math.max(0, Number(p.price)),
        active: p.active !== false,
        sharedWithUids: sharedCatalog,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    batch = writeBatch(db);
    count = 0;
    for (const [key, qty] of Object.entries(backup.opening || {})) {
      const parts = key.split('_');
      if (parts.length < 3) continue;
      const [month, distId, ...rest] = parts;
      const prodId = rest.join('_');
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const openingId = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      batch.set(doc(db, 'openingStocks', openingId), {
        id: openingId,
        territoryId: defaultTerritoryId,
        month,
        distributorId: distId,
        productId: prodId,
        qty: Math.max(0, Number(qty)),
        sharedWithUids: sharedTeam,
        updatedByUid: adminUid,
        updatedAt: serverTimestamp(),
      });
      count++;
      if (count >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await batch.commit();

    let importedTxCount = 0;
    for (const tx of backup.transactions || []) {
      const validItems = (tx.items || []).filter((i) => Number(i.qty) > 0);
      if (!validItems.length) continue;
      const txId = String(tx.id || safeId('tx')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const date = tx.date.slice(0, 10);
      const month = date.slice(0, 7);
      const terId = tx.territoryId || defaultTerritoryId;
      const totalAmount = Number(validItems.reduce((a, i) => a + i.qty * i.price, 0).toFixed(4));
      const totalQty = Number(validItems.reduce((a, i) => a + i.qty, 0).toFixed(4));

      const txBatch = writeBatch(db);
      txBatch.set(doc(db, 'transactions', txId), {
        id: txId,
        territoryId: terId,
        kind: tx.kind,
        date,
        month,
        distributorId: tx.distributorId,
        srId: tx.kind === 'Secondary Sales' ? String(tx.srId || '') : '',
        totalAmount,
        totalQty,
        itemCount: validItems.length,
        sharedWithUids: sharedManagers,
        createdByUid: adminUid,
        createdAt: serverTimestamp(),
      });
      for (const item of validItems) {
        const itemId = safeId('ti');
        txBatch.set(doc(db, 'transactionItems', itemId), {
          id: itemId,
          transactionId: txId,
          territoryId: terId,
          kind: tx.kind,
          date,
          month,
          distributorId: tx.distributorId,
          srId: tx.kind === 'Secondary Sales' ? String(tx.srId || '') : '',
          productId: item.productId,
          product: clampStr(item.product, 120),
          group: clampStr(item.group, 60),
          qty: Number(item.qty),
          price: Math.max(0, Number(item.price)),
          sharedWithUids: sharedManagers,
          createdByUid: adminUid,
          createdAt: serverTimestamp(),
        });
      }
      await txBatch.commit();
      importedTxCount++;
    }

    return { importedTxCount };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'import_backup');
  }
}

export async function fetchItemsForTransaction(txId: string): Promise<TransactionItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'transactionItems'), where('transactionId', '==', txId))
    );
    return snap.docs.map((d) => d.data() as TransactionItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'transactionItems');
  }
}

export type { OpeningStock, PriceHistoryEntry, Territory, Transaction };
