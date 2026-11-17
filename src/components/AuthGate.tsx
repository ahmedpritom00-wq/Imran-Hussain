import { BarChart3, CheckCircle2, LogOut, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { ROLE_LABELS, t } from '../data/i18n';
import type { Lang, UserProfile } from '../types';

interface SignInScreenProps {
  lang: Lang;
  onToggleLang: () => void;
  onSignIn: () => void;
  loading: boolean;
  error: string | null;
}

export function SignInScreen({
  lang,
  onToggleLang,
  onSignIn,
  loading,
  error,
}: SignInScreenProps) {
  const highlights = [
    {
      icon: Smartphone,
      title: lang === 'en' ? 'Field-Ready Mobile & Desktop Sync' : 'মোবাইল ও কম্পিউটারে লাইভ সিঙ্ক',
      desc:
        lang === 'en'
          ? 'Submit daily Secondary Sales and Primary Stock from any phone with instant cloud backup.'
          : 'যেকোনো ফোন থেকে সেকেন্ডারি বিক্রি ও প্রাইমারি স্টক সরাসরি ক্লাউডে সংরক্ষণ করুন।',
    },
    {
      icon: BarChart3,
      title: lang === 'en' ? 'Automated Stock Ledger & Master Sheet' : 'স্বয়ংক্রিয় স্টক লেজার ও মাস্টার শিট',
      desc:
        lang === 'en'
          ? 'Real-time closing stock calculation across every territory and distributor.'
          : 'প্রতিটি টেরিটরি ও পরিবেশকের ওপেনিং, প্রাইমারি, বিক্রি ও ক্লোজিং স্টকের নিখুঁত হিসাব।',
    },
    {
      icon: ShieldCheck,
      title:
        lang === 'en'
          ? 'Role-Scoped Access for Every Team Member'
          : 'সবার জন্য নির্ধারিত রোল ও নিরাপত্তা',
      desc:
        lang === 'en'
          ? 'Dedicated permissions for Admin, TSO, Dealers, and Sales Representatives.'
          : 'অ্যাডমিন, টিএসও, ডিলার এবং এসআর—প্রত্যেকের জন্য আলাদা অ্যাক্সেস ও রিপোর্ট ব্যবস্থা।',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7F6] flex flex-col justify-between">
      {/* Clean 3-zone header contract */}
      <header className="w-full border-b border-[#E3E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#0A7250] text-white flex items-center justify-center font-display font-bold text-sm">
              TS
            </div>
            <span className="font-display font-bold text-base tracking-tight text-[#13221C]">
              {t(lang, 'brand')}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleLang}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#33463E] bg-[#F5F7F6] border border-[#DCE4DF] rounded-lg hover:bg-[#EAEFEA] transition-colors whitespace-nowrap shrink-0"
          >
            {lang === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>
      </header>

      {/* Balanced 2-column desktop split */}
      <main className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-10 lg:py-16 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#0A7250] tracking-tight">
                {t(lang, 'territory')}
              </p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#13221C] tracking-tight leading-tight text-balance">
                {lang === 'en'
                  ? 'Territory sales, stock ledger, and team reporting in one workspace.'
                  : 'সকল টেরিটরির বিক্রি, স্টক লেজার এবং টিম রিপোর্টিং এক জায়গায়।'}
              </h1>
              <p className="text-sm sm:text-base text-[#4E6159] leading-relaxed max-w-xl">
                {t(lang, 'signInSub')}
              </p>
            </div>

            <div className="divide-y divide-[#E3E8E5] border-y border-[#E3E8E5]">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="py-4 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-[#EDF6F1] text-[#0A7250] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h2 className="text-sm font-bold text-[#13221C]">{item.title}</h2>
                      <p className="text-xs sm:text-sm text-[#4E6159] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E3E8E5] rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-[#13221C] tracking-tight">
                  {t(lang, 'signInTitle')}
                </h2>
                <p className="text-xs sm:text-sm text-[#4E6159]">
                  {lang === 'en'
                    ? 'Use your Google account to access your assigned territory workspace.'
                    : 'আপনার অনুমোদিত টেরিটরিতে প্রবেশ করতে গুগল অ্যাকাউন্ট দিয়ে লগইন করুন।'}
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                disabled={loading}
                className="w-full min-h-[48px] py-3 px-4 bg-[#0A7250] hover:bg-[#07573D] active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>{loading ? t(lang, 'saving') : t(lang, 'signInGoogle')}</span>
              </button>

              <div className="pt-4 border-t border-[#EDF2EF] flex items-center gap-2 text-xs text-[#6C7F77]">
                <CheckCircle2 className="w-4 h-4 text-[#0A7250] shrink-0" />
                <span>
                  {lang === 'en'
                    ? 'New accounts require Admin role approval before posting.'
                    : 'নতুন অ্যাকাউন্টের জন্য অ্যাডমিনের অনুমোদন প্রয়োজন।'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-5 px-6 text-center text-xs text-[#6C7F77] border-t border-[#E3E8E5] bg-white">
        {t(lang, 'territory')}
      </footer>
    </div>
  );
}

interface PendingApprovalScreenProps {
  lang: Lang;
  profile: UserProfile;
  onToggleLang: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
  refreshing: boolean;
}

export function PendingApprovalScreen({
  lang,
  profile,
  onToggleLang,
  onRefresh,
  onSignOut,
  refreshing,
}: PendingApprovalScreenProps) {
  return (
    <div className="min-h-screen bg-[#F5F7F6] flex flex-col justify-between">
      <header className="w-full border-b border-[#E3E8E5] bg-white">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0A7250] text-white flex items-center justify-center font-display font-bold text-sm">
              TS
            </div>
            <span className="font-display font-bold text-base text-[#13221C]">
              {t(lang, 'brand')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLang}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#33463E] bg-[#F5F7F6] border border-[#DCE4DF] rounded-lg hover:bg-[#EAEFEA] transition-colors"
            >
              {lang === 'en' ? 'বাংলা' : 'English'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#33463E] bg-white border border-[#DCE4DF] rounded-lg hover:bg-[#F5F7F6] transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t(lang, 'signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg w-full mx-auto px-5 py-10 my-auto">
        <div className="bg-white border border-[#E3E8E5] rounded-2xl p-6 sm:p-8 space-y-6 animate-panel-in">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#B45309]">
              {ROLE_LABELS[profile.role][lang]}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#13221C] tracking-tight text-balance">
              {t(lang, 'pendingTitle')}
            </h1>
            <p className="text-sm text-[#4E6159] leading-relaxed">{t(lang, 'pendingDesc')}</p>
          </div>

          <div className="divide-y divide-[#EDF2EF] border-y border-[#EDF2EF] text-xs">
            <div className="py-3 flex justify-between gap-4">
              <span className="text-[#5A6D65]">{lang === 'en' ? 'Name' : 'নাম'}</span>
              <span className="font-semibold text-[#13221C] truncate">{profile.displayName}</span>
            </div>
            {profile.email && (
              <div className="py-3 flex justify-between gap-4">
                <span className="text-[#5A6D65]">{lang === 'en' ? 'Email' : 'ইমেইল'}</span>
                <span className="font-mono-num text-[#13221C] truncate">{profile.email}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="w-full min-h-[48px] py-3 px-4 bg-[#0A7250] hover:bg-[#07573D] disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t(lang, 'refreshStatus')}</span>
          </button>
        </div>
      </main>

      <footer className="py-5 px-6 text-center text-xs text-[#6C7F77] border-t border-[#E3E8E5] bg-white">
        {t(lang, 'territory')}
      </footer>
    </div>
  );
}
