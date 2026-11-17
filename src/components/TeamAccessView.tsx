import { Check, Copy, Link2, RefreshCw, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, t } from '../data/i18n';
import type { Distributor, Lang, SalesRep, Territory, UserProfile, UserRole } from '../types';
import { copyToClipboard, getShareableAppUrl } from '../utils/shareUtils';

interface TeamAccessViewProps {
  lang: Lang;
  currentUid: string;
  territories: Territory[];
  distributors: Distributor[];
  srs: SalesRep[];
  onFetchUsers: () => Promise<UserProfile[]>;
  onUpdateUserAccess: (params: {
    targetUser: UserProfile;
    newRole: UserRole;
    territoryId: string;
    distributorId: string;
    srId: string;
    active: boolean;
    allUsers: UserProfile[];
  }) => Promise<void>;
}

export function TeamAccessView({
  lang,
  currentUid,
  territories,
  distributors,
  srs,
  onFetchUsers,
  onUpdateUserAccess,
}: TeamAccessViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'approved'>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [roleVal, setRoleVal] = useState<UserRole>('sr');
  const [terId, setTerId] = useState('');
  const [distId, setDistId] = useState('');
  const [srId, setSrId] = useState('');
  const [activeVal, setActiveVal] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const shareUrl = useMemo(() => getShareableAppUrl(), []);

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyInvite = async () => {
    const msg =
      lang === 'bn'
        ? `টিম সেলস প্রো (Team Sales Pro) অ্যাপে স্বাগতম!\n\n১. নিচের লিংকে ক্লিক করুন:\n${shareUrl}\n\n২. আপনার Google অ্যাকাউন্ট দিয়ে লগইন করুন।\n৩. লগইন করার পর অ্যাডমিন আপনার রোল (TSO / ডিলার / এসআর) ও টেরিটরি অনুমোদন দিলেই আপনি বিক্রি ও স্টক এন্ট্রি দিতে পারবেন।`
        : `Welcome to Team Sales Pro!\n\n1. Open this link:\n${shareUrl}\n\n2. Sign in with your Google account.\n3. Once Admin assigns your Role (TSO / Dealer / SR) and Territory, your workspace unlocks automatically and syncs live.`;
    const ok = await copyToClipboard(msg);
    if (ok) {
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2500);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const list = await onFetchUsers();
      setUsers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const terName = (id: string) => territories.find((ter) => ter.id === id)?.name || 'All';
  const dbName = (id: string) => distributors.find((d) => d.id === id)?.name || '—';
  const srName = (id: string) => srs.find((s) => s.id === id)?.name || '—';

  const activeTerritories = territories.filter((ter) => ter.active !== false);

  const pendingCount = useMemo(() => users.filter((u) => u.role === 'pending').length, [users]);
  const visibleUsers = useMemo(() => {
    if (statusTab === 'pending') return users.filter((u) => u.role === 'pending');
    if (statusTab === 'approved') return users.filter((u) => u.role !== 'pending');
    return users;
  }, [users, statusTab]);

  const openEdit = (u: UserProfile) => {
    const defaultTer = u.territoryId || activeTerritories[0]?.id || 'laxmipur';
    const distsInTer = distributors.filter(
      (d) => d.active !== false && (d.territoryId || 'laxmipur') === defaultTer
    );
    setEditingUser(u);
    setRoleVal(u.role);
    setTerId(u.role === 'admin' ? u.territoryId || '' : defaultTer);
    setDistId(u.distributorId || distsInTer[0]?.id || '');
    setSrId(u.srId || '');
    setActiveVal(u.active);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await onUpdateUserAccess({
        targetUser: editingUser,
        newRole: roleVal,
        territoryId: roleVal === 'pending' ? '' : terId,
        distributorId: roleVal === 'sr' || roleVal === 'dealer' ? distId : '',
        srId: roleVal === 'sr' ? srId : '',
        active: activeVal,
        allUsers: users,
      });
      setEditingUser(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const distsForTer = distributors.filter(
    (d) => d.active !== false && (!terId || (d.territoryId || 'laxmipur') === terId)
  );
  const srsForDist = srs.filter((s) => s.active !== false && s.distributorId === distId);

  return (
    <div className="space-y-4">
      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#13221C] flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#0A7250]" />
              <span>
                {lang === 'en'
                  ? 'Share App Link & Team Onboarding'
                  : 'টিমের সবাইকে অ্যাপ লিংক শেয়ার করুন'}
              </span>
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">
              {lang === 'en'
                ? 'Share this official app URL with TSOs, Dealers, and SRs. Once approved below, all entries sync live to Admin and TSO.'
                : 'টিএসও, ডিলার ও এসআর-দের এই লিংকটি দিন। লগইন করার পর নিচে থেকে রোল অনুমোদন দিলেই সবার এন্ট্রি অ্যাডমিন ও টিএসও লাইভ দেখতে পাবেন।'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0A7250] hover:bg-[#07573D] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copiedLink
                  ? lang === 'en'
                    ? 'Link Copied!'
                    : 'লিংক কপি হয়েছে!'
                  : lang === 'en'
                    ? 'Copy App Link'
                    : 'অ্যাপ লিংক কপি'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopyInvite()}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-[#07573D] bg-[#EDF6F1] hover:bg-[#DCEEE4] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              {copiedInvite ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>
                {copiedInvite
                  ? lang === 'en'
                    ? 'Invite Copied!'
                    : 'মেসেজ কপি হয়েছে!'
                  : lang === 'en'
                    ? 'Copy WhatsApp Invite'
                    : 'হোয়াটসঅ্যাপ ইনভাইট কপি'}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-[#F7FAF8] border border-[#DCE4DF] rounded-lg px-3 py-2 text-xs font-mono-num text-[#13221C] truncate select-all">
          {shareUrl}
        </div>
      </section>

      <section className="bg-white border border-[#E3E8E5] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#13221C]">
              {lang === 'en' ? 'Team Access & Roles' : 'টিম অ্যাক্সেস ও রোল'}
            </h2>
            <p className="text-xs text-[#4E6159] mt-0.5">{t(lang, 'teamAccessDesc')}</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] hover:bg-[#F5F7F6] rounded-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'en' ? 'Refresh' : 'রিফ্রেশ'}</span>
          </button>
        </div>

        <div className="inline-flex items-center p-1 bg-[#F5F7F6] rounded-lg border border-[#E3E8E5]">
          {(
            [
              { key: 'all', label: `${lang === 'en' ? 'All' : 'সব'} (${users.length})` },
              {
                key: 'pending',
                label: `${lang === 'en' ? 'Pending' : 'অপেক্ষমান'} (${pendingCount})`,
              },
              {
                key: 'approved',
                label: `${lang === 'en' ? 'Approved' : 'অনুমোদিত'} (${users.length - pendingCount})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap font-mono-num ${
                statusTab === tab.key
                  ? 'bg-white text-[#13221C] shadow-xs'
                  : 'text-[#4E6159] hover:text-[#13221C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto border border-[#EDF2EF] rounded-xl">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-[#F7FAF8] text-[11px] font-semibold text-[#4E6159] border-b border-[#E3E8E5]">
                <th className="py-3 px-3.5">{lang === 'en' ? 'Member' : 'সদস্য'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Email' : 'ইমেইল'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Role' : 'রোল'}</th>
                <th className="py-3 px-3.5">{t(lang, 'territoryLabel')}</th>
                <th className="py-3 px-3.5">{t(lang, 'distributor')}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'SR Profile' : 'এসআর প্রোফাইল'}</th>
                <th className="py-3 px-3.5">{lang === 'en' ? 'Status' : 'অবস্থা'}</th>
                <th className="py-3 px-3.5 text-right">{lang === 'en' ? 'Manage' : 'ব্যবস্থাপনা'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2EF] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6C7F77]">
                    {lang === 'en' ? 'Loading team members...' : 'তালিকা লোড হচ্ছে...'}
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6C7F77]">
                    {lang === 'en' ? 'No team members in this filter.' : 'এই তালিকায় কোনো সদস্য নেই।'}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-[#FAFDFB] h-11">
                    <td className="py-2.5 px-3.5 font-semibold text-[#13221C]">
                      {u.displayName}
                      {u.uid === currentUid && (
                        <span className="ml-1.5 text-[11px] font-normal text-[#0A7250]">
                          ({lang === 'en' ? 'You' : 'আপনি'})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono-num text-[#4E6159]">{u.email || '—'}</td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`font-semibold ${
                          u.role === 'pending'
                            ? 'text-[#B45309]'
                            : u.role === 'admin'
                              ? 'text-[#0A7250]'
                              : 'text-[#13221C]'
                        }`}
                      >
                        {ROLE_LABELS[u.role][lang]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-[#33463E]">
                      {u.role === 'pending'
                        ? '—'
                        : u.territoryId
                          ? terName(u.territoryId)
                          : lang === 'en'
                            ? 'All territories'
                            : 'সব টেরিটরি'}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#33463E]">
                      {u.distributorId ? dbName(u.distributorId) : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#33463E]">
                      {u.srId ? srName(u.srId) : '—'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className={u.active ? 'text-[#0A7250] font-semibold' : 'text-[#6C7F77]'}>
                        {u.active ? t(lang, 'active') : t(lang, 'inactive')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="font-semibold text-[#0A7250] hover:underline"
                      >
                        {t(lang, 'edit')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E8E5] rounded-2xl max-w-md w-full p-5 space-y-4 animate-panel-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#13221C]">{editingUser.displayName}</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-xs font-semibold text-[#4E6159]"
              >
                {t(lang, 'close')}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-[#4E6159]">
                  {lang === 'en' ? 'Role' : 'রোল'}
                </span>
                <select
                  value={roleVal}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole;
                    setRoleVal(nextRole);
                    if (nextRole === 'admin') {
                      setTerId('');
                    } else if (!terId && activeTerritories[0]) {
                      const firstTer = activeTerritories[0].id;
                      setTerId(firstTer);
                      const firstDist = distributors.find(
                        (d) => d.active !== false && (d.territoryId || 'laxmipur') === firstTer
                      );
                      setDistId(firstDist?.id || '');
                      setSrId('');
                    }
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                >
                  <option value="admin">{ROLE_LABELS.admin[lang]}</option>
                  <option value="tso">{ROLE_LABELS.tso[lang]}</option>
                  <option value="dealer">{ROLE_LABELS.dealer[lang]}</option>
                  <option value="sr">{ROLE_LABELS.sr[lang]}</option>
                  <option value="pending">{ROLE_LABELS.pending[lang]}</option>
                </select>
              </label>

              {(roleVal === 'tso' ||
                roleVal === 'dealer' ||
                roleVal === 'sr' ||
                roleVal === 'admin') && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[#4E6159]">
                    {t(lang, 'territoryLabel')}
                  </span>
                  <select
                    value={terId}
                    onChange={(e) => {
                      const nextTer = e.target.value;
                      setTerId(nextTer);
                      const nextDist = distributors.find(
                        (d) => d.active !== false && (d.territoryId || 'laxmipur') === nextTer
                      );
                      setDistId(nextDist?.id || '');
                      setSrId('');
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                  >
                    {roleVal === 'admin' && (
                      <option value="">
                        {lang === 'en' ? 'All territories' : 'সব টেরিটরি'}
                      </option>
                    )}
                    {activeTerritories.map((ter) => (
                      <option key={ter.id} value={ter.id}>
                        {ter.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {(roleVal === 'dealer' || roleVal === 'sr') && (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-[#4E6159]">
                      {t(lang, 'distributor')}
                    </span>
                    <select
                      value={distId}
                      onChange={(e) => {
                        setDistId(e.target.value);
                        setSrId('');
                      }}
                      className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                    >
                      {distsForTer.length === 0 ? (
                        <option value="">
                          {lang === 'en'
                            ? 'No distributors in this territory'
                            : 'এই টেরিটরিতে ডিস্ট্রিবিউটর নেই'}
                        </option>
                      ) : (
                        distsForTer.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  {roleVal === 'sr' && (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-[#4E6159]">
                        {lang === 'en' ? 'Assigned SR Profile (optional)' : 'নির্ধারিত এসআর প্রোফাইল'}
                      </span>
                      <select
                        value={srId}
                        onChange={(e) => setSrId(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#DCE4DF] rounded-lg"
                      >
                        <option value="">
                          {lang === 'en'
                            ? 'Any SR in this distributor'
                            : 'এই ডিস্ট্রিবিউটরের যেকোনো এসআর'}
                        </option>
                        {srsForDist.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}

              <label className="flex items-center gap-2.5 pt-1 text-sm text-[#13221C]">
                <input
                  type="checkbox"
                  checked={activeVal}
                  onChange={(e) => setActiveVal(e.target.checked)}
                  className="w-4 h-4 accent-[#0A7250]"
                />
                <span>{lang === 'en' ? 'Account Active' : 'অ্যাকাউন্ট সক্রিয়'}</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              {(roleVal === 'sr' || roleVal === 'dealer') && !distId ? (
                <p className="text-[11px] text-[#B45309]">
                  {lang === 'en'
                    ? 'Add a distributor in this territory first.'
                    : 'আগে এই টেরিটরিতে একটি ডিস্ট্রিবিউটর যোগ করুন।'}
                </p>
              ) : (
                <span />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="button"
                  disabled={saving || ((roleVal === 'sr' || roleVal === 'dealer') && !distId)}
                  onClick={handleSave}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#0A7250] disabled:opacity-50 rounded-lg"
                >
                  {saving ? t(lang, 'saving') : t(lang, 'syncAccess')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
