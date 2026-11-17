import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { t } from '../data/i18n';
import { formatQty } from '../data/initialSeed';
import type {
  Distributor,
  Lang,
  OpeningStock,
  Product,
  TransactionItem,
  UserRole,
} from '../types';

interface StockLedgerViewProps {
  lang: Lang;
  role: UserRole;
  month: string;
  chosenDb: string;
  products: Product[];
  distributors: Distributor[];
  items: TransactionItem[];
  openingStocks: OpeningStock[];
  onSaveOpeningStock: (payload: {
    territoryId: string;
    distributorId: string;
    productId: string;
    qty: number;
  }) => Promise<void>;
}

export function StockLedgerView({
  lang,
  role,
  month,
  chosenDb,
  products,
  distributors,
  items,
  openingStocks,
  onSaveOpeningStock,
}: StockLedgerViewProps) {
  const [search, setSearch] = useState('');
  const [onlyMovement, setOnlyMovement] = useState(false);
  const [onlyShort, setOnlyShort] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products]
  );
  const activeDistributors = useMemo(
    () =>
      distributors.filter(
        (d) => d.active !== false && (chosenDb === 'all' || d.id === chosenDb)
      ),
    [distributors, chosenDb]
  );

  const [opDb, setOpDb] = useState<string>(activeDistributors[0]?.id || '');
  const [opProd, setOpProd] = useState<string>(activeProducts[0]?.id || '');
  const [opQty, setOpQty] = useState<string>('0');
  const [saving, setSaving] = useState(false);

  const openingMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const op of openingStocks) {
      if (op.month === month) {
        map.set(`${op.distributorId}_${op.productId}`, op.qty);
      }
    }
    return map;
  }, [openingStocks, month]);

  const { rows, totals } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: Array<{
      key: string;
      productName: string;
      group: string;
      distributorName: string;
      opening: number;
      primary: number;
      secondary: number;
      closing: number;
    }> = [];

    const priMap = new Map<string, number>();
    const secMap = new Map<string, number>();
    for (const it of items) {
      const k = `${it.distributorId}_${it.productId}`;
      if (it.kind === 'Primary Stock') {
        priMap.set(k, (priMap.get(k) || 0) + it.qty);
      } else {
        secMap.set(k, (secMap.get(k) || 0) + it.qty);
      }
    }

    let totOpening = 0;
    let totPrimary = 0;
    let totSecondary = 0;
    let totClosing = 0;

    for (const p of activeProducts) {
      if (q && !p.name.toLowerCase().includes(q) && !p.group.toLowerCase().includes(q)) {
        continue;
      }
      for (const d of activeDistributors) {
        const k = `${d.id}_${p.id}`;
        const opening = openingMap.get(k) || 0;
        const primary = priMap.get(k) || 0;
        const secondary = secMap.get(k) || 0;
        const closing = opening + primary - secondary;
        if (onlyMovement && opening === 0 && primary === 0 && secondary === 0) {
          continue;
        }
        if (onlyShort && closing >= 0) {
          continue;
        }
        totOpening += opening;
        totPrimary += primary;
        totSecondary += secondary;
        totClosing += closing;
        list.push({
          key: k,
          productName: p.name,
          group: p.group,
          distributorName: d.name,
          opening,
          primary,
          secondary,
          closing,
        });
      }
    }
    return {
      rows: list,
      totals: { totOpening, totPrimary, totSecondary, totClosing },
    };
  }, [activeProducts, activeDistributors, items, openingMap, search, onlyMovement, onlyShort]);

  const openModal = () => {
    setOpDb(activeDistributors[0]?.id || distributors[0]?.id || '');
    setOpProd(activeProducts[0]?.id || '');
    setOpQty('0');
    setModalOpen(true);
  };

  const handleSaveOpening = async () => {
    const dist = distributors.find((d) => d.id === opDb);
    if (!opDb || !opProd || !dist) return;
    setSaving(true);
    try {
      await onSaveOpeningStock({
        territoryId: dist.territoryId || 'laxmipur',
        distributorId: opDb,
        productId: opProd,
        qty: Math.max(0, Number(opQty || 0)),
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'openingStock')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#13221C]">
            {formatQty(totals.totOpening)}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'primaryQty')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#13221C]">
            {formatQty(totals.totPrimary)}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'secondaryQty')}</p>
          <p className="mt-1.5 text-xl font-bold font-mono-num text-[#0A7250]">
            {formatQty(totals.totSecondary)}
          </p>
        </div>
        <div className="bg-white border border-[#E3E8E5] rounded-xl p-4">
          <p className="text-xs font-medium text-[#4E6159]">{t(lang, 'closingQty')}</p>
          <p
            className={`mt-1.5 text-xl font-bold font-mono-num ${
              totals.totClosing < 0 ? 'text-[#B91C1C]' : 'text-[#13221C]'
            }`}
          >
            {formatQty(totals.totClosing)}
          </p>
        </div>
      </section>

      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? 'Stock Ledger' : 'স্টক লেজার'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Closing Stock = Opening Stock + Primary Stock − Secondary Sales'
                : 'ক্লোজিং স্টক = ওপেনিং স্টক + প্রাইমারি স্টক − সেকেন্ডারি বিক্রি'}
            </p>
          </div>

          {(role === 'admin' || role === 'tso' || role === 'dealer') && (
            <button
              type="button"
              onClick={openModal}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'setOpeningStock')}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(lang, 'searchProduct')}
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyMovement((v) => !v)}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
              onlyMovement
                ? 'bg-[#0A7250] text-white border-[#0A7250]'
                : 'bg-white text-[#33463E] border-[#DCE4DF] hover:bg-[#F5F7F6]'
            }`}
          >
            {lang === 'en' ? 'Active stock only' : 'শুধু সক্রিয় স্টক'}
          </button>
          <button
            type="button"
            onClick={() => setOnlyShort((v) => !v)}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
              onlyShort
                ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                : 'bg-white text-[#B91C1C] border-[#FECACA] hover:bg-[#FEF2F2]'
            }`}
          >
            {lang === 'en' ? 'Short stock only' : 'শুধু ঘাটতি স্টক'}
          </button>
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{lang === 'en' ? 'Product' : 'পণ্য'}</th>
                <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                <th className="py-3 px-3.5 text-right">{t(lang, 'openingStock')}</th>
                <th className="py-3 px-3.5 text-right">{t(lang, 'primaryQty')}</th>
                <th className="py-3 px-3.5 text-right">{t(lang, 'secondaryQty')}</th>
                <th className="py-3 px-3.5 text-right">{t(lang, 'closingQty')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6C7F77]">
                    {lang === 'en' ? 'No matching stock rows.' : 'কোনো তথ্য পাওয়া যায়নি।'}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key} className="hover:bg-[#FAFDFB] h-11">
                    <td className="py-2.5 px-3.5 font-medium text-[#13221C]">
                      {r.productName}{' '}
                      <span className="text-[#6C7F77] font-normal">· {r.group}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-[#33463E]">{r.distributorName}</td>
                    <td className="py-2.5 px-3.5 text-right font-mono-num text-[#4E6159]">
                      {r.opening ? formatQty(r.opening) : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono-num text-[#4E6159]">
                      {r.primary ? formatQty(r.primary) : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono-num text-[#0A7250]">
                      {r.secondary ? formatQty(r.secondary) : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-mono-num font-bold ${
                        r.closing < 0 ? 'text-[#B91C1C]' : 'text-[#13221C]'
                      }`}
                    >
                      {formatQty(r.closing)}
                      {r.closing < 0 && (
                        <span className="ml-1 text-[10px] font-normal">
                          ({lang === 'en' ? 'Short' : 'ঘাটতি'})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-md w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">{t(lang, 'setOpeningStock')}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-semibold text-[#4E6159] hover:text-[#13221C]"
              >
                {t(lang, 'close')}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">{t(lang, 'distributor')}</span>
                <select
                  value={opDb}
                  onChange={(e) => setOpDb(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                >
                  {activeDistributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Product' : 'পণ্য'}
                </span>
                <select
                  value={opProd}
                  onChange={(e) => setOpProd(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                >
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? `Opening quantity for ${month}` : `${month} মাসের ওপেনিং পরিমাণ`}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={opQty}
                  onChange={(e) => setOpQty(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono-num border border-[#DCE4DF] rounded-lg"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveOpening}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg"
              >
                {saving ? t(lang, 'saving') : t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
