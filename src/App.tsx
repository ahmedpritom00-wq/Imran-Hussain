import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Copy,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PackagePlus,
  Plus,
  Shield,
  Tag,
  UserCheck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copyToClipboard, formatTransactionMemo } from './utils/shareUtils';
import { PendingApprovalScreen, SignInScreen } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { DistributorsView, ProductsView, SrTeamView } from './components/DirectoryViews';
import { EntryView } from './components/EntryView';
import { MasterSheetView } from './components/MasterSheetView';
import { ReportsView } from './components/ReportsView';
import { StockLedgerView } from './components/StockLedgerView';
import { TeamAccessView } from './components/TeamAccessView';
import { TerritoriesView } from './components/TerritoriesView';
import { NAV_LABELS, ROLE_LABELS, t } from './data/i18n';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  currentMonthISO,
  formatMoney,
  formatQty,
  TERRITORY_ID,
} from './data/initialSeed';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import {
  createTransactionEntry,
  deleteTransactionEntry,
  ensureUserProfile,
  fetchAdminTeamUsers,
  fetchItemsForTransaction,
  importLegacyBackupToFirestore,
  saveDistributorRecord,
  saveOpeningStockRecord,
  saveProductRecord,
  saveSrRecord,
  saveTerritoryRecord,
  seedInitialTerritoryCatalog,
  toggleDistributorActive,
  toggleProductActive,
  toggleSrActive,
  toggleTerritoryActive,
  updateTeamMemberAccess,
} from './services/firestoreService';
import type {
  Distributor,
  Lang,
  LegacyBackupPayload,
  NavPage,
  OpeningStock,
  PriceHistoryEntry,
  Product,
  SalesRep,
  Territory,
  Transaction,
  TransactionItem,
  UserProfile,
} from './types';

