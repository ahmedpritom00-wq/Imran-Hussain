import { Check, Copy, Minus, RotateCcw, Search, X, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../data/i18n';
import { formatMoney, formatQty, todayISO } from '../data/initialSeed';
import type {
  Distributor,
  Lang,
  OpeningStock,
  Product,
  SalesRep,
  Territory,
  Transaction,
  TransactionItem,
  TransactionKind,
  UserProfile,
} from '../types';
import { copyToClipboard, formatTransactionMemo } from '../utils/shareUtils';

interface EntryViewProps {
  kind: TransactionKind;
  lang: Lang;
  profile: UserProfile;
  chosenTerritory: string;
  territories: Territory[];
  products: Product[];
  distributors: Distributor[];
  srs: SalesRep[];
  transactions: Transaction[];
  items: TransactionItem[];
  openingStocks: OpeningStock[];
  onSubmit: (payload: {
    territoryId: string;
    kind: TransactionKind;
    date: string;
    distributorId: string;
    srId: string;
    items: Array<{ productId: string; product: string; group: string; qty: number; price: number }>;
  }) => Promise<string>;
}

export function EntryView({
  kind,
  lang,
  profile,
  chosenTerritory,
  territories,
  products,
  distributors,
  srs,
  transactions,
  items,
  openingStocks,
  onSubmit,
}: EntryViewProps) {
  const isSale = kind === 'Secondary Sales';
  const activeTerritories = useMemo(
    () => territories.filter((ter) => ter.active !== false),
    [territories]
  );
  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products]
  );

  const isLockedTerritory = Boolean(profile.territoryId && profile.role !== 'admin');
  const isLockedDistributor = Boolean(
    (profile.role === 'sr' || profile.role === 'dealer') && profile.distributorId
  );
  const isLockedSr = profile.role === 'sr';

  const [territoryId, setTerritoryId] = useState<string>(() => {
    if (profile.territoryId) return profile.territoryId;
    if (chosenTerritory !== 'all') return chosenTerritory;
    return activeTerritories[0]?.id || 'laxmipur';
  });

  useEffect(() => {
    if (profile.territoryId && profile.role !== 'admin') {
      setTerritoryId(profile.territoryId);
    } else if (chosenTerritory !== 'all') {
      setTerritoryId(chosenTerritory);
    } else if (
      activeTerritories.length > 0 &&
      !activeTerritories.some((ter) => ter.id === territoryId)
    ) {
      setTerritoryId(activeTerritories[0].id);
    }
  }, [profile.territoryId, profile.role, chosenTerritory, activeTerritories, territoryId]);

  const activeDistributors = useMemo(
    () =>
      distributors.filter(
        (d) =>
          d.active !== false &&
          (!territoryId || (d.territoryId || 'laxmipur') === territoryId)
      ),
    [distributors, territoryId]
  );

  const activeSrs = useMemo(() => srs.filter((s) => s.active !== false), [srs]);

  const [date, setDate] = useState<string>(todayISO());
  const [distributorId, setDistributorId] = useState<string>(() => {
    if (isLockedDistributor) return profile.distributorId;
    return activeDistributors[0]?.id || '';
  });
  const [srId, setSrId] = useState<string>(() => {
    if (isLockedSr && profile.srId) return profile.srId;
    const firstDist = isLockedDistributor ? profile.distributorId : activeDistributors[0]?.id;
    return activeSrs.find((s) => s.distributorId === firstDist)?.id || '';
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [onlyEntered, setOnlyEntered] = useState<boolean>(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedReceipt, setLastSavedReceipt] = useState<string | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  useEffect(() => {
    if (isLockedDistributor) {
      setDistributorId(profile.distributorId);
      if (isLockedSr && profile.srId) setSrId(profile.srId);
      return;
    }
    if (!activeDistributors.some((d) => d.id === distributorId)) {
      setDistributorId(activeDistributors[0]?.id || '');
    }
  }, [
    isLockedDistributor,
    isLockedSr,
    profile.distributorId,
    profile.srId,
    activeDistributors,
    distributorId,
  ]);

  const srsForDistributor = useMemo(
    () => activeSrs.filter((s) => s.distributorId === distributorId),
    [activeSrs, distributorId]
  );

  useEffect(() => {
    if (!isSale) return;
    if (isLockedSr && profile.srId) {
      setSrId(profile.srId);
      return;
    }
    if (!srsForDistributor.some((s) => s.id === srId)) {
      setSrId(srsForDistributor[0]?.id || '');
    }
  }, [isSale, isLockedSr, profile.srId, srsForDistributor, srId]);

  // Live stock availability per product for the selected distributor & entry month
  const availableStockMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!distributorId) return map;
    const entryMonth = date.slice(0, 7);

    for (const op of openingStocks) {
      if (op.distributorId === distributorId && op.month === entryMonth) {
        map.set(op.productId, (map.get(op.productId) || 0) + op.qty);
      }
    }
    for (const it of items) {
      if (it.distributorId !== distributorId || it.month !== entryMonth) continue;
      const cur = map.get(it.productId) || 0;
      map.set(it.productId, it.kind === 'Primary Stock' ? cur + it.qty : cur - it.qty);
    }
    return map;
  }, [distributorId, date, openingStocks, items]);

  // Find most recent matching transaction for "Repeat Last Entry"
  const lastMatchingTx = useMemo(() => {
    return (
      [...transactions]
        .filter(
          (tx) =>
            tx.kind === kind &&
            tx.distributorId === distributorId &&
            (!isSale || !srId || tx.srId === srId)
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0] || null
    );
  }, [transactions, kind, distributorId, isSale, srId]);

  const handleRepeatLast = () => {
    if (!lastMatchingTx) return;
    const prevItems = items.filter((it) => it.transactionId === lastMatchingTx.id);
    if (prevItems.length === 0) return;
    const nextQty: Record<string, string> = {};
    for (const it of prevItems) {
      if (it.qty > 0) nextQty[it.productId] = String(it.qty);
    }
    setQuantities(nextQty);
    setOnlyEntered(true);
    setError(null);
  };

  const groups = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.group))),
    [activeProducts]
  );

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (selectedGroup !== 'all' && p.group !== selectedGroup) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.group.toLowerCase().includes(q)) return false;
      if (onlyEntered && !(Number(quantities[p.id] || 0) > 0)) return false;
      return true;
    });
  }, [activeProducts, selectedGroup, search, onlyEntered, quantities]);

  const summary = useMemo(() => {
    let totalAmount = 0;
    let totalUnits = 0;
    let skuCount = 0;
    for (const p of activeProducts) {
      const qty = Number(quantities[p.id] || 0);
      if (qty > 0) {
        skuCount += 1;
        totalUnits += qty;
        totalAmount += qty * p.price;
      }
    }
    return { totalAmount, totalUnits, skuCount };
  }, [activeProducts, quantities]);

  const setQty = (productId: string, val: string) => {
    setError(null);
    setQuantities((prev) => ({ ...prev, [productId]: val }));
  };

  const stepQty = (productId: string, delta: number) => {
    const cur = Number(quantities[productId] || 0);
    const next = Math.max(0, Number((cur + delta).toFixed(2)));
    setQty(productId, next === 0 ? '' : String(next));
  };

  const handleSave = async () => {
    setError(null);
    if (!territoryId) {
      setError(lang === 'en' ? 'Please select a territory.' : 'অনুগ্রহ করে টেরিটরি নির্বাচন করুন।');
      return;
    }
    if (!date) {
      setError(lang === 'en' ? 'Please select a date.' : 'অনুগ্রহ করে তারিখ নির্বাচন করুন।');
      return;
    }
    if (!distributorId) {
      setError(
        lang === 'en' ? 'Please select a distributor.' : 'অনুগ্রহ করে ডিস্ট্রিবিউটর নির্বাচন করুন।'
      );
      return;
    }
    if (isSale && !srId) {
      setError(
        lang === 'en'
          ? 'Please select a Sales Representative.'
          : 'অনুগ্রহ করে একজন এসআর নির্বাচন করুন।'
      );
      return;
    }

    const payloadItems = activeProducts
      .map((p) => ({
        productId: p.id,
        product: p.name,
        group: p.group,
        qty: Number(quantities[p.id] || 0),
        price: p.price,
      }))
      .filter((i) => i.qty > 0);

    if (payloadItems.length === 0) {
      setError(
        lang === 'en'
          ? 'Enter quantity for at least one product.'
          : 'কমপক্ষে একটি পণ্যের পরিমাণ লিখুন।'
      );
      return;
    }

    setSaving(true);
    try {
      const txId = await onSubmit({
        territoryId,
        kind,
        date,
        distributorId,
        srId: isSale ? srId : '',
        items: payloadItems,
      });

      const terName = territories.find((ter) => ter.id === territoryId)?.name || territoryId;
      const distName = distributors.find((d) => d.id === distributorId)?.name || distributorId;
      const repName = srs.find((s) => s.id === srId)?.name;

      const totalAmount = payloadItems.reduce((a, i) => a + i.qty * i.price, 0);
      const totalQty = payloadItems.reduce((a, i) => a + i.qty, 0);

      const memo = formatTransactionMemo({
        lang,
        tx: {
          id: txId,
          territoryId,
          kind,
          date,
          month: date.slice(0, 7),
          distributorId,
          srId: isSale ? srId : '',
          totalAmount,
          totalQty,
          itemCount: payloadItems.length,
          sharedWithUids: [],
          createdByUid: profile.uid,
        },
        items: payloadItems.map((it, idx) => ({
          id: `${txId}_${idx}`,
          transactionId: txId,
          territoryId,
          kind,
          date,
          month: date.slice(0, 7),
          distributorId,
          srId: isSale ? srId : '',
          ...it,
          sharedWithUids: [],
          createdByUid: profile.uid,
        })),
        territoryName: terName,
        distributorName: distName,
        srName: repName,
      });

      setLastSavedReceipt(memo);
      setCopiedReceipt(false);
      setQuantities({});
      setOnlyEntered(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyReceipt = async () => {
    if (!lastSavedReceipt) return;
    const ok = await copyToClipboard(lastSavedReceipt);
    if (ok) {
      setCopiedReceipt(true);
      window.setTimeout(() => setCopiedReceipt(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {lastSavedReceipt && (
        <section className="bg-[#EDF6F1] border border-[#CBE5D6] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 animate-panel-in">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#07573D]">
              {lang === 'en'
                ? 'Entry saved to cloud! Admin & TSO can view it live.'
                : 'তথ্য ক্লাউডে সেভ হয়েছে! অ্যাডমিন ও টিএসও এখনই দেখতে পাবেন।'}
            </p>
            <p className="text-[11px] text-[#33463E]">
              {lang === 'en'
                ? 'Copy the itemized voucher to share on WhatsApp or Messenger.'
                : 'হোয়াটসঅ্যাপে শেয়ার করতে নিচের বাটনে ক্লিক করে ভাউচার কপি করুন।'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyReceipt()}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedReceipt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copiedReceipt
                  ? lang === 'en'
                    ? 'Copied!'
                    : 'কপি হয়েছে!'
                  : lang === 'en'
                    ? 'Copy Voucher'
                    : 'ভাউচার কপি'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLastSavedReceipt(null)}
              className="min-h-[38px] px-2.5 text-xs font-semibold text-[#4E6159] hover:text-[#13221C]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {kind === 'Secondary Sales'
                ? lang === 'en'
                  ? 'Secondary Sales Entry'
                  : 'সেকেন্ডারি বিক্রি এন্ট্রি'
                : lang === 'en'
                  ? 'Primary Stock Entry'
                  : 'প্রাইমারি স্টক এন্ট্রি'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {kind === 'Secondary Sales'
                ? lang === 'en'
                  ? 'Select date, distributor, and SR, then enter sold quantities.'
                  : 'তারিখ, পরিবেশক ও এসআর নির্বাচন করে বিক্রিত পণ্যের পরিমাণ লিখুন।'
                : lang === 'en'
                  ? 'Record distributor primary stock lifting quantities for this territory.'
                  : 'পরিবেশকের প্রাইমারি স্টক লিফটিংয়ের পরিমাণ লিখুন।'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastMatchingTx && summary.skuCount === 0 && (
              <button
                type="button"
                onClick={handleRepeatLast}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Repeat Last' : 'আগেরটি রিপিট'}</span>
              </button>
            )}
            {summary.skuCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuantities({});
                  setOnlyEntered(false);
                }}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#4E6159] hover:text-[#13221C] bg-[#F5F7F6] rounded-lg transition-colors"
              >
                {t(lang, 'clearForm')}
              </button>
            )}
          </div>
        </div>

        <div
          className={`grid grid-cols-1 ${
            isSale ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
          } gap-3`}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#4E6159]">
              {t(lang, 'territoryLabel')}
            </span>
            <select
              value={territoryId}
              disabled={isLockedTerritory}
              onChange={(e) => setTerritoryId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-[#DCE4DF] rounded-lg focus:border-[#0A7250] disabled:bg-[#F5F7F6]"
            >
              {activeTerritories.map((ter) => (
                <option key={ter.id} value={ter.id}>
                  {ter.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#4E6159]">{t(lang, 'date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm font-mono-num bg-white border border-[#DCE4DF] rounded-lg focus:border-[#0A7250]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-[#4E6159]">{t(lang, 'distributor')}</span>
            <select
              value={distributorId}
              disabled={isLockedDistributor}
              onChange={(e) => setDistributorId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-[#DCE4DF] rounded-lg focus:border-[#0A7250] disabled:bg-[#F5F7F6]"
            >
              {activeDistributors.length === 0 ? (
                <option value="">
                  {lang === 'en' ? 'No distributors' : 'ডিস্ট্রিবিউটর নেই'}
                </option>
              ) : (
                activeDistributors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </label>

          {isSale && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#4E6159]">{t(lang, 'salesRep')}</span>
              <select
                value={srId}
                disabled={isLockedSr && Boolean(profile.srId)}
                onChange={(e) => setSrId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-[#DCE4DF] rounded-lg focus:border-[#0A7250] disabled:bg-[#F5F7F6]"
              >
                {srsForDistributor.length === 0 ? (
                  <option value="">
                    {lang === 'en' ? 'No SRs assigned' : 'কোনো এসআর নেই'}
                  </option>
                ) : (
                  srsForDistributor.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
        </div>

        {/* Search & Group Filter Strip */}
        <div className="space-y-3 pt-3 border-t border-[#EDF2EF]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(lang, 'searchProduct')}
                className="w-full min-h-[44px] pl-9 pr-9 py-2 text-sm bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#6C7F77] hover:text-[#13221C]"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyEntered((v) => !v)}
              className={`min-h-[44px] px-4 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                onlyEntered
                  ? 'bg-[#0A7250] text-white border-[#0A7250]'
                  : 'bg-white text-[#33463E] border-[#DCE4DF] hover:bg-[#F5F7F6]'
              }`}
            >
              {t(lang, 'onlyEntered')} ({summary.skuCount})
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                selectedGroup === 'all'
                  ? 'bg-[#13221C] text-white'
                  : 'bg-[#F5F7F6] text-[#4E6159] hover:bg-[#EAEFEA]'
              }`}
            >
              {t(lang, 'allGroups')}
            </button>
            {groups.map((grp) => (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                  selectedGroup === grp
                    ? 'bg-[#13221C] text-white'
                    : 'bg-[#F5F7F6] text-[#4E6159] hover:bg-[#EAEFEA]'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        {/* SKU List with Live Stock Hint & 44px touch targets */}
        <div className="divide-y divide-[#EDF2EF] border border-[#EDF2EF] rounded-xl overflow-hidden">
          {visibleProducts.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6C7F77]">
              {lang === 'en' ? 'No matching products.' : 'কোনো পণ্য পাওয়া যায়নি।'}
            </div>
          ) : (
            visibleProducts.map((p) => {
              const rawVal = quantities[p.id] ?? '';
              const qtyNum = Number(rawVal || 0);
              const lineTotal = qtyNum * p.price;
              const hasQty = qtyNum > 0;
              const availStock = availableStockMap.get(p.id) || 0;

              return (
                <div
                  key={p.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 transition-colors ${
                    hasQty ? 'bg-[#F2FBF6]' : 'bg-white hover:bg-[#FAFDFB]'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-[#13221C] truncate">{p.name}</p>
                    <p className="text-xs text-[#4E6159] font-mono-num">
                      {p.group} · {formatMoney(p.price)}
                      {isSale && (
                        <span
                          className={`ml-2 ${
                            availStock < 0
                              ? 'text-[#B91C1C]'
                              : availStock === 0
                                ? 'text-[#6C7F77]'
                                : 'text-[#0A7250]'
                          }`}
                        >
                          · {lang === 'en' ? 'Stock' : 'স্টক'}: {formatQty(availStock)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center border border-[#DCE4DF] rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => stepQty(p.id, -1)}
                        className="w-11 h-11 flex items-center justify-center text-[#33463E] hover:bg-[#F5F7F6] active:bg-[#EAEFEA]"
                        aria-label={`Decrease ${p.name}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0"
                        value={rawVal}
                        onChange={(e) => setQty(p.id, e.target.value)}
                        className="w-20 h-11 text-center text-sm font-semibold font-mono-num text-[#13221C] border-x border-[#EDF2EF] focus:bg-[#F2FBF6]"
                      />
                      <button
                        type="button"
                        onClick={() => stepQty(p.id, 1)}
                        className="w-11 h-11 flex items-center justify-center text-[#33463E] hover:bg-[#F5F7F6] active:bg-[#EAEFEA]"
                        aria-label={`Increase ${p.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-24 text-right">
                      <p
                        className={`text-sm font-mono-num font-bold ${
                          hasQty ? 'text-[#0A7250]' : 'text-[#8FA098]'
                        }`}
                      >
                        {formatMoney(lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]">
            {error}
          </div>
        )}

        {/* Action & Summary Footer */}
        <div className="bg-[#EDF6F1] border border-[#CBE5D6] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#07573D]">
            <div>
              <span className="text-[#4E6159]">{t(lang, 'skusSelected')}: </span>
              <strong className="font-mono-num text-sm">{summary.skuCount}</strong>
            </div>
            <div>
              <span className="text-[#4E6159]">{t(lang, 'totalUnits')}: </span>
              <strong className="font-mono-num text-sm">{formatQty(summary.totalUnits)}</strong>
            </div>
            <div>
              <span className="text-[#4E6159]">{t(lang, 'totalValue')}: </span>
              <strong className="font-mono-num text-base text-[#07573D]">
                {formatMoney(summary.totalAmount)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full sm:w-auto min-h-[48px] sm:min-h-[42px] px-5 py-2.5 text-sm font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] active:scale-[0.99] disabled:opacity-60 rounded-xl transition-all whitespace-nowrap"
          >
            {saving
              ? t(lang, 'saving')
              : isSale
                ? t(lang, 'saveSecondarySales')
                : t(lang, 'savePrimaryStock')}
          </button>
        </div>
      </section>
    </div>
  );
}
