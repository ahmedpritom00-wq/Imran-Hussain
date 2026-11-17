import { Building2, ChevronDown, ChevronRight, Plus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { t } from '../data/i18n';
import type { Distributor, Lang, SalesRep, Territory, UserRole } from '../types';

interface TerritoriesViewProps {
  lang: Lang;
  role: UserRole;
  territories: Territory[];
  distributors: Distributor[];
  srs: SalesRep[];
  onSaveTerritory: (payload: { id?: string; name: string; active?: boolean }) => Promise<void>;
  onToggleTerritory: (territory: Territory) => Promise<void>;
  onSaveDistributor: (payload: {
    id?: string;
    territoryId: string;
    name: string;
    active?: boolean;
  }) => Promise<void>;
  onSaveSr: (payload: {
    id?: string;
    territoryId: string;
    name: string;
    distributorId: string;
    active?: boolean;
  }) => Promise<void>;
}

export function TerritoriesView({
  lang,
  role,
  territories,
  distributors,
  srs,
  onSaveTerritory,
  onToggleTerritory,
  onSaveDistributor,
  onSaveSr,
}: TerritoriesViewProps) {
  const canEdit = role === 'admin';
  const [expandedTer, setExpandedTer] = useState<Record<string, boolean>>({});

  const [terModalOpen, setTerModalOpen] = useState(false);
  const [editingTer, setEditingTer] = useState<Territory | null>(null);
  const [terName, setTerName] = useState('');

  const [distModalTer, setDistModalTer] = useState<Territory | null>(null);
  const [distName, setDistName] = useState('');

  const [srModalDist, setSrModalDist] = useState<Distributor | null>(null);
  const [srName, setSrName] = useState('');

  const [saving, setSaving] = useState(false);

  const isExpanded = (terId: string) => expandedTer[terId] !== false;
  const toggleExpand = (terId: string) =>
    setExpandedTer((prev) => ({ ...prev, [terId]: !isExpanded(terId) }));

  const openAddTerritory = () => {
    setEditingTer(null);
    setTerName('');
    setTerModalOpen(true);
  };

  const openEditTerritory = (ter: Territory) => {
    setEditingTer(ter);
    setTerName(ter.name);
    setTerModalOpen(true);
  };

  const handleSaveTerritory = async () => {
    if (!terName.trim()) return;
    setSaving(true);
    try {
      await onSaveTerritory({
        id: editingTer?.id,
        name: terName.trim(),
        active: editingTer?.active,
      });
      setTerModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openAddDistributor = (ter: Territory) => {
    setDistModalTer(ter);
    setDistName('');
  };

  const handleSaveDistributor = async () => {
    if (!distModalTer || !distName.trim()) return;
    setSaving(true);
    try {
      await onSaveDistributor({
        territoryId: distModalTer.id,
        name: distName.trim(),
      });
      setExpandedTer((prev) => ({ ...prev, [distModalTer.id]: true }));
      setDistModalTer(null);
    } finally {
      setSaving(false);
    }
  };

  const openAddSr = (d: Distributor) => {
    setSrModalDist(d);
    setSrName('');
  };

  const handleSaveSr = async () => {
    if (!srModalDist || !srName.trim()) return;
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
              {lang === 'en'
                ? 'Territories, Distributors & SRs'
                : 'টেরিটরি, পরিবেশক ও এসআর সেটআপ'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Create a territory, add distributors under that territory, and add Sales Representatives (SRs) under each distributor.'
                : 'প্রথমে নতুন টেরিটরি যোগ করুন, তারপর সেই টেরিটরির অধীনে পরিবেশক (Distributor) এবং প্রতিটি পরিবেশকের অধীনে এসআর (SR) যোগ করুন।'}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openAddTerritory}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(lang, 'addTerritory')}</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-[#E3E8E5] border border-[#E3E8E5] rounded-xl overflow-hidden">
          {territories.map((ter) => {
            const terDists = distributors.filter(
              (d) => (d.territoryId || 'laxmipur') === ter.id
            );
            const activeDistCount = terDists.filter((d) => d.active !== false).length;
            const terSrs = srs.filter((s) => (s.territoryId || 'laxmipur') === ter.id);
            const activeSrCount = terSrs.filter((s) => s.active !== false).length;
            const expanded = isExpanded(ter.id);

            return (
              <div key={ter.id} className="bg-white">
                <div className="px-4 py-3.5 bg-[#F7FAF8] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(ter.id)}
                    className="flex items-center gap-2.5 text-left min-w-0 min-h-[40px]"
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-[#4E6159] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#4E6159] shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[#13221C]">{ter.name}</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            ter.active ? 'text-[#0A7250]' : 'text-[#6C7F77]'
                          }`}
                        >
                          · {ter.active ? t(lang, 'active') : t(lang, 'inactive')}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4E6159] font-mono-num mt-0.5">
                        {activeDistCount} {lang === 'en' ? 'Distributors' : 'পরিবেশক'} ·{' '}
                        {activeSrCount} {lang === 'en' ? 'Active SRs' : 'সক্রিয় এসআর'}
                      </p>
                    </div>
                  </button>

                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAddDistributor(ter)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{t(lang, 'addDistributor')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditTerritory(ter)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg"
                      >
                        {t(lang, 'edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void onToggleTerritory(ter)}
                        className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold text-[#4E6159] hover:text-[#13221C]"
                      >
                        {ter.active ? t(lang, 'deactivate') : t(lang, 'activate')}
                      </button>
                    </div>
                  )}
                </div>

                {expanded && (
                  <div className="divide-y divide-[#EDF2EF] border-t border-[#EDF2EF]">
                    {terDists.length === 0 ? (
                      <div className="px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#4E6159]">
                        <span>
                          {lang === 'en'
                            ? 'No distributors added under this territory yet.'
                            : 'এই টেরিটরির অধীনে এখনো কোনো পরিবেশক যোগ করা হয়নি।'}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openAddDistributor(ter)}
                            className="font-semibold text-[#0A7250] hover:underline"
                          >
                            + {t(lang, 'addDistributor')}
                          </button>
                        )}
                      </div>
                    ) : (
                      terDists.map((d) => {
                        const distSrs = terSrs.filter((s) => s.distributorId === d.id);
                        return (
                          <div
                            key={d.id}
                            className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#FAFDFB]"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#13221C]">{d.name}</span>
                                {!d.active && (
                                  <span className="text-[11px] text-[#6C7F77]">
                                    ({t(lang, 'inactive')})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#4E6159]">
                                <span className="text-[#6C7F77]">
                                  {lang === 'en' ? 'SRs: ' : 'এসআর: '}
                                </span>
                                {distSrs.length === 0 ? (
                                  <span className="text-[#8FA098]">
                                    {lang === 'en' ? 'None yet' : 'এখনো কেউ নেই'}
                                  </span>
                                ) : (
                                  distSrs
                                    .map((s) =>
                                      s.active ? s.name : `${s.name} (${t(lang, 'inactive')})`
                                    )
                                    .join(', ')
                                )}
                              </p>
                            </div>

                            {canEdit && d.active && (
                              <button
                                type="button"
                                onClick={() => openAddSr(d)}
                                className="self-start sm:self-center min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-[#0A7250]" />
                                <span>{t(lang, 'addSr')}</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {terModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">
                {editingTer ? t(lang, 'edit') : t(lang, 'addTerritory')}
              </h3>
              <button
                type="button"
                onClick={() => setTerModalOpen(false)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#4E6159]">
                {t(lang, 'territoryLabel')}
              </span>
              <input
                type="text"
                value={terName}
                onChange={(e) => setTerName(e.target.value)}
                placeholder={lang === 'en' ? 'e.g. Noakhali Territory' : 'যেমন: নোয়াখালী টেরিটরি'}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTerModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                disabled={saving || !terName.trim()}
                onClick={handleSaveTerritory}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] disabled:opacity-50 rounded-lg"
              >
                {saving ? t(lang, 'saving') : t(lang, 'save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {distModalTer && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-sm w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#13221C]">{t(lang, 'addDistributor')}</h3>
                <p className="text-xs text-[#4E6159] mt-0.5">{distModalTer.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setDistModalTer(null)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-[#4E6159]">
                {lang === 'en' ? 'Distributor Name' : 'পরিবেশকের নাম'}
              </span>
              <input
                type="text"
                value={distName}
                onChange={(e) => setDistName(e.target.value)}
                placeholder={lang === 'en' ? 'e.g. Bismillah Traders' : 'যেমন: বিসমিল্লাহ ট্রেডার্স'}
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDistModalTer(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                disabled={saving || !distName.trim()}
                onClick={handleSaveDistributor}
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
                <p className="text-xs text-[#4E6159] mt-0.5">{srModalDist.name}</p>
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
                onClick={handleSaveSr}
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
