import { Plus, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { t } from '../data/i18n';
import { formatMoney, todayISO } from '../data/initialSeed';
import type {
  Distributor,
  Lang,
  PriceHistoryEntry,
  Product,
  SalesRep,
  Territory,
  UserRole,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Distributors View                                                          */
/* -------------------------------------------------------------------------- */
interface DistributorsViewProps {
  lang: Lang;
  role: UserRole;
  chosenTerritory: string;
  territories: Territory[];
  distributors: Distributor[];
  srs: SalesRep[];
  onSelectTerritory?: (territoryId: string) => void;
  onSaveDistributor: (payload: {
    id?: string;
    territoryId: string;
    name: string;
    active?: boolean;
  }) => Promise<void>;
  onToggleDistributor: (d: Distributor) => Promise<void>;
  onSaveSr?: (payload: {
    id?: string;
    territoryId: string;
    name: string;
    distributorId: string;
    active?: boolean;
  }) => Promise<void>;
}

export function DistributorsView({
  lang,
  role,
  chosenTerritory,
  territories,
  distributors,
  srs,
  onSelectTerritory,
  onSaveDistributor,
  onToggleDistributor,
  onSaveSr,
}: DistributorsViewProps) {
  const canEdit = role === 'admin' || role === 'tso';
  const activeTerritories = territories.filter((ter) => ter.active !== false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [name, setName] = useState('');
  const [territoryId, setTerritoryId] = useState(
    chosenTerritory !== 'all' ? chosenTerritory : activeTerritories[0]?.id || 'laxmipur'
  );
  const [srModalDist, setSrModalDist] = useState<Distributor | null>(null);
  const [srName, setSrName] = useState('');
  const [saving, setSaving] = useState(false);

  const terName = (id: string) => territories.find((ter) => ter.id === id)?.name || id;

  const visibleDistributors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return distributors.filter(
      (d) =>
        (chosenTerritory === 'all' || (d.territoryId || 'laxmipur') === chosenTerritory) &&
        (!q || d.name.toLowerCase().includes(q))
    );
  }, [distributors, chosenTerritory, search]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setTerritoryId(
      chosenTerritory !== 'all' ? chosenTerritory : activeTerritories[0]?.id || 'laxmipur'
    );
    setModalOpen(true);
  };

  const openEdit = (d: Distributor) => {
    setEditing(d);
    setName(d.name);
    setTerritoryId(d.territoryId || 'laxmipur');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !territoryId) return;
    setSaving(true);
    try {
      await onSaveDistributor({
        id: editing?.id,
        territoryId,
        name: name.trim(),
        active: editing?.active,
      });
      if (onSelectTerritory && chosenTerritory !== 'all' && chosenTerritory !== territoryId) {
        onSelectTerritory(territoryId);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInlineSr = async () => {
    if (!srModalDist || !srName.trim() || !onSaveSr) return;
    setSaving(true);
    try {
      await onSaveSr({
        territoryId: srModalDist.territoryId || 'laxmipur',
        distributorId: srModalDist.id,
        name: srName.trim(),
      });
      setSrModalDist(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? 'Distributor Management' : 'পরিবেশক ব্যবস্থাপনা'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Add distributors under a territory and assign SRs directly under each distributor.'
                : 'যেকোনো টেরিটরির অধীনে পরিবেশক যোগ করুন এবং প্রতিটি পরিবেশকের অধীনে এসআর যোগ করুন।'}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'addDistributor')}</span>
            </button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search distributor...' : 'পরিবেশকের নাম খুঁজুন...'}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
          />
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                <th className="py-3 px-3.5">{t(lang, 'territoryLabel')}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Assigned SRs' : 'অধীনস্থ এসআর'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Status' : 'অবস্থা'}</th>
                {canEdit && (
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Manage' : 'ব্যবস্থাপনা'}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {visibleDistributors.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-[#6C7F77]">
                    {lang === 'en'
                      ? 'No distributors found in this territory yet.'
                      : 'এই টেরিটরিতে এখনো কোনো পরিবেশক যোগ করা হয়নি।'}
                  </td>
                </tr>
              ) : (
                visibleDistributors.map((d) => {
                  const distSrs = srs.filter((s) => s.distributorId === d.id && s.active !== false);
                  return (
                    <tr key={d.id} className="hover:bg-[#FAFDFB] h-11">
                      <td className="py-2.5 px-3.5 font-semibold text-[#13221C]">{d.name}</td>
                      <td className="py-2.5 px-3.5 text-[#4E6159]">
                        {terName(d.territoryId || 'laxmipur')}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#33463E]">
                        {distSrs.length === 0 ? (
                          <span className="text-[#8FA098]">
                            {lang === 'en' ? 'None yet' : 'নেই'}
                          </span>
                        ) : (
                          <span>{distSrs.map((s) => s.name).join(', ')}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={d.active ? 'text-[#0A7250] font-semibold' : 'text-[#6C7F77]'}>
                          {d.active ? t(lang, 'active') : t(lang, 'inactive')}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="inline-flex items-center gap-3 whitespace-nowrap">
                            {onSaveSr && d.active && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSrModalDist(d);
                                  setSrName('');
                                }}
                                className="font-semibold text-[#0A7250] hover:underline inline-flex items-center gap-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{t(lang, 'addSr')}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(d)}
                              className="font-semibold text-[#33463E] hover:underline"
                            >
                              {t(lang, 'edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void onToggleDistributor(d)}
                              className="font-semibold text-[#4E6159] hover:text-[#13221C]"
                            >
                              {d.active ? t(lang, 'deactivate') : t(lang, 'activate')}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">
                {editing ? t(lang, 'edit') : t(lang, 'addDistributor')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <div className="space-y-3">
              {role === 'admin' && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#4E6159]">
                    {t(lang, 'territoryLabel')}
                  </span>
                  <select
                    value={territoryId}
                    onChange={(e) => setTerritoryId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                  >
                    {activeTerritories.map((ter) => (
                      <option key={ter.id} value={ter.id}>
                        {ter.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">{t(lang, 'distributor')}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Arafat Traders' : 'যেমন: আরাফাত ট্রেডার্স'}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                disabled={saving || !name.trim() || !territoryId}
                onClick={handleSave}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] disabled:opacity-50 rounded-lg"
              >
                {saving ? t(lang, 'saving') : t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {srModalDist && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#13221C]">{t(lang, 'addSr')}</h3>
                <p className="text-xs text-[#4E6159] mt-0.5">
                  {srModalDist.name} · {terName(srModalDist.territoryId || 'laxmipur')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSrModalDist(null)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#4E6159]">
                {lang === 'en' ? 'SR Name' : 'এসআর-এর নাম'}
              </span>
              <input
                type="text"
                value={srName}
                onChange={(e) => setSrName(e.target.value)}
                placeholder={lang === 'en' ? 'e.g. Mahabubur Rahman' : 'যেমন: মাহাবুবুর রহমান'}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSrModalDist(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                disabled={saving || !srName.trim()}
                onClick={handleSaveInlineSr}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] disabled:opacity-50 rounded-lg"
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

/* -------------------------------------------------------------------------- */
/* SR Team View                                                               */
/* -------------------------------------------------------------------------- */
interface SrTeamViewProps {
  lang: Lang;
  role: UserRole;
  chosenTerritory: string;
  lockedDistributorId?: string;
  territories: Territory[];
  distributors: Distributor[];
  srs: SalesRep[];
  onSaveSr: (payload: {
    id?: string;
    territoryId: string;
    name: string;
    distributorId: string;
    active?: boolean;
  }) => Promise<void>;
  onToggleSr: (s: SalesRep) => Promise<void>;
}

export function SrTeamView({
  lang,
  role,
  chosenTerritory,
  lockedDistributorId,
  territories,
  distributors,
  srs,
  onSaveSr,
  onToggleSr,
}: SrTeamViewProps) {
  const canEdit = role === 'admin' || role === 'tso' || role === 'dealer';
  const activeTerritories = useMemo(
    () => territories.filter((ter) => ter.active !== false),
    [territories]
  );
  const [search, setSearch] = useState('');

  const visibleSrs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return srs.filter(
      (s) =>
        (chosenTerritory === 'all' || (s.territoryId || 'laxmipur') === chosenTerritory) &&
        (!lockedDistributorId || s.distributorId === lockedDistributorId) &&
        (!q || s.name.toLowerCase().includes(q))
    );
  }, [srs, chosenTerritory, lockedDistributorId, search]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesRep | null>(null);
  const [name, setName] = useState('');
  const [modalTerId, setModalTerId] = useState(
    chosenTerritory !== 'all' ? chosenTerritory : activeTerritories[0]?.id || 'laxmipur'
  );
  const [distId, setDistId] = useState('');
  const [saving, setSaving] = useState(false);

  const dbName = (id: string) => distributors.find((d) => d.id === id)?.name || 'Unknown';
  const terName = (id: string) => territories.find((ter) => ter.id === id)?.name || id;

  const modalDists = useMemo(
    () =>
      distributors.filter(
        (d) =>
          d.active !== false &&
          (!modalTerId || (d.territoryId || 'laxmipur') === modalTerId) &&
          (!lockedDistributorId || d.id === lockedDistributorId)
      ),
    [distributors, modalTerId, lockedDistributorId]
  );

  const openAdd = () => {
    const startTer =
      chosenTerritory !== 'all' ? chosenTerritory : activeTerritories[0]?.id || 'laxmipur';
    const firstDist = distributors.find(
      (d) =>
        d.active !== false &&
        (d.territoryId || 'laxmipur') === startTer &&
        (!lockedDistributorId || d.id === lockedDistributorId)
    );
    setEditing(null);
    setName('');
    setModalTerId(startTer);
    setDistId(lockedDistributorId || firstDist?.id || '');
    setModalOpen(true);
  };

  const openEdit = (s: SalesRep) => {
    const srDist = distributors.find((d) => d.id === s.distributorId);
    const srTer = srDist?.territoryId || s.territoryId || 'laxmipur';
    setEditing(s);
    setName(s.name);
    setModalTerId(srTer);
    setDistId(s.distributorId);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const dist = distributors.find((d) => d.id === distId);
    if (!name.trim() || !distId || !dist) return;
    setSaving(true);
    try {
      await onSaveSr({
        id: editing?.id,
        territoryId: dist.territoryId || 'laxmipur',
        name: name.trim(),
        distributorId: distId,
        active: editing?.active,
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? 'SR Team Management' : 'এসআর টিম ব্যবস্থাপনা'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Add, rename, or transfer Sales Representatives between distributors without losing history.'
                : 'নতুন এসআর যোগ করুন বা পরিবেশক পরিবর্তন করুন; পূর্বের তথ্য অপরিবর্তিত থাকবে।'}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'addSr')}</span>
            </button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search SR name...' : 'এসআর-এর নাম খুঁজুন...'}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
          />
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{lang === 'en' ? 'SR Name' : 'এসআর নাম'}</th>
                <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                <th className="py-3 px-3.5">{t(lang, 'territoryLabel')}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Status' : 'অবস্থা'}</th>
                {canEdit && (
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Manage' : 'ব্যবস্থাপনা'}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {visibleSrs.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="py-8 text-center text-[#6C7F77]">
                    {lang === 'en'
                      ? 'No SRs added in this territory yet.'
                      : 'এই টেরিটরিতে এখনো কোনো এসআর যোগ করা হয়নি।'}
                  </td>
                </tr>
              ) : (
                visibleSrs.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFDFB] h-11">
                    <td className="py-2.5 px-3.5 font-semibold text-[#13221C]">{s.name}</td>
                    <td className="py-2.5 px-3.5 text-[#33463E]">{dbName(s.distributorId)}</td>
                    <td className="py-2.5 px-3.5 text-[#4E6159]">
                      {terName(s.territoryId || 'laxmipur')}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={s.active ? 'text-[#0A7250] font-semibold' : 'text-[#6C7F77]'}>
                        {s.active ? t(lang, 'active') : t(lang, 'inactive')}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="py-2.5 px-3.5 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="font-semibold text-[#0A7250] hover:underline"
                        >
                          {role === 'dealer'
                            ? t(lang, 'edit')
                            : lang === 'en'
                              ? 'Edit / Transfer'
                              : 'এডিট / ট্রান্সফার'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggleSr(s)}
                          className="font-semibold text-[#4E6159] hover:text-[#13221C]"
                        >
                          {s.active ? t(lang, 'deactivate') : t(lang, 'activate')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">
                {editing ? (lang === 'en' ? 'Edit SR' : 'এসআর এডিট') : t(lang, 'addSr')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <div className="space-y-3">
              {role === 'admin' && activeTerritories.length > 0 && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#4E6159]">
                    {t(lang, 'territoryLabel')}
                  </span>
                  <select
                    value={modalTerId}
                    onChange={(e) => {
                      const nextTer = e.target.value;
                      setModalTerId(nextTer);
                      const firstDist = distributors.find(
                        (d) => d.active !== false && (d.territoryId || 'laxmipur') === nextTer
                      );
                      setDistId(firstDist?.id || '');
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                  >
                    {activeTerritories.map((ter) => (
                      <option key={ter.id} value={ter.id}>
                        {ter.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {t(lang, 'distributor')}
                </span>
                <select
                  value={distId}
                  disabled={Boolean(lockedDistributorId)}
                  onChange={(e) => setDistId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg disabled:bg-[#F5F7F6]"
                >
                  {modalDists.length === 0 ? (
                    <option value="">
                      {lang === 'en'
                        ? 'No distributors in this territory'
                        : 'এই টেরিটরিতে কোনো পরিবেশক নেই'}
                    </option>
                  ) : (
                    modalDists.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'SR Name' : 'এসআর নাম'}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Mahabubur Rahman' : 'যেমন: মাহাবুবুর রহমান'}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              {modalDists.length === 0 ? (
                <p className="text-[11px] text-[#B45309]">
                  {lang === 'en'
                    ? 'Add a distributor in this territory first.'
                    : 'আগে এই টেরিটরিতে পরিবেশক যোগ করুন।'}
                </p>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving || !name.trim() || !distId}
                  onClick={handleSave}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] disabled:opacity-50 rounded-lg"
                >
                  {saving ? t(lang, 'saving') : t(lang, 'save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Products & Prices View (Shared Company Catalog across all Territories)     */
/* -------------------------------------------------------------------------- */
interface ProductsViewProps {
  lang: Lang;
  role: UserRole;
  products: Product[];
  priceHistory: PriceHistoryEntry[];
  onSaveProduct: (payload: {
    existing?: Product;
    name: string;
    group: string;
    price: number;
    effectiveDate: string;
  }) => Promise<void>;
  onToggleProduct: (p: Product) => Promise<void>;
}

export function ProductsView({
  lang,
  role,
  products,
  priceHistory,
  onSaveProduct,
  onToggleProduct,
}: ProductsViewProps) {
  const canEdit = role === 'admin';
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Other');
  const [price, setPrice] = useState('0');
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)
    );
  }, [products, search]);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setGroup('Condom');
    setPrice('0');
    setEffectiveDate(todayISO());
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setGroup(p.group);
    setPrice(String(p.price));
    setEffectiveDate(todayISO());
    setModalOpen(true);
  };

  const handleSave = async () => {
    const priceNum = Number(price);
    if (!name.trim() || !group.trim() || !Number.isFinite(priceNum) || priceNum < 0) return;
    setSaving(true);
    try {
      await onSaveProduct({
        existing: editing || undefined,
        name: name.trim(),
        group: group.trim(),
        price: priceNum,
        effectiveDate,
      });
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? 'Products & Price Control' : 'পণ্য ও মূল্য নিয়ন্ত্রণ'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Company-wide SKU prices apply across all territories for new entries while historical records retain their entry price.'
                : 'এই পণ্যের দাম সব টেরিটরিতে প্রযোজ্য হবে; পুরোনো বিক্রয়ের দাম অপরিবর্তিত থাকবে।'}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAdd}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'addProduct')}</span>
            </button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-[#6C7F77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, 'searchProduct')}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg focus:bg-white focus:border-[#0A7250]"
          />
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[580px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{lang === 'en' ? 'Product / SKU' : 'পণ্যের নাম'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Group' : 'গ্রুপ'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Current Price' : 'বর্তমান মূল্য'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Status' : 'অবস্থা'}</th>
                {canEdit && (
                  <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Manage' : 'ব্যবস্থাপনা'}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAFDFB] h-11">
                  <td className="py-2.5 px-3.5 font-semibold text-[#13221C]">{p.name}</td>
                  <td className="py-2.5 px-3.5 text-[#4E6159]">{p.group}</td>
                  <td className="py-2.5 px-3.5 text-right font-mono-num font-bold text-[#13221C]">
                    {formatMoney(p.price)}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className={p.active ? 'text-[#0A7250] font-semibold' : 'text-[#6C7F77]'}>
                      {p.active ? t(lang, 'active') : t(lang, 'inactive')}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="py-2.5 px-3.5 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="font-semibold text-[#0A7250] hover:underline"
                      >
                        {lang === 'en' ? 'Edit price' : 'দাম পরিবর্তন'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleProduct(p)}
                        className="font-semibold text-[#4E6159] hover:text-[#13221C]"
                      >
                        {p.active ? t(lang, 'deactivate') : t(lang, 'activate')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#13221C]">
          {lang === 'en' ? 'Recent Price Changes' : 'সাম্প্রতিক মূল্য পরিবর্তনের ইতিহাস'}
        </h3>
        {priceHistory.length === 0 ? (
          <p className="text-xs text-[#6C7F77] py-4">
            {lang === 'en' ? 'No price changes recorded yet.' : 'এখনো কোনো মূল্য পরিবর্তন হয়নি।'}
          </p>
        ) : (
          <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead>
                <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                  <th className="py-2.5 px-3.5">{t(lang, 'date')}</th>
                  <th className="py-2.5 px-3.5">{lang === 'en' ? 'Product' : 'পণ্য'}</th>
                  <th className="py-2.5 px-3.5 text-right">{lang === 'en' ? 'Old Price' : 'পূর্বের দাম'}</th>
                  <th className="py-2.5 px-3.5 text-right">{lang === 'en' ? 'New Price' : 'নতুন দাম'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF2EF] text-xs">
                {[...priceHistory]
                  .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
                  .slice(0, 20)
                  .map((h) => (
                    <tr key={h.id} className="h-10">
                      <td className="py-2 px-3.5 font-mono-num text-[#4E6159]">{h.effectiveDate}</td>
                      <td className="py-2 px-3.5 font-medium text-[#13221C]">{h.productName}</td>
                      <td className="py-2 px-3.5 text-right font-mono-num text-[#6C7F77]">
                        {formatMoney(h.oldPrice)}
                      </td>
                      <td className="py-2 px-3.5 text-right font-mono-num font-bold text-[#0A7250]">
                        {formatMoney(h.newPrice)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">
                {editing ? (lang === 'en' ? 'Edit Product & Price' : 'পণ্য ও দাম এডিট') : t(lang, 'addProduct')}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Product Name' : 'পণ্যের নাম'}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Product Group' : 'পণ্যের গ্রুপ'}
                </span>
                <input
                  type="text"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Unit Price (৳)' : 'একক মূল্য (৳)'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono-num border border-[#DCE4DF] rounded-lg"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Effective Date' : 'কার্যকর তারিখ'}
                </span>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm font-mono-num border border-[#DCE4DF] rounded-lg"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
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
                onClick={handleSave}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] rounded-lg"
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
