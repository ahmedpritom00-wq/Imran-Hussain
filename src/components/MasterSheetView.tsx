import { Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { t } from '../data/i18n';
import { formatMoney, formatQty } from '../data/initialSeed';
import type { Distributor, Lang, Product, TransactionItem } from '../types';

interface MasterSheetViewProps {
  lang: Lang;
  chosenDb: string;
  products: Product[];
  distributors: Distributor[];
  items: TransactionItem[];
}

export function MasterSheetView({
  lang,
  chosenDb,
  products,
  distributors,
  items,
}: MasterSheetViewProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products]
  );
  const dbs = useMemo(
    () =>
      distributors.filter(
        (d) => d.active !== false && (chosenDb === 'all' || d.id === chosenDb)
      ),
    [distributors, chosenDb]
  );

  const groups = useMemo(
    () => Array.from(new Set(activeProducts.map((p) => p.group))),
    [activeProducts]
  );

  const cellAgg = useMemo(() => {
    const qtyMap = new Map<string, number>();
    const valMap = new Map<string, number>();
    for (const it of items) {
      if (it.kind !== 'Secondary Sales') continue;
      const k = `${it.productId}_${it.distributorId}`;
      qtyMap.set(k, (qtyMap.get(k) || 0) + it.qty);
      valMap.set(k, (valMap.get(k) || 0) + it.qty * it.price);
    }
    return { qtyMap, valMap };
  }, [items]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (groupFilter !== 'all' && p.group !== groupFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.group.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [activeProducts, groupFilter, search]);

  const colTotals = useMemo(() => {
    const byDb: Record<string, { qty: number; val: number }> = {};
    for (const d of dbs) byDb[d.id] = { qty: 0, val: 0 };
    let grandQty = 0;
    let grandVal = 0;

    for (const p of filteredProducts) {
      for (const d of dbs) {
        const k = `${p.id}_${d.id}`;
        const q = cellAgg.qtyMap.get(k) || 0;
        const v = cellAgg.valMap.get(k) || 0;
        byDb[d.id].qty += q;
        byDb[d.id].val += v;
        grandQty += q;
        grandVal += v;
      }
    }
    return { byDb, grandQty, grandVal };
  }, [filteredProducts, dbs, cellAgg]);

  return (
    <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#13221C]">
            {lang === 'en'
              ? 'Master Sheet · Product-wise Secondary Sales'
              : 'মাস্টার শিট · পণ্য ভিত্তিক সেকেন্ডারি বিক্রি'}
          </h2>
          <p className="text-xs text-[#4E6159] mt-0.5">
            {lang === 'en'
              ? 'Consolidated quantity and recorded sales value across selected distributors.'
              : 'নির্বাচিত ডিস্ট্রিবিউটরদের পণ্যের পরিমাণ ও বিক্রয় মূল্য একত্রে।'}
          </p>
        </div>
        <div className="text-xs font-mono-num text-[#07573D] bg-[#EDF6F1] px-3 py-1.5 rounded-lg font-semibold">
          {formatQty(colTotals.grandQty)} {lang === 'en' ? 'units' : 'টি'} ·{' '}
          {formatMoney(colTotals.grandVal)}
        </div>
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
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="min-h-[40px] px-3 py-2 text-xs font-semibold bg-white border border-[#DCE4DF] rounded-lg"
        >
          <option value="all">{t(lang, 'allGroups')}</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
              <th className="py-3 px-3.5 sticky left-0 bg-[#F7FAF8] z-10">
                {lang === 'en' ? 'Product' : 'পণ্য'}
              </th>
              <th className="py-3 px-3.5">{lang === 'en' ? 'Group' : 'গ্রুপ'}</th>
              {dbs.map((d) => (
                <th key={d.id} colSpan={2} className="py-3 px-3.5 text-center border-l border-[#E3E8E5]">
                  {d.name}
                </th>
              ))}
              <th className="py-3 px-3.5 text-right border-l border-[#E3E8E5]">
                {lang === 'en' ? 'Total Qty' : 'মোট পরিমাণ'}
              </th>
              <th className="py-3 px-3.5 text-right">
                {lang === 'en' ? 'Total Value' : 'মোট মূল্য'}
              </th>
            </tr>
            <tr className="bg-[#FAFDFB] text-[10px] font-semibold text-[#6C7F77] border-b border-[#E3E8E5]">
              <th className="py-1.5 px-3.5 sticky left-0 bg-[#FAFDFB] z-10" />
              <th className="py-1.5 px-3.5" />
              {dbs.map((d) => (
                <Fragment key={`${d.id}-sub`}>
                  <th className="py-1.5 px-2.5 text-right border-l border-[#EDF2EF]">Qty</th>
                  <th className="py-1.5 px-2.5 text-right">Value</th>
                </Fragment>
              ))}
              <th className="py-1.5 px-3.5 border-l border-[#EDF2EF]" />
              <th className="py-1.5 px-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDF2EF] text-xs">
            {filteredProducts.map((p) => {
              let rowQty = 0;
              let rowVal = 0;
              return (
                <tr key={p.id} className="hover:bg-[#FAFDFB] h-10">
                  <td className="py-2 px-3.5 font-medium text-[#13221C] sticky left-0 bg-white">
                    {p.name}
                  </td>
                  <td className="py-2 px-3.5 text-[#4E6159]">{p.group}</td>
                  {dbs.map((d) => {
                    const k = `${p.id}_${d.id}`;
                    const q = cellAgg.qtyMap.get(k) || 0;
                    const v = cellAgg.valMap.get(k) || 0;
                    rowQty += q;
                    rowVal += v;
                    return (
                      <Fragment key={k}>
                        <td className="py-2 px-2.5 text-right font-mono-num text-[#33463E] border-l border-[#EDF2EF]">
                          {q ? formatQty(q) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono-num text-[#4E6159]">
                          {q ? formatMoney(v) : '—'}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className="py-2 px-3.5 text-right font-mono-num font-bold text-[#13221C] border-l border-[#EDF2EF]">
                    {rowQty ? formatQty(rowQty) : '—'}
                  </td>
                  <td className="py-2 px-3.5 text-right font-mono-num font-bold text-[#0A7250]">
                    {rowVal ? formatMoney(rowVal) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#EDF6F1] border-t border-[#CBE5D6] text-xs font-bold text-[#07573D]">
              <td className="py-3 px-3.5 sticky left-0 bg-[#EDF6F1]">
                {lang === 'en' ? 'Total' : 'সর্বমোট'}
              </td>
              <td className="py-3 px-3.5" />
              {dbs.map((d) => (
                <Fragment key={`${d.id}-tot`}>
                  <td className="py-3 px-2.5 text-right font-mono-num border-l border-[#CBE5D6]">
                    {formatQty(colTotals.byDb[d.id]?.qty)}
                  </td>
                  <td className="py-3 px-2.5 text-right font-mono-num">
                    {formatMoney(colTotals.byDb[d.id]?.val)}
                  </td>
                </Fragment>
              ))}
              <td className="py-3 px-3.5 text-right font-mono-num border-l border-[#CBE5D6]">
                {formatQty(colTotals.grandQty)}
              </td>
              <td className="py-3 px-3.5 text-right font-mono-num">
                {formatMoney(colTotals.grandVal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
