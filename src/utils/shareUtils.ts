import { formatMoney, formatQty } from '../data/initialSeed';
import type { Distributor, Lang, SalesRep, Transaction, TransactionItem } from '../types';

export function getShareableAppUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://ais-pre-vhxofivmstvuoiwwfft3cw-906241386686.asia-southeast1.run.app';
  }
  const { origin, hostname } = window.location;
  if (hostname.startsWith('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }
  return origin;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when iframe blocks Clipboard API
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function formatTransactionMemo(params: {
  lang: Lang;
  tx: Transaction;
  items: TransactionItem[];
  territoryName: string;
  distributorName: string;
  srName?: string;
}): string {
  const { lang, tx, items, territoryName, distributorName, srName } = params;
  const lines: string[] = [];
  if (lang === 'bn') {
    lines.push(`*টিম সেলস প্রো · ${tx.kind === 'Primary Stock' ? 'প্রাইমারি স্টক' : 'সেকেন্ডারি বিক্রি'}*`);
    lines.push(`তারিখ: ${tx.date}`);
    lines.push(`টেরিটরি: ${territoryName}`);
    lines.push(`পরিবেশক: ${distributorName}`);
    if (srName && tx.kind === 'Secondary Sales') lines.push(`এসআর: ${srName}`);
    lines.push('-------------------------');
    items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}. ${it.product} — ${formatQty(it.qty)} x ${formatMoney(it.price)} = ${formatMoney(it.qty * it.price)}`
      );
    });
    lines.push('-------------------------');
    lines.push(`মোট পরিমাণ: ${formatQty(tx.totalQty)} ইউনিট`);
    lines.push(`মোট মূল্য: ${formatMoney(tx.totalAmount)}`);
  } else {
    lines.push(`*Team Sales Pro · ${tx.kind}*`);
    lines.push(`Date: ${tx.date}`);
    lines.push(`Territory: ${territoryName}`);
    lines.push(`Distributor: ${distributorName}`);
    if (srName && tx.kind === 'Secondary Sales') lines.push(`SR: ${srName}`);
    lines.push('-------------------------');
    items.forEach((it, idx) => {
      lines.push(
        `${idx + 1}. ${it.product} — ${formatQty(it.qty)} x ${formatMoney(it.price)} = ${formatMoney(it.qty * it.price)}`
      );
    });
    lines.push('-------------------------');
    lines.push(`Total Qty: ${formatQty(tx.totalQty)} units`);
    lines.push(`Total Value: ${formatMoney(tx.totalAmount)}`);
  }
  return lines.join('\n');
}

export function formatExecutiveBrief(params: {
  lang: Lang;
  month: string;
  scopeLabel: string;
  primaryValue: number;
  secondaryValue: number;
  primaryCount: number;
  secondaryCount: number;
  distributors: Distributor[];
  srs: SalesRep[];
  transactions: Transaction[];
}): string {
  const {
    lang,
    month,
    scopeLabel,
    primaryValue,
    secondaryValue,
    primaryCount,
    secondaryCount,
    distributors,
    srs,
    transactions,
  } = params;

  const secByDist = new Map<string, number>();
  const secBySr = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind === 'Secondary Sales') {
      secByDist.set(tx.distributorId, (secByDist.get(tx.distributorId) || 0) + tx.totalAmount);
      if (tx.srId) {
        secBySr.set(tx.srId, (secBySr.get(tx.srId) || 0) + tx.totalAmount);
      }
    }
  }

  const topDists = Array.from(secByDist.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, val]) => `${distributors.find((d) => d.id === id)?.name || id}: ${formatMoney(val)}`);

  const topSrs = Array.from(secBySr.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, val]) => `${srs.find((s) => s.id === id)?.name || id}: ${formatMoney(val)}`);

  if (lang === 'bn') {
    return [
      `*টিম সেলস প্রো · মাসিক রিপোর্ট (${month})*`,
      `এলাকা: ${scopeLabel}`,
      `-------------------------`,
      `সেকেন্ডারি বিক্রি: ${formatMoney(secondaryValue)} (${secondaryCount} টি এন্ট্রি)`,
      `প্রাইমারি স্টক: ${formatMoney(primaryValue)} (${primaryCount} টি এন্ট্রি)`,
      `স্টক পার্থক্য: ${formatMoney(primaryValue - secondaryValue)}`,
      topDists.length ? `\nশীর্ষ পরিবেশক:\n• ${topDists.join('\n• ')}` : '',
      topSrs.length ? `\nশীর্ষ এসআর:\n• ${topSrs.join('\n• ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `*Team Sales Pro · Executive Brief (${month})*`,
    `Scope: ${scopeLabel}`,
    `-------------------------`,
    `Secondary Sales: ${formatMoney(secondaryValue)} (${secondaryCount} entries)`,
    `Primary Lifting: ${formatMoney(primaryValue)} (${primaryCount} entries)`,
    `Net Stock Delta: ${formatMoney(primaryValue - secondaryValue)}`,
    topDists.length ? `\nTop Distributors:\n• ${topDists.join('\n• ')}` : '',
    topSrs.length ? `\nTop SRs:\n• ${topSrs.join('\n• ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
