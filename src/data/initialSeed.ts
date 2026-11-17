export const BOOTSTRAP_ADMIN_EMAIL = 'imran972913@gmail.com';
export const TERRITORY_ID = 'laxmipur';

export interface SeedProduct {
  id: string;
  name: string;
  group: string;
  price: number;
  active: boolean;
}

export interface SeedDistributor {
  id: string;
  name: string;
  active: boolean;
}

export interface SeedSr {
  id: string;
  name: string;
  distributorId: string;
  active: boolean;
}

export const INITIAL_PRODUCTS: SeedProduct[] = [
  { id: 'p2', name: 'Raja Super', group: 'Condom', price: 3.85, active: true },
  { id: 'p3', name: "Hero 3's", group: 'Condom', price: 5.1389, active: true },
  { id: 'p4', name: 'Panther Dotted', group: 'Condom', price: 5.45, active: true },
  { id: 'p5', name: 'Panther Banana', group: 'Condom', price: 5.45, active: true },
  { id: 'p6', name: 'Sensation Classic', group: 'Condom', price: 9.0833, active: true },
  { id: 'p7', name: 'Sensation SD', group: 'Condom', price: 9.0833, active: true },
  { id: 'p8', name: 'Sensation Coffee', group: 'Condom', price: 9.0833, active: true },
  { id: 'p9', name: 'U&Me Long Love', group: 'Condom', price: 15.8333, active: true },
  { id: 'p10', name: 'U&Me Anatomic', group: 'Condom', price: 15.8333, active: true },
  { id: 'p11', name: 'Xtreme 3 in 1', group: 'Condom', price: 19.7167, active: true },
  { id: 'p12', name: 'Xtreme Ultra Thin', group: 'Condom', price: 19.7167, active: true },
  { id: 'p13', name: "Amore Gold 3's", group: 'Condom', price: 20.5867, active: true },
  { id: 'p14', name: "Amore Black 3's", group: 'Condom', price: 20.5867, active: true },
  { id: 'p17', name: 'ORSaline - N NP', group: 'ORS', price: 4.88, active: true },
  { id: 'p18', name: 'ORSaline - N NP(25 Pcs) (New)', group: 'ORS', price: 4.88, active: true },
  { id: 'p21', name: "JOYA 8's (Belt)", group: 'Joya', price: 46.5, active: true },
  { id: 'p22', name: "JOYA 5's (Belt)", group: 'Joya', price: 28.83, active: true },
  { id: 'p23', name: "JOYA 15's (Belt)", group: 'Joya', price: 83.0, active: true },
  { id: 'p24', name: "JOYA Wings 8's", group: 'Joya', price: 64.0, active: true },
  { id: 'p25', name: "JOYA Wings 5's", group: 'Joya', price: 29.5, active: true },
  { id: 'p26', name: "Joya Ultra Comfort 8's", group: 'Joya', price: 72.54, active: true },
  { id: 'p27', name: "Joya Heavy Flow 8's", group: 'Joya', price: 81.84, active: true },
  { id: 'p28', name: "Joya All Night 8's", group: 'Joya', price: 91.14, active: true },
  { id: 'p29', name: "Joya 15's (Wings)", group: 'Joya', price: 112.0, active: true },
  { id: 'p32', name: "Smile (S 5's Mini)", group: 'Smile', price: 77.5, active: true },
  { id: 'p33', name: "Smile (M 5's Mini)", group: 'Smile', price: 77.5, active: true },
  { id: 'p34', name: "Smile (L 4's Mini)", group: 'Smile', price: 77.5, active: true },
  { id: 'p35', name: "Smile (XL 4's Mini)", group: 'Smile', price: 77.5, active: true },
  { id: 'p36', name: "Smile (S 28's Standard)", group: 'Smile', price: 377.0, active: true },
  { id: 'p37', name: "Smile (M 26's Standard)", group: 'Smile', price: 377.0, active: true },
  { id: 'p38', name: "Smile (L 24's Standard)", group: 'Smile', price: 377.0, active: true },
  { id: 'p39', name: "Smile (XL 22's Standard)", group: 'Smile', price: 377.0, active: true },
  { id: 'p40', name: "Smile (XXL 20's Standard)", group: 'Smile', price: 377.0, active: true },
  { id: 'p41', name: "Smile Pants (S 5's Mini)", group: 'Smile', price: 89.3, active: true },
  { id: 'p42', name: "Smile Pants (M 5's Mini)", group: 'Smile', price: 89.3, active: true },
  { id: 'p43', name: "Smile Pants (L 5's Mini)", group: 'Smile', price: 89.3, active: true },
  { id: 'p44', name: "Smile Pants (XL 4's Mini)", group: 'Smile', price: 89.3, active: true },
  { id: 'p45', name: "Smile Pants (XXL 4's Mini)", group: 'Smile', price: 89.3, active: true },
  { id: 'p46', name: "Smile Pants (S 42's Standard)", group: 'Smile', price: 567.5, active: true },
  { id: 'p47', name: "Smile Pants (M 40's  Standard)", group: 'Smile', price: 567.5, active: true },
  { id: 'p48', name: "Smile Pants (L 34's  Standard)", group: 'Smile', price: 567.5, active: true },
  { id: 'p49', name: "Smile Pants (XL 32's  Standard)", group: 'Smile', price: 567.5, active: true },
  { id: 'p50', name: "Smile Pants (XXL 24's  Standard)", group: 'Smile', price: 567.5, active: true },
  { id: 'p53', name: "Smile Baby Wipes (80's)", group: 'Smile Baby Wipes', price: 130.2, active: true },
  { id: 'p54', name: "Smile Baby Wipes (2's)", group: 'Smile Baby Wipes', price: 3.6084, active: true },
  { id: 'p57', name: 'Taste Me (Orange 25gm)', group: 'Taste Me', price: 8.79, active: true },
  { id: 'p58', name: 'Taste Me (Mango 25 gm)', group: 'Taste Me', price: 8.79, active: true },
  { id: 'p59', name: 'Taste Me (Orange 200gm) New Price', group: 'Taste Me', price: 89.3, active: true },
  { id: 'p60', name: 'Taste Me (Mango 200gm) New Price', group: 'Taste Me', price: 89.3, active: true },
  { id: 'p61', name: 'Taste Me (Orange 1000gm)', group: 'Taste Me', price: 439.07, active: true },
  { id: 'p62', name: 'Taste Me (Mango 1000gm)', group: 'Taste Me', price: 439.07, active: true },
  { id: 'p65', name: 'Bolt  (25 gm)', group: 'Bolt', price: 7.71, active: true },
  { id: 'p66', name: 'Bolt (200 gm)', group: 'Bolt', price: 67.29, active: true },
  { id: 'p67', name: 'Bolt (400 gm)', group: 'Bolt', price: 116.82, active: true },
  { id: 'p70', name: 'SMC Plus Orange 200ml', group: 'SMC Plus', price: 28.3, active: true },
  { id: 'p71', name: 'SMC Plus Lemon 200ml', group: 'SMC Plus', price: 28.3, active: true },
  { id: 'p72', name: 'SMC Plus Orange 250ml', group: 'SMC Plus', price: 35.85, active: true },
  { id: 'p73', name: 'SMC Plus (Lemon) 250ml', group: 'SMC Plus', price: 35.85, active: true },
  { id: 'p74', name: 'SMC Plus 200 ml (Apple)', group: 'SMC Plus', price: 30.84, active: true },
  { id: 'p77', name: 'SMC Fruity', group: 'Super Kid', price: 5.1, active: true },
  { id: 'p79', name: 'Super Kid (Dudh Malai)', group: 'Super Kid', price: 7.86, active: true },
  { id: 'p80', name: 'Super Kid (Chocolate)', group: 'Super Kid', price: 7.86, active: true },
  { id: 'p81', name: 'Super Kid Chocolate Bar', group: 'Super Kid', price: 190.08, active: true },
  { id: 'p84', name: 'SMC Butter Cookies 200gm', group: 'Biscuit', price: 51.45, active: true },
  { id: 'p85', name: 'SMC Orange Biscuit 160gm', group: 'Biscuit', price: 40.85, active: true },
  { id: 'p86', name: 'SMC Lexus Vegetable Crackers 216gm', group: 'Biscuit', price: 64.25, active: true },
  { id: 'p87', name: 'SMC Orange Biscuit 36gm', group: 'Biscuit', price: 8.17, active: true },
  { id: 'p90', name: 'Noret-28', group: 'Pill', price: 19.29, active: true },
  { id: 'p91', name: 'Femicon', group: 'Pill', price: 37.21, active: true },
  { id: 'p92', name: 'Femipil', group: 'Pill', price: 19.71, active: true },
  { id: 'p93', name: 'Minicon', group: 'Pill', price: 42.38, active: true },
  { id: 'p94', name: 'Norix-1', group: 'Pill', price: 52.86, active: true },
];

