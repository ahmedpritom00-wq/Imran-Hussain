import { Check, Copy, Download, Search, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { t } from '../data/i18n';
import { formatMoney, formatQty } from '../data/initialSeed';
import type {
  Distributor,
  Lang,
  LegacyBackupPayload,
  OpeningStock,
  PriceHistoryEntry,
  Product,
  SalesRep,
  Territory,
  Transaction,
  TransactionItem,
  UserRole,
} from '../types';
import { copyToClipboard, formatExecutiveBrief } from '../utils/shareUtils';

interface ReportsViewProps {
  lang: Lang;
  role: UserRole;
  month: string;
  chosenTerritory: string;
  chosenDb: string;
  territories: Territory[];
  products: Product[];
  distributors: Distributor[];
  srs: SalesRep[];
  transactions: Transaction[];
  items: TransactionItem[];
  openingStocks: OpeningStock[];
  priceHistory: PriceHistoryEntry[];
  onInspectTx: (tx: Transaction) => void;
  onImportBackup: (payload: LegacyBackupPayload) => Promise<void>;
}

export function ReportsView({
  lang,
  role,
  month,
  chosenTerritory,
  chosenDb,
  territories,
  products,
  distributors,
  srs,
  transactions,
  items,
  openingStocks,
  priceHistory,
  onInspectTx,
  onImportBackup,
}: ReportsViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [kindFilter, setKindFilter] = useState<'all' | 'Primary Stock' | 'Secondary Sales'>('all');
  const [search, setSearch] = useState('');
  const [copiedBrief, setCopiedBrief] = useState(false);

  const terName = (id?: string) =>
    territories.find((ter) => ter.id === (id || 'laxmipur'))?.name || id || 'Laxmipur Territory';
  const dbName = (id: string) => distributors.find((d) => d.id === id)?.name || 'Unknown';
  const srName = (id: string) => (id ? srs.find((s) => s.id === id)?.name || '—' : '—');
  const scopeLabel =
    chosenTerritory === 'all' ? t(lang, 'allTerritories') : terName(chosenTerritory);

  const dbScopedTx = useMemo(
    () =>
      transactions
        .filter((tx) => chosenDb === 'all' || tx.distributorId === chosenDb)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, chosenDb]
  );

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dbScopedTx.filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (q) {
        const dName = dbName(tx.distributorId).toLowerCase();
        const sName = srName(tx.srId).toLowerCase();
        if (!dName.includes(q) && !sName.includes(q) && !tx.date.includes(q)) return false;
      }
      return true;
    });
  }, [dbScopedTx, kindFilter, search, distributors, srs]);

  const priTx = dbScopedTx.filter((tx) => tx.kind === 'Primary Stock');
  const secTx = dbScopedTx.filter((tx) => tx.kind === 'Secondary Sales');
  const priVal = priTx.reduce((a, tx) => a + tx.totalAmount, 0);
  const secVal = secTx.reduce((a, tx) => a + tx.totalAmount, 0);
  const totQty = filteredTx.reduce((a, tx) => a + tx.totalQty, 0);

  const exportCsv = () => {
    const rows: string[][] = [
      [
        'Date',
        'Territory',
        'Type',
        'Distributor',
        'SR',
        'Product',
        'Group',
        'Quantity',
        'Unit Price',
        'Value',
      ],
    ];
    const txIds = new Set(filteredTx.map((tx) => tx.id));
    for (const it of items) {
      if (!txIds.has(it.transactionId)) continue;
      rows.push([
        it.date,
        terName(it.territoryId),
        it.kind,
        dbName(it.distributorId),
        srName(it.srId),
        it.product,
        it.group,
        String(it.qty),
        String(it.price),
        String(Number((it.qty * it.price).toFixed(4))),
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Team_Sales_Pro_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBackup = () => {
    const openingMap: Record<string, number> = {};
    for (const op of openingStocks) {
      openingMap[`${op.month}_${op.distributorId}_${op.productId}`] = op.qty;
    }

    const itemsByTx = new Map<string, TransactionItem[]>();
    for (const it of items) {
      const list = itemsByTx.get(it.transactionId) || [];
      list.push(it);
      itemsByTx.set(it.transactionId, list);
    }

    const payload: LegacyBackupPayload = {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        group: p.group,
        price: p.price,
        active: p.active,
      })),
      distributors: distributors.map((d) => ({
        id: d.id,
        territoryId: d.territoryId || 'laxmipur',
        name: d.name,
        active: d.active,
      })),
      srs: srs.map((s) => ({
        id: s.id,
        territoryId: s.territoryId || 'laxmipur',
        name: s.name,
        distributorId: s.distributorId,
        active: s.active,
      })),
      transactions: transactions.map((tx) => ({
        id: tx.id,
        territoryId: tx.territoryId || 'laxmipur',
        kind: tx.kind,
        date: tx.date,
        distributorId: tx.distributorId,
        srId: tx.srId || null,
        items: (itemsByTx.get(tx.id) || []).map((i) => ({
          productId: i.productId,
          product: i.product,
          group: i.group,
          qty: i.qty,
          price: i.price,
        })),
      })),
      priceHistory: priceHistory.map((h) => ({
        date: h.effectiveDate,
        name: h.productName,
        oldPrice: h.oldPrice,
        newPrice: h.newPrice,
      })),
      opening: openingMap,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Team_Sales_Pro_Backup_${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LegacyBackupPayload;
      if (!parsed.products || !parsed.distributors || !parsed.transactions) {
        throw new Error('Invalid backup JSON format.');
      }
      await onImportBackup(parsed);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCopyBrief = async () => {
    const brief = formatExecutiveBrief({
      lang,
      month,
      scopeLabel,
      primaryValue: priVal,
      secondaryValue: secVal,
      primaryCount: priTx.length,
      secondaryCount: secTx.length,
      distributors,
      srs,
      transactions: dbScopedTx,
    });
    const ok = await copyToClipboard(brief);
    if (ok) {
      setCopiedBrief(true);
      window.setTimeout(() => setCopiedBrief(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'primaryStock')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#13221C]">
            {formatMoney(priVal)}
          </p>
          <p className="mt-1 text-xs text-[#6C7F77] font-mono-num">
            {priTx.length} {lang === 'en' ? 'entries' : 'এন্ট্রি'}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'secondarySales')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#0A7250]">
            {formatMoney(secVal)}
          </p>
          <p className="mt-1 text-xs text-[#6C7F77] font-mono-num">
            {secTx.length} {lang === 'en' ? 'entries' : 'এন্ট্রি'}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'totalUnits')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#13221C]">
            {formatQty(totQty)}
          </p>
          <p className="mt-1 text-xs text-[#6C7F77] font-mono-num">
            {filteredTx.length} {lang === 'en' ? 'records shown' : 'টি রেকর্ড'}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5">
          <p className="text-xs font-medium text-[#4E6159]">
            {lang === 'en' ? 'Active Distributors' : 'সক্রিয় ডিস্ট্রিবিউটর'}
          </p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#13221C]">
            {distributors.filter((d) => d.active !== false).length}
          </p>
          <p className="mt-1 text-xs text-[#6C7F77] truncate">{scopeLabel}</p>
        </div>
      </section>

      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? `Monthly Summary · ${month}` : `মাসিক রিপোর্ট · ${month}`}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Inspect every transaction, filter by type, or export Excel-compatible CSV.'
                : 'প্রতিটি বিক্রি ও স্টক এন্ট্রি দেখুন, ফিল্টার করুন বা CSV ডাউনলোড করুন।'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyBrief()}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedBrief ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copiedBrief
                  ? lang === 'en'
                    ? 'Brief Copied!'
                    : 'সারাংশ কপি হয়েছে!'
                  : lang === 'en'
                    ? 'Copy WhatsApp Brief'
                    : 'হোয়াটসঅ্যাপ সারাংশ কপি'}
              </span>
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t(lang, 'exportCsv')}</span>
            </button>
            <button
              type="button"
              onClick={downloadBackup}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg whitespace-nowrap"
            >
              {t(lang, 'downloadBackup')}
            </button>
            {role === 'admin' && (
              <>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{importing ? t(lang, 'saving') : t(lang, 'restoreBackup')}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreFile}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#EDF2EF]">
          <div className="inline-flex items-center p-1 bg-[#F5F7F6] rounded-lg border border-[#E3E8E5]">
            {(
              [
                { key: 'all', en: 'All Entries', bn: 'সব এন্ট্রি' },
                { key: 'Secondary Sales', en: 'Secondary Sales', bn: 'সেকেন্ডারি বিক্রি' },
                { key: 'Primary Stock', en: 'Primary Stock', bn: 'প্রাইমারি স্টক' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setKindFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  kindFilter === tab.key
                    ? 'bg-white text-[#13221C] shadow-xs'
                    : 'text-[#4E6159] hover:text-[#13221C]'
                }`}
              >
                {tab[lang]}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                lang === 'en' ? 'Search distributor, SR or date...' : 'পরিবেশক, এসআর বা তারিখ খুঁজুন...'
              }
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{t(lang, 'date')}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Type' : 'ধরন'}</th>
                <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'SR' : 'এসআর'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'SKUs' : 'পণ্য'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Qty' : 'পরিমাণ'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Value' : 'মূল্য'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Action' : 'অ্যাকশন'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6C7F77]">
                    {t(lang, 'noRecords')}
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#FAFDFB] h-11">
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
                    <td className="py-2.5 px-3.5 text-right font-mono-num text-[#4E6159]">
                      {tx.itemCount}
                    </td>
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
                        className="font-semibold text-[#0A7250] hover:underline"
                      >
                        {t(lang, 'viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
