import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Plus,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { t } from '../data/i18n';
import { formatMoney, formatQty } from '../data/initialSeed';
import type {
  Distributor,
  Lang,
  NavPage,
  OpeningStock,
  Product,
  SalesRep,
  Transaction,
  TransactionItem,
  UserRole,
} from '../types';

interface DashboardViewProps {
  lang: Lang;
  role: UserRole;
  month: string;
  chosenDb: string;
  products: Product[];
  distributors: Distributor[];
  srs: SalesRep[];
  transactions: Transaction[];
  items: TransactionItem[];
  openingStocks: OpeningStock[];
  onNavigate: (page: NavPage) => void;
  onInspectTx: (tx: Transaction) => void;
  onSeedCatalog?: () => void;
  showSeedButton?: boolean;
  seeding?: boolean;
}

export function DashboardView({
  lang,
  role,
  month,
  chosenDb,
  products,
  distributors,
  srs,
  transactions,
  items,
  openingStocks,
  onNavigate,
  onInspectTx,
  onSeedCatalog,
  showSeedButton,
  seeding,
}: DashboardViewProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [lowFilter, setLowFilter] = useState<'all' | 'zero' | 'low'>('all');
  const [showAllLow, setShowAllLow] = useState(false);

  const activeDistributors = useMemo(
    () => distributors.filter((d) => d.active !== false),
    [distributors]
  );
  const activeSrs = useMemo(() => srs.filter((s) => s.active !== false), [srs]);

  const filteredTx = useMemo(
    () => transactions.filter((tx) => chosenDb === 'all' || tx.distributorId === chosenDb),
    [transactions, chosenDb]
  );
  const primaryTx = useMemo(
    () => filteredTx.filter((tx) => tx.kind === 'Primary Stock'),
    [filteredTx]
  );
  const secondaryTx = useMemo(
    () => filteredTx.filter((tx) => tx.kind === 'Secondary Sales'),
    [filteredTx]
  );

  const primaryValue = primaryTx.reduce((a, tx) => a + tx.totalAmount, 0);
  const secondaryValue = secondaryTx.reduce((a, tx) => a + tx.totalAmount, 0);
  const estStockValue = primaryValue - secondaryValue;

  // Daily Run-Rate & Month-End Forecast
  const forecast = useMemo(() => {
    const [yrStr, moStr] = month.split('-');
    const yr = Number(yrStr || new Date().getFullYear());
    const mo = Number(moStr || new Date().getMonth() + 1);
    const daysInMonth = new Date(yr, mo, 0).getDate();

    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = month === currentMonthKey;
    const isPastMonth = month < currentMonthKey;
    const elapsedDays = isCurrentMonth
      ? Math.max(1, today.getDate())
      : isPastMonth
        ? daysInMonth
        : 1;

    const avgPerDay = secondaryValue / elapsedDays;
    const projectedMonthEnd = isPastMonth ? secondaryValue : avgPerDay * daysInMonth;
    const avgTicket = secondaryTx.length > 0 ? secondaryValue / secondaryTx.length : 0;

    return {
      daysInMonth,
      elapsedDays,
      avgPerDay,
      projectedMonthEnd,
      avgTicket,
      isPastMonth,
    };
  }, [month, secondaryValue, secondaryTx.length]);

  // Daily chart series for selected month
  const dailySeries = useMemo(() => {
    const [yrStr, moStr] = month.split('-');
    const daysInMonth = new Date(Number(yrStr), Number(moStr), 0).getDate() || 30;
    const map = new Map<string, { day: string; date: string; pri: number; sec: number; count: number }>();

    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const iso = `${month}-${dd}`;
      map.set(iso, { day: dd, date: iso, pri: 0, sec: 0, count: 0 });
    }

    for (const tx of filteredTx) {
      const slot = map.get(tx.date);
      if (!slot) continue;
      slot.count += 1;
      if (tx.kind === 'Primary Stock') slot.pri += tx.totalAmount;
      else slot.sec += tx.totalAmount;
    }

    return Array.from(map.values());
  }, [month, filteredTx]);

  const maxDailyVal = useMemo(
    () => Math.max(1, ...dailySeries.map((d) => Math.max(d.pri, d.sec))),
    [dailySeries]
  );

  const activeHoverDay = useMemo(() => {
    if (!hoveredDay) return null;
    return dailySeries.find((d) => d.date === hoveredDay) || null;
  }, [hoveredDay, dailySeries]);

  const bestDay = useMemo(() => {
    let best: { date: string; sec: number } | null = null;
    for (const d of dailySeries) {
      if (d.sec > 0 && (!best || d.sec > best.sec)) {
        best = { date: d.date, sec: d.sec };
      }
    }
    return best;
  }, [dailySeries]);

  // Short stock detection (Opening + Primary - Secondary < 0)
  const shortStockAlerts = useMemo(() => {
    const activeProdIds = new Set(products.filter((p) => p.active !== false).map((p) => p.id));
    const scopedDists = activeDistributors.filter(
      (d) => chosenDb === 'all' || d.id === chosenDb
    );
    const openMap = new Map<string, number>();
    for (const op of openingStocks) {
      if (op.month === month) openMap.set(`${op.distributorId}_${op.productId}`, op.qty);
    }
    const priMap = new Map<string, number>();
    const secMap = new Map<string, number>();
    for (const it of items) {
      if (chosenDb !== 'all' && it.distributorId !== chosenDb) continue;
      const k = `${it.distributorId}_${it.productId}`;
      if (it.kind === 'Primary Stock') priMap.set(k, (priMap.get(k) || 0) + it.qty);
      else secMap.set(k, (secMap.get(k) || 0) + it.qty);
    }

    let shortCount = 0;
    const samples: string[] = [];
    for (const d of scopedDists) {
      for (const pId of activeProdIds) {
        const k = `${d.id}_${pId}`;
        const closing = (openMap.get(k) || 0) + (priMap.get(k) || 0) - (secMap.get(k) || 0);
        if (closing < 0) {
          shortCount += 1;
          if (samples.length < 3) {
            const pName = products.find((p) => p.id === pId)?.name || pId;
            samples.push(`${pName} (${d.name})`);
          }
        }
      }
    }
    return { shortCount, samples };
  }, [products, activeDistributors, chosenDb, openingStocks, month, items]);

  const dbName = (id: string) => distributors.find((d) => d.id === id)?.name || 'Unknown';
  const srName = (id: string) => (id ? srs.find((s) => s.id === id)?.name || '—' : '—');

  const maxDistVal = Math.max(
    1,
    ...activeDistributors.map((d) =>
      secondaryTx
        .filter((tx) => tx.distributorId === d.id)
        .reduce((a, tx) => a + tx.totalAmount, 0)
    )
  );

  // Top SR Leaderboard
  const srLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; distName: string; amount: number; orders: number }
    >();
    for (const tx of secondaryTx) {
      if (!tx.srId) continue;
      const existing = map.get(tx.srId);
      if (existing) {
        existing.amount += tx.totalAmount;
        existing.orders += 1;
      } else {
        const srObj = srs.find((s) => s.id === tx.srId);
        map.set(tx.srId, {
          id: tx.srId,
          name: srObj?.name || tx.srId,
          distName: dbName(srObj?.distributorId || tx.distributorId),
          amount: tx.totalAmount,
          orders: 1,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [secondaryTx, srs, distributors]);
  const maxSrVal = Math.max(1, ...srLeaderboard.map((s) => s.amount));

  // Product Group Breakdown
  const secondaryItems = useMemo(
    () =>
      items.filter(
        (it) => it.kind === 'Secondary Sales' && (chosenDb === 'all' || it.distributorId === chosenDb)
      ),
    [items, chosenDb]
  );

  const groupTotals = useMemo(() => {
    const groupTotalsMap = new Map<string, number>();
    for (const it of secondaryItems) {
      groupTotalsMap.set(it.group, (groupTotalsMap.get(it.group) || 0) + it.qty * it.price);
    }
    return Array.from(groupTotalsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [secondaryItems]);
  const maxGroupVal = Math.max(1, ...groupTotals.map(([, val]) => val));

  // Top 5 Hot SKUs & Low/Zero Selling SKUs across all active products
  const { topSkus, lowZeroSkus, zeroSkuCount, lowSkuCount } = useMemo(() => {
    const skuMap = new Map<string, { id: string; name: string; group: string; qty: number; val: number }>();
    for (const p of products) {
      if (p.active === false) continue;
      skuMap.set(p.id, { id: p.id, name: p.name, group: p.group, qty: 0, val: 0 });
    }
    for (const it of secondaryItems) {
      const cur = skuMap.get(it.productId) || {
        id: it.productId,
        name: it.product,
        group: it.group,
        qty: 0,
        val: 0,
      };
      cur.qty += it.qty;
      cur.val += it.qty * it.price;
      skuMap.set(it.productId, cur);
    }

    const allList = Array.from(skuMap.values());
    const top = [...allList]
      .filter((s) => s.qty > 0)
      .sort((a, b) => b.val - a.val || b.qty - a.qty)
      .slice(0, 5);

    const zeroCount = allList.filter((s) => s.qty === 0).length;
    const lowCount = allList.filter((s) => s.qty > 0).length;

    const sortedLow = [...allList].sort(
      (a, b) => a.val - b.val || a.qty - b.qty || a.name.localeCompare(b.name)
    );

    return {
      topSkus: top,
      lowZeroSkus: sortedLow,
      zeroSkuCount: zeroCount,
      lowSkuCount: lowCount,
    };
  }, [products, secondaryItems]);

  const visibleLowZeroSkus = useMemo(() => {
    const filtered =
      lowFilter === 'zero'
        ? lowZeroSkus.filter((s) => s.qty === 0)
        : lowFilter === 'low'
          ? lowZeroSkus.filter((s) => s.qty > 0)
          : lowZeroSkus;
    return showAllLow ? filtered : filtered.slice(0, 6);
  }, [lowZeroSkus, lowFilter, showAllLow]);

  const filteredLowTotalCount = useMemo(() => {
    if (lowFilter === 'zero') return zeroSkuCount;
    if (lowFilter === 'low') return lowSkuCount;
    return lowZeroSkus.length;
  }, [lowFilter, zeroSkuCount, lowSkuCount, lowZeroSkus.length]);

  const recent = [...filteredTx]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      {showSeedButton && onSeedCatalog && (
        <section className="bg-white border border-[#DCE4DF] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#13221C]">
              {lang === 'en' ? 'Territory catalog is empty' : 'টেরিটরি পণ্যের তালিকা এখনো খালি'}
            </h2>
            <p className="text-xs text-[#4E6159]">
              {lang === 'en'
                ? 'Load the 72 SMC products, 5 Laxmipur distributors, and 10 SRs in one click.'
                : 'এক ক্লিকে ৭২টি এসএমসি পণ্য, ৫ জন ডিস্ট্রিবিউটর এবং ১০ জন এসআর লোড করুন।'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSeedCatalog}
            disabled={seeding}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg transition-colors whitespace-nowrap"
          >
            {seeding ? t(lang, 'saving') : t(lang, 'seedNow')}
          </button>
        </section>
      )}

      {/* Smart Stock Alert Banner */}
      {shortStockAlerts.shortCount > 0 && (
        <section className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[#991B1B]">
                {lang === 'en'
                  ? `${shortStockAlerts.shortCount} SKU stock balance(s) are negative`
                  : `${shortStockAlerts.shortCount}টি পণ্যের ক্লোজিং স্টকে ঘাটতি রয়েছে`}
              </p>
              <p className="text-[11px] text-[#B91C1C]/90 mt-0.5">
                {shortStockAlerts.samples.join(' · ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('Stock Ledger')}
            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#991B1B] bg-white border border-[#FECACA] hover:bg-[#FEE2E2] rounded-lg transition-colors whitespace-nowrap"
          >
            {lang === 'en' ? 'Inspect Stock Ledger' : 'স্টক লেজার দেখুন'}
          </button>
        </section>
      )}

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'primaryStock')}</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#13221C] font-mono-num tracking-tight">
            {formatMoney(primaryValue)}
          </p>
          <p className="mt-1.5 text-xs text-[#6C7F77] font-mono-num">
            {primaryTx.length} {lang === 'en' ? 'lifting entries' : 'লিফটিং এন্ট্রি'}
          </p>
        </div>

        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'secondarySales')}</p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#0A7250] font-mono-num tracking-tight">
            {formatMoney(secondaryValue)}
          </p>
          <p className="mt-1.5 text-xs text-[#6C7F77] font-mono-num">
            {secondaryTx.length} {lang === 'en' ? 'orders' : 'অর্ডার'} ·{' '}
            {lang === 'en' ? 'Avg' : 'গড়'} {formatMoney(forecast.avgTicket)}
          </p>
        </div>

        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">
            {forecast.isPastMonth
              ? lang === 'en'
                ? 'Daily Average'
                : 'দৈনিক গড় বিক্রি'
              : lang === 'en'
                ? 'Month-End Pace'
                : 'মাসিক সম্ভাব্য বিক্রি'}
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#13221C] font-mono-num tracking-tight">
            {formatMoney(forecast.isPastMonth ? forecast.avgPerDay : forecast.projectedMonthEnd)}
          </p>
          <p className="mt-1.5 text-xs text-[#6C7F77] font-mono-num">
            {lang === 'en' ? 'Run rate' : 'দৈনিক গতি'}: {formatMoney(forecast.avgPerDay)}/d
          </p>
        </div>

        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'estimatedStock')}</p>
          <p
            className={`mt-2 text-xl sm:text-2xl font-bold font-mono-num tracking-tight ${
              estStockValue < 0 ? 'text-[#B91C1C]' : 'text-[#13221C]'
            }`}
          >
            {formatMoney(estStockValue)}
          </p>
          <p className="mt-1.5 text-xs text-[#6C7F77] font-mono-num">
            {activeSrs.length} {lang === 'en' ? 'SRs' : 'এসআর'} · {activeDistributors.length}{' '}
            {lang === 'en' ? 'Distributors' : 'পরিবেশক'}
          </p>
        </div>
      </section>

      {/* Daily Velocity Trend Chart */}
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#13221C] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#0A7250]" />
              <span>
                {lang === 'en'
                  ? `Daily Sales & Lifting Velocity · ${month}`
                  : `দৈনিক বিক্রি ও লিফটিং ট্রেন্ড · ${month}`}
              </span>
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {activeHoverDay ? (
                <span className="font-mono-num text-[#13221C] font-semibold">
                  {activeHoverDay.date}: {t(lang, 'secondarySales')} {formatMoney(activeHoverDay.sec)} ·{' '}
                  {t(lang, 'primaryStock')} {formatMoney(activeHoverDay.pri)} ({activeHoverDay.count}{' '}
                  {lang === 'en' ? 'entries' : 'এন্ট্রি'})
                </span>
              ) : bestDay ? (
                <span className="font-mono-num">
                  {lang === 'en' ? 'Peak day:' : 'সর্বোচ্চ বিক্রির দিন:'} {bestDay.date} (
                  {formatMoney(bestDay.sec)})
                </span>
              ) : (
                <span>
                  {lang === 'en'
                    ? 'Hover or tap any day bar to inspect daily volume.'
                    : 'যেকোনো দিনের বারের ওপর মাউস বা ট্যাপ করে বিস্তারিত দেখুন।'}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-medium text-[#4E6159]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#0A7250] inline-block" />
              {t(lang, 'secondarySales')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]/80 inline-block" />
              {t(lang, 'primaryStock')}
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-1">
          <div className="min-w-[540px] h-36 flex items-end gap-1 pt-4 border-b border-[#EDF2EF]">
            {dailySeries.map((d) => {
              const secPct = d.sec > 0 ? Math.max(4, (d.sec / maxDailyVal) * 100) : 0;
              const priPct = d.pri > 0 ? Math.max(4, (d.pri / maxDailyVal) * 100) : 0;
              const isSelected = hoveredDay === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onMouseEnter={() => setHoveredDay(d.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => setHoveredDay((cur) => (cur === d.date ? null : d.date))}
                  className={`flex-1 h-full flex flex-col justify-end items-center group rounded-t transition-colors px-0.5 ${
                    isSelected ? 'bg-[#EDF6F1]' : 'hover:bg-[#F7FAF8]'
                  }`}
                  aria-label={`${d.date}: Secondary ${formatMoney(d.sec)}, Primary ${formatMoney(d.pri)}`}
                >
                  <div className="w-full flex-1 flex items-end justify-center gap-[1px]">
                    <div
                      className="w-1/2 bg-[#0A7250] rounded-t-xs transition-all duration-300"
                      style={{ height: `${secPct}%` }}
                    />
                    <div
                      className="w-1/2 bg-[#D97706]/75 rounded-t-xs transition-all duration-300"
                      style={{ height: `${priPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono-num text-[#6C7F77] pt-1 pb-0.5">
                    {Number(d.day) % 2 === 1 || isSelected ? d.day : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Analytical 2-Column Split: Distributors + SR Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <section className="bg-white border border-[#E3E8E5] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-sm font-bold text-[#13221C]">
                {t(lang, 'distributorPerformance')}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('Master Sheet')}
                className="text-xs font-semibold text-[#0A7250] hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                <span>{lang === 'en' ? 'Master Sheet' : 'মাস্টার শিট'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeDistributors.length === 0 ? (
              <p className="text-xs text-[#6C7F77] py-8 text-center">
                {lang === 'en' ? 'No active distributors in scope.' : 'কোনো সক্রিয় পরিবেশক নেই।'}
              </p>
            ) : (
              <div className="space-y-4">
                {activeDistributors.map((d) => {
                  const val = secondaryTx
                    .filter((tx) => tx.distributorId === d.id)
                    .reduce((a, tx) => a + tx.totalAmount, 0);
                  const pct = Math.min(100, (val / maxDistVal) * 100);
                  const share = secondaryValue > 0 ? Math.round((val / secondaryValue) * 100) : 0;
                  return (
                    <div key={d.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#13221C] truncate">{d.name}</span>
                        <span className="font-mono-num font-semibold text-[#33463E] shrink-0">
                          {formatMoney(val)}
                          {secondaryValue > 0 && (
                            <span className="text-[#6C7F77] font-normal ml-1.5">({share}%)</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-[#EDF2EF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0A7250] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-6 border-t border-[#EDF2EF] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('Sales Entry')}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'newSale')}</span>
            </button>
            {(role === 'admin' || role === 'tso' || role === 'dealer') && (
              <button
                type="button"
                onClick={() => onNavigate('Primary Stock')}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg transition-colors whitespace-nowrap"
              >
                + {t(lang, 'primaryStock')}
              </button>
            )}
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('Team Access')}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Invite & Access' : 'টিম ও শেয়ার লিংক'}</span>
              </button>
            )}
          </div>
        </section>

        {/* Top Performing SRs Leaderboard */}
        <section className="bg-white border border-[#E3E8E5] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-sm font-bold text-[#13221C] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0A7250]" />
                <span>
                  {lang === 'en' ? 'Top Performing SRs' : 'শীর্ষ বিক্রয় প্রতিনিধি (এসআর)'}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('SR Team')}
                className="text-xs font-semibold text-[#0A7250] hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                <span>{lang === 'en' ? 'SR Team' : 'এসআর টিম'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {srLeaderboard.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-[#6C7F77]">{t(lang, 'noRecords')}</p>
                <button
                  type="button"
                  onClick={() => onNavigate('Sales Entry')}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg transition-colors"
                >
                  {t(lang, 'logFirstSale')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {srLeaderboard.map((sr, idx) => {
                  const pct = Math.min(100, (sr.amount / maxSrVal) * 100);
                  return (
                    <div key={sr.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md font-mono-num font-bold text-[11px] flex items-center justify-center shrink-0 ${
                              idx === 0
                                ? 'bg-[#0A7250] text-white'
                                : 'bg-[#F5F7F6] text-[#33463E]'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#13221C] truncate">{sr.name}</p>
                            <p className="text-[11px] text-[#6C7F77] truncate">
                              {sr.distName} · {sr.orders} {lang === 'en' ? 'orders' : 'অর্ডার'}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono-num font-bold text-[#13221C] shrink-0">
                          {formatMoney(sr.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#EDF2EF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1C8A65] rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Category, Top Hot SKUs & Low/Zero Selling SKUs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <section className="bg-white border border-[#E3E8E5] rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-sm font-bold text-[#13221C]">
              {t(lang, 'categoryBreakdown')}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('Products & Prices')}
              className="text-xs font-semibold text-[#0A7250] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <span>{lang === 'en' ? 'Price List' : 'মূল্য তালিকা'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {groupTotals.length === 0 ? (
            <p className="text-xs text-[#6C7F77] py-8 text-center">{t(lang, 'noRecords')}</p>
          ) : (
            <div className="space-y-4">
              {groupTotals.map(([grp, val]) => {
                const pct = Math.min(100, (val / maxGroupVal) * 100);
                const share = secondaryValue > 0 ? Math.round((val / secondaryValue) * 100) : 0;
                return (
                  <div key={grp} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#13221C] truncate">{grp}</span>
                      <span className="font-mono-num font-semibold text-[#33463E] shrink-0">
                        {formatMoney(val)}
                        {secondaryValue > 0 && (
                          <span className="text-[#6C7F77] font-normal ml-1.5">({share}%)</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-[#EDF2EF] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0A7250] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-[#E3E8E5] rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-[#13221C]">
              {lang === 'en' ? 'Top Selling Products' : 'সর্বাধিক বিক্রিত পণ্য'}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('Stock Ledger')}
              className="text-xs font-semibold text-[#0A7250] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <span>{lang === 'en' ? 'Stock Ledger' : 'স্টক লেজার'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {topSkus.length === 0 ? (
            <p className="text-xs text-[#6C7F77] py-8 text-center">{t(lang, 'noRecords')}</p>
          ) : (
            <div className="divide-y divide-[#EDF2EF]">
              {topSkus.map((sku, idx) => (
                <div key={sku.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono-num text-[#6C7F77] w-4 shrink-0">0{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#13221C] truncate">{sku.name}</p>
                      <p className="text-[11px] text-[#6C7F77] truncate">{sku.group}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 font-mono-num">
                    <p className="font-bold text-[#13221C]">{formatMoney(sku.val)}</p>
                    <p className="text-[11px] text-[#4E6159]">{formatQty(sku.qty)} u</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-[#E3E8E5] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-[#13221C] flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-[#B45309]" />
                <span>
                  {lang === 'en' ? 'Low & Zero Selling' : 'কম ও শূন্য বিক্রিত পণ্য'}
                </span>
              </h2>
              <span className="text-[11px] font-mono-num font-semibold text-[#B45309]">
                {zeroSkuCount} {lang === 'en' ? 'zero' : 'শূন্য'}
              </span>
            </div>

            <div className="inline-flex items-center p-0.5 bg-[#F5F7F6] rounded-lg border border-[#E3E8E5] mb-3">
              {(
                [
                  { key: 'all', en: 'All', bn: 'সব' },
                  { key: 'zero', en: `Zero (${zeroSkuCount})`, bn: `শূন্য (${zeroSkuCount})` },
                  { key: 'low', en: `Low (${lowSkuCount})`, bn: `কম (${lowSkuCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setLowFilter(tab.key);
                    setShowAllLow(false);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap font-mono-num ${
                    lowFilter === tab.key
                      ? 'bg-white text-[#13221C] shadow-xs'
                      : 'text-[#4E6159] hover:text-[#13221C]'
                  }`}
                >
                  {lang === 'en' ? tab.en : tab.bn}
                </button>
              ))}
            </div>

            {visibleLowZeroSkus.length === 0 ? (
              <p className="text-xs text-[#6C7F77] py-8 text-center">
                {lang === 'en' ? 'No products in this filter.' : 'এই তালিকায় কোনো পণ্য নেই।'}
              </p>
            ) : (
              <div className={`divide-y divide-[#EDF2EF] ${showAllLow ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
                {visibleLowZeroSkus.map((sku) => (
                  <div key={sku.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#13221C] truncate">{sku.name}</p>
                      <p className="text-[11px] text-[#6C7F77] truncate">{sku.group}</p>
                    </div>
                    <div className="text-right shrink-0 font-mono-num">
                      {sku.qty === 0 ? (
                        <span className="text-[11px] font-semibold text-[#B45309]">
                          {lang === 'en' ? '0 sold' : '০ বিক্রি'}
                        </span>
                      ) : (
                        <>
                          <p className="font-semibold text-[#33463E]">{formatMoney(sku.val)}</p>
                          <p className="text-[11px] text-[#6C7F77]">{formatQty(sku.qty)} u</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {filteredLowTotalCount > 6 && (
            <button
              type="button"
              onClick={() => setShowAllLow((v) => !v)}
              className="mt-3 pt-2.5 border-t border-[#EDF2EF] text-xs font-semibold text-[#0A7250] hover:underline text-left"
            >
              {showAllLow
                ? lang === 'en'
                  ? 'Show top 6 only'
                  : 'সংক্ষিপ্ত তালিকা দেখুন'
                : lang === 'en'
                  ? `Show all ${filteredLowTotalCount} products`
                  : `সব ${filteredLowTotalCount}টি পণ্য দেখুন`}
            </button>
          )}
        </section>
      </div>

      {/* Recent Activity Table */}
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#13221C]">{t(lang, 'recentActivity')}</h2>
          <button
            type="button"
            onClick={() => onNavigate('Reports')}
            className="text-xs font-semibold text-[#0A7250] hover:underline whitespace-nowrap"
          >
            {lang === 'en' ? 'View All Reports' : 'সব রিপোর্ট দেখুন'}
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-[#4E6159]">{t(lang, 'noRecords')}</p>
            <button
              type="button"
              onClick={() => onNavigate('Sales Entry')}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg transition-colors"
            >
              {t(lang, 'logFirstSale')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
            <table className="w-full text-left border-collapse min-w-[620px]">
              <thead>
                <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                  <th className="py-3 px-3.5">{t(lang, 'date')}</th>
                  <th className="py-3 px-3.5">{lang === 'en' ? 'Type' : 'ধরন'}</th>
                  <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                  <th className="py-3 px-3.5">{lang === 'en' ? 'SR' : 'এসআর'}</th>
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Qty' : 'পরিমাণ'}</th>
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Value' : 'মূল্য'}</th>
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Action' : 'অ্যাকশন'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EF] text-xs">
                {recent.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#FAFDFB] transition-colors h-11">
                    <td className="py-2.5 px-3.5 font-mono-num text-[#33463E]">{tx.date}</td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`font-semibold ${
                          tx.kind === 'Primary Stock' ? 'text-[#B45309]' : 'text-[#0A7250]'
                        }`}
                      >
                        {tx.kind}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-[#13221C]">
                      {dbName(tx.distributorId)}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#4E6159]">{srName(tx.srId)}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono-num text-[#33463E]">
                      {formatQty(tx.totalQty)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono-num font-bold text-[#13221C]">
                      {formatMoney(tx.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onInspectTx(tx)}
                        className="text-xs font-semibold text-[#0A7250] hover:underline"
                      >
                        {t(lang, 'viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