const NAV_ICONS: Record<NavPage, typeof LayoutDashboard> = {
  Dashboard: LayoutDashboard,
  'Sales Entry': Plus,
  'Primary Stock': PackagePlus,
  'Stock Ledger': Boxes,
  'Master Sheet': FileSpreadsheet,
  Territories: MapPin,
  Distributors: Building2,
  'SR Team': UserCheck,
  'Products & Prices': Tag,
  Reports: BarChart3,
  'Team Access': Shield,
};

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('tsp_lang');
    return saved === 'bn' ? 'bn' : 'en';
  });

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === 'en' ? 'bn' : 'en';
      localStorage.setItem('tsp_lang', next);
      return next;
    });
  };

  // Auth & Profile
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [refreshingRole, setRefreshingRole] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  // Navigation & Filters
  const [page, setPage] = useState<NavPage>('Dashboard');
  const [month, setMonth] = useState<string>(currentMonthISO());
  const [chosenTerritory, setChosenTerritory] = useState<string>('all');
  const [chosenDb, setChosenDb] = useState<string>('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Firestore synced collections
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [srs, setSrs] = useState<SalesRep[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allItems, setAllItems] = useState<TransactionItem[]>([]);
  const [openingStocks, setOpeningStocks] = useState<OpeningStock[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);

  // Transaction detail modal
  const [inspectedTx, setInspectedTx] = useState<Transaction | null>(null);
  const [inspectedItems, setInspectedItems] = useState<TransactionItem[]>([]);
  const [loadingTxDetails, setLoadingTxDetails] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const autoSeededRef = useRef(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  const formatAuthErr = useCallback(
    (err: unknown): string => {
      const raw = err instanceof Error ? err.message : String(err || 'Sign-in failed.');
      try {
        const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
        if (parsed?.error) {
          return `${parsed.operationType?.toUpperCase() || 'Database'} error (${parsed.path || 'profile'}): ${parsed.error}`;
        }
      } catch {
        // Not JSON
      }
      if (raw.includes('auth/popup-blocked')) {
        return lang === 'en'
          ? 'Popup was blocked by your browser. Please allow popups for this site and try again.'
          : 'ব্রাউজার পপআপ ব্লক করেছে। অনুগ্রহ করে পপআপ অনুমোদন দিয়ে আবার চেষ্টা করুন।';
      }
      if (raw.includes('auth/popup-closed-by-user')) {
        return lang === 'en'
          ? 'Sign-in popup was closed before completing login.'
          : 'লগইন শেষ হওয়ার আগেই পপআপ বন্ধ হয়েছে।';
      }
      return raw;
    },
    [lang]
  );

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        setAuthError(null);
        setAuthReady(true);
        return;
      }
      setAuthError(null);
      try {
        const p = await ensureUserProfile(user);
        setProfile(p);
      } catch (err) {
        setAuthError(formatAuthErr(err));
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [formatAuthErr]);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const p = await ensureUserProfile(cred.user);
      setProfile(p);
    } catch (err) {
      setAuthError(formatAuthErr(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setProfile(null);
    setAuthError(null);
    setPage('Dashboard');
  };

  const handleRefreshStatus = async () => {
    if (!auth.currentUser) return;
    setRefreshingRole(true);
    try {
      const p = await ensureUserProfile(auth.currentUser);
      setProfile(p);
    } catch (err) {
      setAuthError(formatAuthErr(err));
    } finally {
      setRefreshingRole(false);
    }
  };

  const isApproved = Boolean(profile && profile.active && profile.role !== 'pending');
  const isBootstrappedAdmin = Boolean(
    profile?.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  );

  const isDistributorLocked = Boolean(
    profile && (profile.role === 'dealer' || profile.role === 'sr') && profile.distributorId
  );

  // Lock territory filter when a non-admin user is assigned to a specific territory
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.territoryId) {
      setChosenTerritory(profile.territoryId);
    }
  }, [profile]);

  // Reset or lock distributor selection when switching territories / profile changes
  useEffect(() => {
    if (isDistributorLocked && profile?.distributorId) {
      setChosenDb(profile.distributorId);
    } else {
      setChosenDb('all');
    }
  }, [chosenTerritory, isDistributorLocked, profile?.distributorId]);

  // Keep current user's role/territory assignment live (unlocks pending users immediately on approval)
  useEffect(() => {
    if (!authReady || !profile?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', profile.uid),
      (snap) => {
        if (!snap.exists()) return;
        const raw = snap.data() as Partial<UserProfile>;
        setProfile((prev) => {
          if (!prev) return prev;
          const nextRole = (raw.role as UserProfile['role']) || prev.role;
          const nextTer = raw.territoryId ?? prev.territoryId;
          const nextDist = raw.distributorId ?? prev.distributorId;
          const nextSr = raw.srId ?? prev.srId;
          const nextActive = raw.active !== false;
          if (
            prev.role === nextRole &&
            prev.territoryId === nextTer &&
            prev.distributorId === nextDist &&
            prev.srId === nextSr &&
            prev.active === nextActive
          ) {
            return prev;
          }
          return {
            ...prev,
            role: nextRole,
            territoryId: nextTer,
            distributorId: nextDist,
            srId: nextSr,
            active: nextActive,
          };
        });
      },
      () => undefined
    );
    return () => unsub();
  }, [authReady, profile?.uid]);

  // Real-time Firestore listeners once approved
  useEffect(() => {
    if (!authReady || !profile || !isApproved) return;

    const uid = profile.uid;
    const unsubs: Array<() => void> = [];

    const reportAsyncError = (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    };

    const makeTeamQuery = (collName: string) =>
      isBootstrappedAdmin
        ? collection(db, collName)
        : query(collection(db, collName), where('sharedWithUids', 'array-contains', uid));

    unsubs.push(
      onSnapshot(
        makeTeamQuery('territories'),
        (snap) => {
          setTerritories(
            snap.docs
              .map((d) => d.data() as Territory)
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'territories')
      )
    );

    unsubs.push(
      onSnapshot(
        makeTeamQuery('products'),
        (snap) => {
          setProducts(
            snap.docs
              .map((d) => d.data() as Product)
              .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
          );
          setProductsLoaded(true);
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'products')
      )
    );

    unsubs.push(
      onSnapshot(
        makeTeamQuery('distributors'),
        (snap) => {
          setDistributors(
            snap.docs.map((d) => d.data() as Distributor).sort((a, b) => a.name.localeCompare(b.name))
          );
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'distributors')
      )
    );

    unsubs.push(
      onSnapshot(
        makeTeamQuery('srs'),
        (snap) => {
          setSrs(snap.docs.map((d) => d.data() as SalesRep).sort((a, b) => a.name.localeCompare(b.name)));
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'srs')
      )
    );

    unsubs.push(
      onSnapshot(
        makeTeamQuery('openingStocks'),
        (snap) => {
          setOpeningStocks(snap.docs.map((d) => d.data() as OpeningStock));
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'openingStocks')
      )
    );

    unsubs.push(
      onSnapshot(
        makeTeamQuery('priceHistory'),
        (snap) => {
          setPriceHistory(snap.docs.map((d) => d.data() as PriceHistoryEntry));
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'priceHistory')
      )
    );

    // Transactions & items queries (single-field queries for zero manual index requirements)
    const txQuery = isBootstrappedAdmin
      ? query(collection(db, 'transactions'), where('month', '==', month))
      : profile.role === 'sr'
        ? query(collection(db, 'transactions'), where('createdByUid', '==', uid))
        : query(collection(db, 'transactions'), where('sharedWithUids', 'array-contains', uid));

    const itemQuery = isBootstrappedAdmin
      ? query(collection(db, 'transactionItems'), where('month', '==', month))
      : profile.role === 'sr'
        ? query(collection(db, 'transactionItems'), where('createdByUid', '==', uid))
        : query(collection(db, 'transactionItems'), where('sharedWithUids', 'array-contains', uid));

    unsubs.push(
      onSnapshot(
        txQuery,
        (snap) => {
          setAllTransactions(snap.docs.map((d) => d.data() as Transaction));
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'transactions')
      )
    );

    unsubs.push(
      onSnapshot(
        itemQuery,
        (snap) => {
          setAllItems(snap.docs.map((d) => d.data() as TransactionItem));
        },
        (err) => reportAsyncError(err, OperationType.LIST, 'transactionItems')
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, profile, isApproved, isBootstrappedAdmin, month]);

  const allTeamUids = useMemo(() => {
    const uids = new Set<string>();
    if (profile?.uid) uids.add(profile.uid);
    for (const ter of territories) {
      for (const u of ter.teamUids || []) uids.add(u);
    }
    return Array.from(uids);
  }, [profile?.uid, territories]);

  const getTerritoryTeamUids = useCallback(
    (terId: string) => {
      const ter = territories.find((item) => item.id === terId);
      return ter?.teamUids?.length ? ter.teamUids : profile ? [profile.uid] : [];
    },
    [territories, profile]
  );

  const getTerritoryManagerUids = useCallback(
    (terId: string) => {
      const ter = territories.find((item) => item.id === terId);
      return ter?.managerUids?.length ? ter.managerUids : profile ? [profile.uid] : [];
    },
    [territories, profile]
  );

  // Auto-seed initial catalog on first Admin boot
  const handleSeedCatalog = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return;
    setSeeding(true);
    try {
      const res = await seedInitialTerritoryCatalog(profile.uid, allTeamUids);
      if (res.seeded) {
        notify(
          lang === 'en'
            ? 'Initial SMC catalog loaded (72 products, 5 distributors, 10 SRs).'
            : 'প্রাথমিক তালিকা লোড হয়েছে (৭২টি পণ্য, ৫ ডিস্ট্রিবিউটর, ১০ এসআর)।'
        );
      }
    } finally {
      setSeeding(false);
    }
  }, [profile, allTeamUids, lang, notify]);

  useEffect(() => {
    if (
      isApproved &&
      profile?.role === 'admin' &&
      productsLoaded &&
      products.length === 0 &&
      !autoSeededRef.current
    ) {
      autoSeededRef.current = true;
      void handleSeedCatalog();
    }
  }, [isApproved, profile, productsLoaded, products.length, handleSeedCatalog]);

  // Filter transactions & items by selected month
  const monthTransactions = useMemo(
    () => allTransactions.filter((tx) => tx.month === month),
    [allTransactions, month]
  );
  const monthItems = useMemo(
    () => allItems.filter((it) => it.month === month),
    [allItems, month]
  );

  // Scope records by selected territory (and locked distributor for dealer/sr)
  const scopedDistributors = useMemo(
    () =>
      distributors.filter(
        (d) =>
          (chosenTerritory === 'all' || (d.territoryId || TERRITORY_ID) === chosenTerritory) &&
          (!isDistributorLocked || d.id === profile?.distributorId)
      ),
    [distributors, chosenTerritory, isDistributorLocked, profile?.distributorId]
  );
  const scopedSrs = useMemo(
    () =>
      srs.filter(
        (s) =>
          (chosenTerritory === 'all' || (s.territoryId || TERRITORY_ID) === chosenTerritory) &&
          (!isDistributorLocked || s.distributorId === profile?.distributorId)
      ),
    [srs, chosenTerritory, isDistributorLocked, profile?.distributorId]
  );
  const scopedTransactions = useMemo(
    () =>
      monthTransactions.filter(
        (tx) => chosenTerritory === 'all' || (tx.territoryId || TERRITORY_ID) === chosenTerritory
      ),
    [monthTransactions, chosenTerritory]
  );
  const scopedItems = useMemo(
    () =>
      monthItems.filter(
        (it) => chosenTerritory === 'all' || (it.territoryId || TERRITORY_ID) === chosenTerritory
      ),
    [monthItems, chosenTerritory]
  );
  const scopedOpeningStocks = useMemo(
    () =>
      openingStocks.filter(
        (op) => chosenTerritory === 'all' || (op.territoryId || TERRITORY_ID) === chosenTerritory
      ),
    [openingStocks, chosenTerritory]
  );

  // Role-based nav structure
  const allowedNavGroups = useMemo(() => {
    const role = profile?.role || 'sr';
    const ops: NavPage[] =
      role === 'sr'
        ? ['Dashboard', 'Sales Entry']
        : ['Dashboard', 'Sales Entry', 'Primary Stock'];
    const ledgers: NavPage[] =
      role === 'sr'
        ? ['Stock Ledger', 'Reports']
        : ['Stock Ledger', 'Master Sheet', 'Reports'];
    const setup: NavPage[] =
      role === 'admin'
        ? ['Territories', 'Distributors', 'SR Team', 'Products & Prices', 'Team Access']
        : role === 'tso'
          ? ['Distributors', 'SR Team', 'Products & Prices']
          : role === 'dealer'
            ? ['SR Team', 'Products & Prices']
            : ['Products & Prices'];
    return { ops, ledgers, setup };
  }, [profile?.role]);

  const allAllowedPages = useMemo(
    () => [
      ...allowedNavGroups.ops,
      ...allowedNavGroups.ledgers,
      ...allowedNavGroups.setup,
    ],
    [allowedNavGroups]
  );

  useEffect(() => {
    if (!allAllowedPages.includes(page)) {
      setPage('Dashboard');
    }
  }, [allAllowedPages, page]);

  const handleInspectTx = async (tx: Transaction) => {
    setInspectedTx(tx);
    setLoadingTxDetails(true);
    try {
      const fromCache = monthItems.filter((i) => i.transactionId === tx.id);
      if (fromCache.length > 0) {
        setInspectedItems(fromCache);
      } else {
        const fetched = await fetchItemsForTransaction(tx.id);
        setInspectedItems(fetched);
      }
    } finally {
      setLoadingTxDetails(false);
    }
  };

  const handleDeleteTx = async () => {
    if (!inspectedTx || profile?.role !== 'admin') return;
    await deleteTransactionEntry(inspectedTx.id, inspectedItems);
    setInspectedTx(null);
    notify(lang === 'en' ? 'Transaction deleted.' : 'এন্ট্রি মুছে ফেলা হয়েছে।');
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center">
        <div className="text-sm font-medium text-[#5A6D65]">
          {lang === 'en' ? 'Loading workspace...' : 'লোড হচ্ছে...'}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <SignInScreen
        lang={lang}
        onToggleLang={toggleLang}
        onSignIn={handleSignIn}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (!isApproved) {
    return (
      <PendingApprovalScreen
        lang={lang}
        profile={profile}
        onToggleLang={toggleLang}
        onRefresh={handleRefreshStatus}
        onSignOut={handleSignOut}
        refreshing={refreshingRole}
      />
    );
  }

  const showFilterBar =
    page === 'Dashboard' ||
    page === 'Stock Ledger' ||
    page === 'Master Sheet' ||
    page === 'Reports';

  const showTerritoryStrip = page === 'Distributors' || page === 'SR Team';
  const isTerritoryLocked = Boolean(profile.role !== 'admin' && profile.territoryId);
  const activeTerritories = territories.filter((ter) => ter.active !== false);

  const terLabelForId = (id?: string) => {
    if (!id || id === 'all') return t(lang, 'allTerritories');
    return territories.find((ter) => ter.id === id)?.name || id;
  };

  const sidebarTerritoryLabel = profile.territoryId
    ? terLabelForId(profile.territoryId)
    : t(lang, 'allTerritories');

  const headerTerritoryLabel =
    chosenTerritory !== 'all' ? terLabelForId(chosenTerritory) : t(lang, 'territory');

  const mobileBottomPages: NavPage[] =
    profile.role === 'sr'
      ? ['Dashboard', 'Sales Entry', 'Stock Ledger', 'Reports']
      : ['Dashboard', 'Sales Entry', 'Primary Stock', 'Stock Ledger'];

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-[#13221C] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-[#E3E8E5] sticky top-0 h-screen">
        <div className="h-14 px-5 flex items-center gap-2.5 border-b border-[#EDF2EF]">
          <div className="w-7 h-7 rounded-md bg-[#0A7250] text-white flex items-center justify-center font-display font-bold text-xs shrink-0">
            TS
          </div>
          <span className="font-display font-bold text-sm text-[#13221C] whitespace-nowrap truncate">
            {t(lang, 'brand')}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          <div>
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-[#6C7F77]">
              {t(lang, 'operations')}
            </p>
            <div className="space-y-0.5">
              {allowedNavGroups.ops.map((p) => {
                const Icon = NAV_ICONS[p];
                const active = page === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#EDF6F1] text-[#07573D]'
                        : 'text-[#33463E] hover:bg-[#F5F7F6]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0A7250]' : 'text-[#5A6D65]'}`} />
                    <span className="truncate">{NAV_LABELS[p][lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-[#6C7F77]">
              {t(lang, 'ledgersReports')}
            </p>
            <div className="space-y-0.5">
              {allowedNavGroups.ledgers.map((p) => {
                const Icon = NAV_ICONS[p];
                const active = page === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#EDF6F1] text-[#07573D]'
                        : 'text-[#33463E] hover:bg-[#F5F7F6]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0A7250]' : 'text-[#5A6D65]'}`} />
                    <span className="truncate">{NAV_LABELS[p][lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-3 mb-1.5 text-[11px] font-semibold text-[#6C7F77]">
              {t(lang, 'territorySetup')}
            </p>
            <div className="space-y-0.5">
              {allowedNavGroups.setup.map((p) => {
                const Icon = NAV_ICONS[p];
                const active = page === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#EDF6F1] text-[#07573D]'
                        : 'text-[#33463E] hover:bg-[#F5F7F6]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0A7250]' : 'text-[#5A6D65]'}`} />
                    <span className="truncate">{NAV_LABELS[p][lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-[#EDF2EF] space-y-2.5">
          <div className="px-2 py-1">
            <p className="text-xs font-semibold text-[#13221C] truncate">{profile.displayName}</p>
            <p className="text-[11px] text-[#4E6159] truncate">
              {ROLE_LABELS[profile.role][lang]} · {sidebarTerritoryLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              className="flex-1 min-h-[36px] py-1.5 px-2.5 text-xs font-semibold text-[#33463E] bg-[#F5F7F6] hover:bg-[#EAEFEA] rounded-lg transition-colors whitespace-nowrap"
            >
              {lang === 'en' ? 'বাংলা' : 'English'}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[36px] py-1.5 px-2.5 text-xs font-semibold text-[#4E6159] hover:text-[#13221C] bg-[#F5F7F6] hover:bg-[#EAEFEA] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
              title={t(lang, 'signOut')}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-10">
        {/* Top Bar (3-zone contract: Breadcrumb — CTA) */}
        <header className="h-14 bg-white/90 backdrop-blur-md border-b border-[#E3E8E5] px-4 lg:px-6 flex items-center justify-between gap-8 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="lg:hidden font-display font-bold text-sm text-[#13221C] whitespace-nowrap">
              {t(lang, 'brand')}
            </span>
            <span className="lg:hidden text-[#8FA098]" aria-hidden="true">
              /
            </span>
            <span className="hidden lg:inline text-xs font-medium text-[#4E6159] whitespace-nowrap truncate max-w-[200px]">
              {headerTerritoryLabel}
            </span>
            <span className="hidden lg:inline text-[#8FA098]" aria-hidden="true">
              /
            </span>
            <h1 className="text-sm font-bold text-[#13221C] truncate">
              {NAV_LABELS[page][lang]}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleLang}
              className="lg:hidden min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-[#33463E] bg-[#F5F7F6] rounded-lg whitespace-nowrap"
            >
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => setPage('Sales Entry')}
              className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'newSale')}</span>
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="max-w-6xl w-full mx-auto px-4 lg:px-6 pt-5 space-y-4">
          {toast && (
            <div className="px-4 py-2.5 rounded-xl bg-[#13221C] text-white text-xs font-semibold flex items-center justify-between animate-panel-in">
              <span>{toast}</span>
              <button type="button" onClick={() => setToast(null)} className="text-white/70 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showFilterBar && (
            <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E3E8E5] rounded-xl px-4 py-3">
              <label className="flex items-center gap-2 text-xs text-[#5A6D65] font-medium">
                <span>{t(lang, 'month')}</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-mono-num text-[#14231D] bg-[#F6F8F7] border border-[#DCE4DF] rounded-lg focus:outline-none focus:border-[#0A7250]"
                />
              </label>

              {territories.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-[#5A6D65] font-medium">
                  <span>{t(lang, 'territoryLabel')}</span>
                  <select
                    value={chosenTerritory}
                    disabled={isTerritoryLocked}
                    onChange={(e) => setChosenTerritory(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-[#14231D] bg-[#F6F8F7] border border-[#DCE4DF] rounded-lg focus:outline-none focus:border-[#0A7250] disabled:opacity-70"
                  >
                    {!isTerritoryLocked && (
                      <option value="all">{t(lang, 'allTerritories')}</option>
                    )}
                    {activeTerritories.map((ter) => (
                      <option key={ter.id} value={ter.id}>
                        {ter.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-xs text-[#5A6D65] font-medium">
                <span>{t(lang, 'distributor')}</span>
                <select
                  value={chosenDb}
                  disabled={isDistributorLocked}
                  onChange={(e) => setChosenDb(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#14231D] bg-[#F6F8F7] border border-[#DCE4DF] rounded-lg focus:outline-none focus:border-[#0A7250] disabled:opacity-70"
                >
                  {!isDistributorLocked && (
                    <option value="all">{t(lang, 'allDistributors')}</option>
                  )}
                  {scopedDistributors
                    .filter((d) => d.active !== false)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}

          {showTerritoryStrip && territories.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E2E8E4] rounded-xl px-4 py-2.5">
              <label className="flex items-center gap-2 text-xs text-[#5A6D65] font-medium">
                <span>{t(lang, 'territoryLabel')}</span>
                <select
                  value={chosenTerritory}
                  disabled={isTerritoryLocked}
                  onChange={(e) => setChosenTerritory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#14231D] bg-[#F6F8F7] border border-[#DCE4DF] rounded-lg focus:outline-none focus:border-[#0A7250] disabled:opacity-70"
                >
                  {!isTerritoryLocked && (
                    <option value="all">{t(lang, 'allTerritories')}</option>
                  )}
                  {activeTerritories.map((ter) => (
                    <option key={ter.id} value={ter.id}>
                      {ter.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {page === 'Dashboard' && (
            <DashboardView
              lang={lang}
              role={profile.role}
              month={month}
              chosenDb={chosenDb}
              products={products}
              distributors={scopedDistributors}
              srs={scopedSrs}
              transactions={scopedTransactions}
              items={scopedItems}
              openingStocks={scopedOpeningStocks}
              onNavigate={setPage}
              onInspectTx={handleInspectTx}
              onSeedCatalog={handleSeedCatalog}
              showSeedButton={profile.role === 'admin' && productsLoaded && products.length === 0}
              seeding={seeding}
            />
          )}

          {page === 'Sales Entry' && (
            <EntryView
              kind="Secondary Sales"
              lang={lang}
              profile={profile}
              chosenTerritory={chosenTerritory}
              territories={territories}
              products={products}
              distributors={distributors}
              srs={srs}
              transactions={monthTransactions}
              items={monthItems}
              openingStocks={openingStocks}
              onSubmit={async (payload) => {
                const txId = await createTransactionEntry({
                  ...payload,
                  createdByUid: profile.uid,
                  managerUids: getTerritoryManagerUids(payload.territoryId),
                });
                notify(
                  lang === 'en'
                    ? 'Secondary sales entry saved.'
                    : 'সেকেন্ডারি বিক্রি সেভ হয়েছে।'
                );
                return txId;
              }}
            />
          )}

          {page === 'Primary Stock' && (
            <EntryView
              kind="Primary Stock"
              lang={lang}
              profile={profile}
              chosenTerritory={chosenTerritory}
              territories={territories}
              products={products}
              distributors={distributors}
              srs={srs}
              transactions={monthTransactions}
              items={monthItems}
              openingStocks={openingStocks}
              onSubmit={async (payload) => {
                const txId = await createTransactionEntry({
                  ...payload,
                  createdByUid: profile.uid,
                  managerUids: getTerritoryManagerUids(payload.territoryId),
                });
                notify(
                  lang === 'en'
                    ? 'Primary stock entry saved.'
                    : 'প্রাইমারি স্টক সেভ হয়েছে।'
                );
                return txId;
              }}
            />
          )}

          {page === 'Stock Ledger' && (
            <StockLedgerView
              lang={lang}
              role={profile.role}
              month={month}
              chosenDb={chosenDb}
              products={products}
              distributors={scopedDistributors}
              items={scopedItems}
              openingStocks={scopedOpeningStocks}
              onSaveOpeningStock={async (payload) => {
                await saveOpeningStockRecord({
                  month,
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(
                  lang === 'en' ? 'Opening stock updated.' : 'ওপেনিং স্টক আপডেট হয়েছে।'
                );
              }}
            />
          )}

          {page === 'Master Sheet' && (
            <MasterSheetView
              lang={lang}
              chosenDb={chosenDb}
              products={products}
              distributors={scopedDistributors}
              items={scopedItems}
            />
          )}

          {page === 'Territories' && profile.role === 'admin' && (
            <TerritoriesView
              lang={lang}
              role={profile.role}
              territories={territories}
              distributors={distributors}
              srs={srs}
              onSaveTerritory={async (payload) => {
                await saveTerritoryRecord({
                  ...payload,
                  uid: profile.uid,
                });
                notify(lang === 'en' ? 'Territory saved.' : 'টেরিটরি সেভ হয়েছে।');
              }}
              onToggleTerritory={async (ter) => {
                await toggleTerritoryActive(ter);
                notify(lang === 'en' ? 'Territory status updated.' : 'অবস্থা পরিবর্তিত হয়েছে।');
              }}
              onSaveDistributor={async (payload) => {
                await saveDistributorRecord({
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(lang === 'en' ? 'Distributor saved.' : 'পরিবেশক সেভ হয়েছে।');
              }}
              onSaveSr={async (payload) => {
                await saveSrRecord({
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(lang === 'en' ? 'SR profile saved.' : 'এসআর প্রোফাইল সেভ হয়েছে।');
              }}
            />
          )}

          {page === 'Distributors' && (
            <DistributorsView
              lang={lang}
              role={profile.role}
              chosenTerritory={chosenTerritory}
              territories={territories}
              distributors={distributors}
              srs={srs}
              onSelectTerritory={(terId) => setChosenTerritory(terId)}
              onSaveDistributor={async (payload) => {
                await saveDistributorRecord({
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(lang === 'en' ? 'Distributor saved.' : 'পরিবেশক সেভ হয়েছে।');
              }}
              onToggleDistributor={async (d) => {
                await toggleDistributorActive(d);
                notify(lang === 'en' ? 'Distributor status updated.' : 'অবস্থা পরিবর্তিত হয়েছে।');
              }}
              onSaveSr={async (payload) => {
                await saveSrRecord({
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(lang === 'en' ? 'SR profile saved.' : 'এসআর প্রোফাইল সেভ হয়েছে।');
              }}
            />
          )}

          {page === 'SR Team' && (
            <SrTeamView
              lang={lang}
              role={profile.role}
              chosenTerritory={chosenTerritory}
              lockedDistributorId={profile.role === 'dealer' ? profile.distributorId : undefined}
              territories={territories}
              distributors={distributors}
              srs={srs}
              onSaveSr={async (payload) => {
                await saveSrRecord({
                  ...payload,
                  uid: profile.uid,
                  territoryTeamUids: getTerritoryTeamUids(payload.territoryId),
                });
                notify(lang === 'en' ? 'SR profile saved.' : 'এসআর প্রোফাইল সেভ হয়েছে।');
              }}
              onToggleSr={async (s) => {
                await toggleSrActive(s);
                notify(lang === 'en' ? 'SR status updated.' : 'অবস্থা পরিবর্তিত হয়েছে।');
              }}
            />
          )}

          {page === 'Products & Prices' && (
            <ProductsView
              lang={lang}
              role={profile.role}
              products={products}
              priceHistory={priceHistory}
              onSaveProduct={async (payload) => {
                await saveProductRecord({
                  ...payload,
                  uid: profile.uid,
                  allTeamUids,
                });
                notify(lang === 'en' ? 'Product & price saved.' : 'পণ্য ও মূল্য সেভ হয়েছে।');
              }}
              onToggleProduct={async (p) => {
                await toggleProductActive(p);
                notify(lang === 'en' ? 'Product status updated.' : 'অবস্থা পরিবর্তিত হয়েছে।');
              }}
            />
          )}

          {page === 'Reports' && (
            <ReportsView
              lang={lang}
              role={profile.role}
              month={month}
              chosenTerritory={chosenTerritory}
              chosenDb={chosenDb}
              territories={territories}
              products={products}
              distributors={scopedDistributors}
              srs={scopedSrs}
              transactions={scopedTransactions}
              items={scopedItems}
              openingStocks={scopedOpeningStocks}
              priceHistory={priceHistory}
              onInspectTx={handleInspectTx}
              onImportBackup={async (backup: LegacyBackupPayload) => {
                const defaultTerId =
                  chosenTerritory !== 'all'
                    ? chosenTerritory
                    : activeTerritories[0]?.id || TERRITORY_ID;
                const res = await importLegacyBackupToFirestore({
                  backup,
                  defaultTerritoryId: defaultTerId,
                  adminUid: profile.uid,
                  allTeamUids,
                  territoryTeamUids: getTerritoryTeamUids(defaultTerId),
                  territoryManagerUids: getTerritoryManagerUids(defaultTerId),
                });
                notify(
                  lang === 'en'
                    ? `Backup restored (${res.importedTxCount} entries).`
                    : `ব্যাকআপ রিস্টোর হয়েছে (${res.importedTxCount} টি এন্ট্রি)।`
                );
              }}
            />
          )}

          {page === 'Team Access' && profile.role === 'admin' && (
            <TeamAccessView
              lang={lang}
              currentUid={profile.uid}
              territories={territories}
              distributors={distributors}
              srs={srs}
              onFetchUsers={fetchAdminTeamUsers}
              onUpdateUserAccess={async (params) => {
                await updateTeamMemberAccess({
                  adminUid: profile.uid,
                  territories,
                  ...params,
                });
                notify(
                  lang === 'en'
                    ? 'Team role & permissions synced.'
                    : 'টিম রোল ও অ্যাক্সেস সিঙ্ক হয়েছে।'
                );
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (compact <= 56px, frosted backdrop) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/92 backdrop-blur-md border-t border-[#E3E8E5] h-14 px-1 flex items-center justify-around">
        {mobileBottomPages.map((p) => {
          const Icon = NAV_ICONS[p];
          const active = page === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPage(p);
                setMoreOpen(false);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] min-h-[44px] ${
                active ? 'text-[#0A7250]' : 'text-[#4E6159]'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-semibold whitespace-nowrap">
                {NAV_LABELS[p][lang]}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg min-w-[56px] min-h-[44px] ${
            moreOpen ? 'text-[#0A7250]' : 'text-[#4E6159]'
          }`}
        >
          <Menu className="w-[18px] h-[18px]" />
          <span className="text-[10px] font-semibold whitespace-nowrap">{t(lang, 'more')}</span>
        </button>
      </nav>

      {/* Mobile More Drawer (bottom sheet with grab handle) */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/45 backdrop-blur-xs flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full bg-white rounded-t-3xl px-5 pt-3 pb-6 space-y-4 border-t border-[#E3E8E5] animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#D1DBD6] rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#13221C]">{profile.displayName}</p>
                <p className="text-xs text-[#4E6159]">
                  {ROLE_LABELS[profile.role][lang]} · {sidebarTerritoryLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] rounded-lg flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t(lang, 'signOut')}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {allAllowedPages.map((p) => {
                const Icon = NAV_ICONS[p];
                const active = page === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPage(p);
                      setMoreOpen(false);
                    }}
                    className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                      active
                        ? 'bg-[#EDF6F1] text-[#07573D] border-[#CBE5D6]'
                        : 'bg-[#F7FAF8] text-[#13221C] border-[#E3E8E5]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#0A7250]' : 'text-[#4E6159]'}`} />
                    <span className="truncate">{NAV_LABELS[p][lang]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {inspectedTx && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col animate-panel-in">
            <div className="p-5 border-b border-[#EDF2EF] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#13221C] flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#0A7250]" />
                  <span>{inspectedTx.kind}</span>
                </h3>
                <p className="text-xs text-[#4E6159] mt-0.5 font-mono-num">
                  {inspectedTx.date} · {terLabelForId(inspectedTx.territoryId || TERRITORY_ID)} ·{' '}
                  {distributors.find((d) => d.id === inspectedTx.distributorId)?.name || '—'}
                  {inspectedTx.srId
                    ? ` · ${srs.find((s) => s.id === inspectedTx.srId)?.name || ''}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedTx(null)}
                className="text-xs font-semibold text-[#4E6159] hover:text-[#13221C]"
              >
                {t(lang, 'close')}
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loadingTxDetails ? (
                <p className="text-xs text-[#4E6159] py-6 text-center">
                  {lang === 'en' ? 'Loading items...' : 'লোড হচ্ছে...'}
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E3E8E5] text-[#4E6159]">
                      <th className="py-2">{lang === 'en' ? 'Product' : 'পণ্য'}</th>
                      <th className="py-2 text-right">{lang === 'en' ? 'Qty' : 'পরিমাণ'}</th>
                      <th className="py-2 text-right">{lang === 'en' ? 'Rate' : 'দর'}</th>
                      <th className="py-2 text-right">{lang === 'en' ? 'Total' : 'মোট'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF2EF]">
                    {inspectedItems.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 font-medium text-[#13221C]">{it.product}</td>
                        <td className="py-2.5 text-right font-mono-num">{formatQty(it.qty)}</td>
                        <td className="py-2.5 text-right font-mono-num text-[#4E6159]">
                          {formatMoney(it.price)}
                        </td>
                        <td className="py-2.5 text-right font-mono-num font-semibold text-[#13221C]">
                          {formatMoney(it.qty * it.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-[#EDF2EF] bg-[#F7FAF8] rounded-b-2xl flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-[#13221C] font-mono-num">
                {t(lang, 'totalValue')}: {formatMoney(inspectedTx.totalAmount)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const memo = formatTransactionMemo({
                      lang,
                      tx: inspectedTx,
                      items: inspectedItems,
                      territoryName: terLabelForId(inspectedTx.territoryId || TERRITORY_ID),
                      distributorName:
                        distributors.find((d) => d.id === inspectedTx.distributorId)?.name || '—',
                      srName: inspectedTx.srId
                        ? srs.find((s) => s.id === inspectedTx.srId)?.name
                        : undefined,
                    });
                    void copyToClipboard(memo).then((ok) => {
                      if (ok) {
                        notify(lang === 'en' ? 'Voucher copied to clipboard.' : 'ভাউচার কপি হয়েছে।');
                      }
                    });
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] border border-[#CBE5D6] rounded-lg hover:bg-[#DCEEE4] flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Copy Voucher' : 'ভাউচার কপি'}</span>
                </button>
                {profile.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteTx()}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg hover:bg-[#FEE2E2]"
                  >
                    {t(lang, 'deleteEntry')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