export const INITIAL_DISTRIBUTORS: SeedDistributor[] = [
  { id: 'd1', name: 'Arafat Traders', active: true },
  { id: 'd2', name: 'Ovi Traders', active: true },
  { id: 'd3', name: 'Mamun Traders', active: true },
  { id: 'd4', name: 'Hoque Traders', active: true },
  { id: 'd5', name: 'SR Brothers', active: true },
];

export const INITIAL_SRS: SeedSr[] = [
  { id: 's1', name: 'Mahabubur Rahman', distributorId: 'd1', active: true },
  { id: 's2', name: 'Sakib Ahmed', distributorId: 'd1', active: true },
  { id: 's3', name: 'Anwar Hossain', distributorId: 'd2', active: true },
  { id: 's4', name: 'MD Sakil', distributorId: 'd2', active: true },
  { id: 's5', name: 'Umor Faruk', distributorId: 'd3', active: true },
  { id: 's6', name: 'Afzal Hossain', distributorId: 'd3', active: true },
  { id: 's7', name: 'Fahim Ahmed', distributorId: 'd4', active: true },
  { id: 's8', name: 'SR 2', distributorId: 'd4', active: true },
  { id: 's9', name: 'Ibrahim Kolil', distributorId: 'd5', active: true },
  { id: 's10', name: 'Mamunor Rosid', distributorId: 'd5', active: true },
];

export function formatMoney(n: number | undefined | null): string {
  const val = Number(n || 0);
  return `৳ ${val.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatQty(n: number | undefined | null): string {
  const val = Number(n || 0);
  return val.toLocaleString('en-BD', { maximumFractionDigits: 2 });
}

export function currentMonthISO(): string {
  return new Date().toISOString().slice(0, 7);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
