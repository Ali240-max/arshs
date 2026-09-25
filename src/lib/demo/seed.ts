/**
 * DEMO DATA ONLY.
 * Everything in this file is used when Supabase is not configured.
 * The same data is exported to supabase/seed.sql by `npm run seed:sql`.
 *
 * Two events are rebuilt from the society's real Excel sheets:
 *   - Autumn Food Fair 2025  <- Funds_Sheet.xlsx (vendors PKR 16,000 + student stalls PKR 6,710 = PKR 22,710)
 *   - Winter Food Fair 2026  <- Funds.xlsx       (vendors PKR 33,000 + student stalls PKR 12,000 = PKR 45,000)
 * Event names and dates for those two are assumptions (the sheets have neither).
 * All other events, donors, recipients and expenses are invented.
 */
import type {
  AuditLog,
  Category,
  Distribution,
  Donation,
  EventMember,
  EventVendor,
  PaymentMethod,
  Profile,
  RecipientType,
  Snapshot,
  SocietyEvent,
  Transaction,
  TxnKind,
  Vendor,
  VendorPayment,
} from "../types";
import { KIND_META } from "../constants";
import { pad } from "../utils";

// ---------- deterministic helpers ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260924);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number, step = 100) =>
  Math.round((min + rand() * (max - min)) / step) * step;

/** Stable UUID-shaped ids so the SQL seed and the demo share the same keys. */
const makeId = (type: number, n: number) =>
  `${pad(type, 8)}-0000-4000-8000-${pad(n, 12)}`;
const counters: Record<number, number> = {};
const nextId = (type: number) => makeId(type, (counters[type] = (counters[type] ?? 0) + 1));

const T = { profile: 1, category: 2, event: 3, vendor: 4, booking: 5, txn: 6, donation: 7, distribution: 8, vpay: 9, audit: 10 };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const stamp = (date: string, hour = 11, min = 0) => `${date}T${pad(hour)}:${pad(min)}:00+05:00`;

// ---------- people ----------
export const DEMO_PASSWORD = "demo1234";

const profiles: Profile[] = [
  { id: makeId(T.profile, 1), fullName: "Ali Farooqi", email: "finance@arshs.demo", role: "finance_secretary", phone: "0300-5550101", joinedAt: "2025-07-20" },
  { id: makeId(T.profile, 2), fullName: "Ayesha Malik", email: "president@arshs.demo", role: "president", phone: "0300-5550102", joinedAt: "2025-07-20" },
  { id: makeId(T.profile, 3), fullName: "Hamza Tariq", email: "member@arshs.demo", role: "member", joinedAt: "2025-08-10" },
  { id: makeId(T.profile, 4), fullName: "Fatima Noor", email: "fatima@arshs.demo", role: "member", joinedAt: "2025-08-10" },
  { id: makeId(T.profile, 5), fullName: "Usman Qureshi", email: "usman@arshs.demo", role: "member", joinedAt: "2025-09-02" },
  { id: makeId(T.profile, 6), fullName: "Zainab Iqbal", email: "zainab@arshs.demo", role: "member", joinedAt: "2026-02-01" },
];
const ALI = profiles[0].id;
const AYESHA = profiles[1].id;

// ---------- categories ----------
const categories: Category[] = [];
function cat(kind: TxnKind, name: string, color: string) {
  const c = { id: nextId(T.category), kind, name, color };
  categories.push(c);
  return c.id;
}
const C = {
  stallFee: cat("vendor_payment", "Stall fee", "#0E6B57"),
  donGeneral: cat("donation", "General donation", "#E9A21B"),
  donZakat: cat("donation", "Zakat", "#C9861A"),
  donSadaqah: cat("donation", "Sadaqah", "#F2C14E"),
  donAppeal: cat("donation", "Appeal donation", "#D4A017"),
  incStalls: cat("income", "Student stalls", "#34B38A"),
  incDirect: cat("income", "Direct contributions", "#5EA8D6"),
  incSponsor: cat("income", "Sponsorship", "#3F7FBF"),
  incOther: cat("income", "Other income", "#A3B1AD"),
  exVenue: cat("expense", "Venue & tents", "#E2583E"),
  exSound: cat("expense", "Sound & lighting", "#F08A5D"),
  exPrint: cat("expense", "Printing & banners", "#F4A259"),
  exTransport: cat("expense", "Transportation", "#C44536"),
  exFood: cat("expense", "Food & refreshments", "#E76F51"),
  exPack: cat("expense", "Packaging", "#D98E73"),
  exWater: cat("expense", "Water & drinks", "#F2B880"),
  exDecor: cat("expense", "Decorations", "#B5654A"),
  exStationery: cat("expense", "Stationery", "#8C5A4A"),
  exMisc: cat("expense", "Miscellaneous", "#B9A29B"),
  aidMedical: cat("distribution", "Medical", "#7A5AF8"),
  aidFood: cat("distribution", "Food", "#9B8AFB"),
  aidEducation: cat("distribution", "Education", "#5B3FD9"),
  aidEmergency: cat("distribution", "Emergency", "#B692F6"),
  aidUtility: cat("distribution", "Utility bills", "#6E6AB8"),
  aidFinancial: cat("distribution", "Financial assistance", "#8E7CC3"),
  aidRamzan: cat("distribution", "Ramzan assistance", "#4A2FB8"),
  aidWinter: cat("distribution", "Winter relief", "#A99CF2"),
  aidOther: cat("distribution", "Other", "#C4B8F5"),
};

// ---------- events ----------
const events: SocietyEvent[] = [];
function event(e: Omit<SocietyEvent, "id" | "code" | "createdBy" | "createdAt">) {
  const n = events.length + 1;
  const ev: SocietyEvent = {
    ...e,
    id: makeId(T.event, n),
    code: `EVT-${e.startDate.slice(0, 4)}-${pad(n)}`,
    createdBy: ALI,
    createdAt: stamp(addDays(e.startDate, -21), 10, 5),
  };
  events.push(ev);
  return ev;
}

const E = {
  flood: event({ name: "Flood Relief Appeal 2025", type: "collection", status: "completed", startDate: "2025-08-28", endDate: "2025-09-20", days: 1, location: "Campus-wide and online", description: "Emergency appeal for families affected by the late-August floods.", targetAmount: 120000 }),
  autumnFair: event({ name: "Autumn Food Fair 2025", type: "fundraiser", status: "completed", startDate: "2025-09-26", endDate: "2025-09-27", days: 2, location: "University main ground", description: "Two-day food stall fair. Rebuilt from Funds_Sheet.xlsx.", targetAmount: 25000, expectedVendors: 6, defaultDayFee: 3000 }),
  winterDrive: event({ name: "Winter Relief Drive 2025", type: "expenditure", status: "completed", startDate: "2025-12-18", endDate: "2025-12-20", days: 3, location: "Outskirts, home visits", description: "Blankets and warm clothes for families identified by volunteers.", budget: 60000 }),
  winterFair: event({ name: "Winter Food Fair 2026", type: "fundraiser", status: "completed", startDate: "2026-02-13", endDate: "2026-02-14", days: 2, location: "University main ground", description: "Two-day food stall fair. Rebuilt from Funds.xlsx.", targetAmount: 45000, expectedVendors: 8, defaultDayFee: 2500 }),
  ramzanAppeal: event({ name: "Ramzan Appeal 2026", type: "collection", status: "completed", startDate: "2026-02-10", endDate: "2026-03-15", days: 1, location: "Campus-wide and online", description: "Zakat and sadaqah collection for the ration drive.", targetAmount: 150000 }),
  iftarDrive: event({ name: "Ramzan Iftar & Ration Drive 2026", type: "expenditure", status: "completed", startDate: "2026-02-19", endDate: "2026-03-19", days: 1, location: "Society office and home deliveries", description: "Monthly ration bags and daily iftar for deserving families.", budget: 100000 }),
  sportsGala: event({ name: "Sports Gala Stalls 2026", type: "fundraiser", status: "completed", startDate: "2026-04-16", endDate: "2026-04-17", days: 2, location: "Sports complex", description: "Food and game stalls during the annual sports gala.", targetAmount: 50000, expectedVendors: 8, defaultDayFee: 3000 }),
  medicalCamp: event({ name: "Free Medical Camp 2026", type: "expenditure", status: "completed", startDate: "2026-05-09", endDate: "2026-05-09", days: 1, location: "Community hall", description: "Free check-ups and medicines, run with pharmacy faculty volunteers.", budget: 40000 }),
  welcomeDrive: event({ name: "Welcome Back Collection Drive", type: "collection", status: "active", startDate: "2026-09-01", endDate: "2026-09-30", days: 1, location: "Campus-wide", description: "Start-of-semester appeal for the education support fund.", targetAmount: 50000 }),
  mela: event({ name: "University Charity Mela 2026", type: "fundraiser", status: "active", startDate: "2026-10-15", endDate: "2026-10-16", days: 2, location: "University main ground", description: "The society's biggest fundraiser. Stall bookings are open.", targetAmount: 150000, expectedVendors: 25, defaultDayFee: 4000 }),
  winter2026: event({ name: "Winter Relief Drive 2026", type: "expenditure", status: "planned", startDate: "2026-12-15", endDate: "2026-12-19", days: 5, location: "To be decided", description: "Planning stage. Budget approved in principle.", budget: 80000 }),
};

const eventMembers: EventMember[] = [
  { eventId: E.mela.id, profileId: profiles[2].id, duty: "Stall coordinator" },
  { eventId: E.welcomeDrive.id, profileId: profiles[2].id, duty: "Collection desk" },
  { eventId: E.sportsGala.id, profileId: profiles[2].id, duty: "Volunteer" },
  { eventId: E.mela.id, profileId: profiles[3].id, duty: "Decor lead" },
  { eventId: E.iftarDrive.id, profileId: profiles[3].id, duty: "Ration packing" },
  { eventId: E.medicalCamp.id, profileId: profiles[4].id, duty: "Registration desk" },
  { eventId: E.mela.id, profileId: profiles[5].id, duty: "Volunteer" },
];

// ---------- vendors ----------
const vendors: Vendor[] = [];
function vendor(businessName: string, stallType: string, ownerName?: string, notes?: string) {
  const n = vendors.length + 1;
  const v: Vendor = {
    id: makeId(T.vendor, n),
    code: `VND-${pad(n, 3)}`,
    businessName,
    ownerName,
    phone: ownerName ? `03${pick(["00", "01", "11", "21", "33", "45"])}-555${pad(between(0, 9999, 1), 4)}` : undefined,
    stallType,
    notes,
    createdAt: stamp("2025-09-01", 9),
  };
  vendors.push(v);
  return v;
}
const xl1 = "Imported from Funds_Sheet.xlsx. Owner and phone not recorded.";
const xl2 = "Imported from Funds.xlsx. Owner and phone not recorded.";
const V = {
  donuts: vendor("Donuts", "Dessert", undefined, xl1),
  tikka: vendor("Tikka Kebab", "Food", undefined, xl1),
  fries: vendor("Fries", "Food", undefined, "Appears in both Excel sheets."),
  chat: vendor("Chat", "Food", undefined, xl1),
  juice: vendor("Fresh Juice", "Drinks", undefined, xl2),
  bbq: vendor("BBQ", "Food", undefined, xl2),
  momos: vendor("Momos", "Food", undefined, xl2),
  samosa: vendor("Samosa", "Food", undefined, xl2),
  sitara: vendor("Sitara Bakery", "Dessert", undefined, xl2),
  biryani: vendor("Karachi Biryani House", "Food", "Imran Sheikh"),
  chai: vendor("Chai Khana", "Drinks", "Bilal Ahmed"),
  golgappay: vendor("Gol Gappay Corner", "Food", "Rashid Mehmood"),
  kulfi: vendor("Kulfi Wala", "Dessert", "Nadeem Akhtar"),
  shawarma: vendor("Shawarma Station", "Food", "Faisal Raza"),
  pizza: vendor("Pizza Point", "Food", "Adnan Butt"),
  henna: vendor("Henna by Zara", "Services", "Zara Khan"),
  books: vendor("Book Nook", "Books", "Saad Hussain"),
  crafts: vendor("Crafts & Candles", "Accessories", "Hira Aslam"),
  thrift: vendor("Thrift Closet", "Clothing", "Maham Javed"),
  perfume: vendor("Perfume Bar", "Accessories", "Kashif Mirza"),
  games: vendor("Game Zone", "Games", "Talha Nadeem"),
  photo: vendor("Photo Booth Studio", "Services", "Owais Latif"),
  candy: vendor("Cotton Candy Co.", "Dessert", "Areeba Saleem"),
  dahi: vendor("Dahi Bhallay Point", "Food", "Waqas Anwar"),
  jewel: vendor("Jewellery Junction", "Accessories", "Sana Rauf"),
  phone: vendor("Phone Accessories Hub", "Accessories", "Junaid Arif"),
  smoothie: vendor("Smoothie Lab", "Drinks", "Mariam Tahir"),
};

// ---------- ledger builders ----------
const transactions: Transaction[] = [];
const donations: Donation[] = [];
const distributions: Distribution[] = [];
const vendorPayments: VendorPayment[] = [];
const eventVendors: EventVendor[] = [];

interface TxnInput {
  date: string;
  kind: TxnKind;
  amount: number;
  categoryId: string;
  eventId?: string;
  method?: PaymentMethod;
  counterparty?: string;
  description: string;
  reference?: string;
  hour?: number;
}
function txn(i: TxnInput): Transaction {
  const t: Transaction = {
    id: nextId(T.txn),
    code: "",
    date: i.date,
    kind: i.kind,
    direction: KIND_META[i.kind].direction,
    amount: i.amount,
    categoryId: i.categoryId,
    eventId: i.eventId,
    method: i.method ?? "cash",
    counterparty: i.counterparty,
    description: i.description,
    reference: i.reference,
    status: "posted",
    createdBy: ALI,
    createdAt: stamp(i.date, i.hour ?? 10 + Math.floor(rand() * 8), Math.floor(rand() * 60)),
  };
  transactions.push(t);
  return t;
}

function booking(ev: SocietyEvent, v: Vendor, stallNo: string, dayFees: number[], notes?: string) {
  const b: EventVendor = {
    id: nextId(T.booking),
    eventId: ev.id,
    vendorId: v.id,
    stallNo,
    stallType: v.stallType,
    dayFees,
    notes,
    createdAt: stamp(addDays(ev.startDate, -10), 12),
  };
  eventVendors.push(b);
  return b;
}
function vendorPay(b: EventVendor, date: string, amount: number, method: PaymentMethod = "cash", note?: string) {
  const v = vendors.find((x) => x.id === b.vendorId)!;
  const t = txn({
    date,
    kind: "vendor_payment",
    amount,
    categoryId: C.stallFee,
    eventId: b.eventId,
    method,
    counterparty: v.businessName,
    description: note ?? `Stall ${b.stallNo} fee`,
  });
  vendorPayments.push({ id: nextId(T.vpay), transactionId: t.id, eventVendorId: b.id, receiptNo: "" });
  return t;
}
/** Vendor pays each day's fee on that day, the way the Excel sheets track Day 1 / Day 2. */
function payDaily(ev: SocietyEvent, b: EventVendor) {
  b.dayFees.forEach((fee, i) => {
    if (fee > 0) vendorPay(b, addDays(ev.startDate, i), fee, "cash", `Day ${i + 1} stall fee, stall ${b.stallNo}`);
  });
}

function donation(date: string, amount: number, opts: { donor?: string; phone?: string; purpose: string; method?: PaymentMethod; eventId?: string; categoryId?: string; note?: string }) {
  const anonymous = !opts.donor;
  const t = txn({
    date,
    kind: "donation",
    amount,
    categoryId: opts.categoryId ?? C.donGeneral,
    eventId: opts.eventId,
    method: opts.method ?? "cash",
    counterparty: anonymous ? "Anonymous" : opts.donor,
    description: opts.note ?? `${opts.purpose} donation`,
  });
  donations.push({
    id: nextId(T.donation),
    transactionId: t.id,
    donorName: opts.donor,
    donorPhone: opts.phone,
    isAnonymous: anonymous,
    purpose: opts.purpose,
    receiptNo: "",
  });
  return t;
}

function aid(date: string, amount: number, opts: { recipient: string; type?: RecipientType; count?: number; categoryId: string; eventId?: string; method?: PaymentMethod; note: string; contact?: string }) {
  const t = txn({
    date,
    kind: "distribution",
    amount,
    categoryId: opts.categoryId,
    eventId: opts.eventId,
    method: opts.method ?? "cash",
    counterparty: opts.recipient,
    description: opts.note,
  });
  distributions.push({
    id: nextId(T.distribution),
    transactionId: t.id,
    recipientName: opts.recipient,
    recipientType: opts.type ?? "individual",
    recipientContact: opts.contact,
    beneficiaryCount: opts.count ?? 1,
    referenceNo: "",
  });
  return t;
}

const expense = (date: string, amount: number, categoryId: string, description: string, counterparty: string, eventId?: string, method: PaymentMethod = "cash", reference?: string) =>
  txn({ date, kind: "expense", amount, categoryId, description, counterparty, eventId, method, reference });
const income = (date: string, amount: number, categoryId: string, description: string, counterparty: string, eventId?: string, method: PaymentMethod = "cash") =>
  txn({ date, kind: "income", amount, categoryId, description, counterparty, eventId, method });

// ======================================================================
// 1. Flood Relief Appeal 2025 (collection)
// ======================================================================
const donorStudents = ["Hassan Ali", "Mehwish Khan", "Ahmed Raza", "Sidra Batool", "Umair Javed", "Noor Fatima", "Rabia Shahid", "Daniyal Asif", "Iqra Nawaz", "Shahzaib Akram", "Anum Riaz", "Moiz Siddiqui", "Laiba Arshad", "Hamid Latif", "Esha Qamar"];
const donorFaculty = ["Prof. Nasir Mahmood", "Dr. Saima Rehman", "Dr. Khalid Pervaiz", "Ms. Farah Deeba", "Mr. Tahir Abbas"];
const donorOrgs = ["Alumni batch 2019", "Al-Madina General Store", "City Pharma Distributors", "Pharmacy class of 2027", "Crescent Medical Store"];
const methods: PaymentMethod[] = ["cash", "cash", "cash", "easypaisa", "jazzcash", "bank_transfer"];

function donorFor(kind: "student" | "faculty" | "org") {
  if (kind === "student") return rand() < 0.3 ? undefined : pick(donorStudents);
  if (kind === "faculty") return rand() < 0.2 ? undefined : pick(donorFaculty);
  return pick(donorOrgs);
}
function sprinkleDonations(from: string, to: string, count: number, purpose: string, eventId?: string, categoryId?: string) {
  const span = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  for (let i = 0; i < count; i++) {
    const r = rand();
    const kind = r < 0.6 ? "student" : r < 0.85 ? "faculty" : "org";
    const amount = kind === "student" ? between(500, 5000, 500) : kind === "faculty" ? between(5000, 15000, 1000) : between(10000, 25000, 5000);
    const donor = donorFor(kind);
    donation(addDays(from, Math.floor(rand() * span)), amount, {
      donor,
      phone: donor && rand() < 0.5 ? `03${pick(["00", "21", "33"])}-555${pad(between(0, 9999, 1), 4)}` : undefined,
      purpose,
      method: pick(methods),
      eventId,
      categoryId: categoryId ?? pick([C.donGeneral, C.donSadaqah, C.donAppeal]),
    });
  }
}

sprinkleDonations("2025-08-28", "2025-09-19", 11, "Flood relief", E.flood.id, C.donAppeal);
income("2025-09-05", 15000, C.incDirect, "Contribution from society cabinet members", "Society cabinet", E.flood.id);
aid("2025-09-03", 24000, { recipient: "12 flood-affected families", type: "group", count: 12, categoryId: C.aidEmergency, eventId: E.flood.id, note: "Emergency cash, PKR 2,000 per family" });
aid("2025-09-08", 31500, { recipient: "18 families, relief camp list", type: "group", count: 18, categoryId: C.aidFood, eventId: E.flood.id, note: "Dry ration packs (flour, rice, lentils, oil)" });
aid("2025-09-15", 12000, { recipient: "Family of M. Rafiq", type: "family", count: 6, categoryId: C.aidEmergency, eventId: E.flood.id, note: "Roof repair support after flood damage" });
aid("2025-09-19", 9000, { recipient: "Relief camp medical desk", type: "institution", count: 40, categoryId: C.aidMedical, eventId: E.flood.id, note: "ORS, antiseptics and first-aid stock" });
expense("2025-09-06", 4500, C.exTransport, "Loader rent for ration delivery", "Local loader service", E.flood.id);
expense("2025-09-06", 2200, C.exPack, "Bags and packing tape for ration packs", "Wholesale market", E.flood.id);

// ======================================================================
// 2. Autumn Food Fair 2025  (exact figures from Funds_Sheet.xlsx)
// ======================================================================
{
  const ev = E.autumnFair;
  const rows: [Vendor, number[]][] = [
    [V.donuts, [3000, 0]],
    [V.tikka, [4000, 0]],
    [V.fries, [2000, 2000]],
    [V.chat, [3000, 2000]],
  ];
  rows.forEach(([v, fees], i) => payDaily(ev, booking(ev, v, `A-${pad(i + 1)}`, fees, fees[1] === 0 ? "Did not trade on day 2" : undefined)));
  income("2025-09-27", 6710, C.incStalls, "Funds raised by students stalls", "Student stall teams", ev.id);
  expense("2025-09-24", 3500, C.exVenue, "Tables and chairs rent (2 days)", "Rana Tent Service", ev.id);
  expense("2025-09-25", 1800, C.exPrint, "Fair banners", "Print Hub", ev.id);
}

// ======================================================================
// General activity Oct 2025 - Jan 2026
// ======================================================================
sprinkleDonations("2025-10-01", "2025-11-30", 7, "General fund");
sprinkleDonations("2025-12-01", "2026-01-31", 6, "Winter relief", undefined, C.donSadaqah);
income("2025-10-15", 20000, C.incSponsor, "Sponsorship for winter drive", "Crescent Medical Store");
income("2025-11-12", 6400, C.incOther, "Bake sale by society members", "Society members");
aid("2025-10-09", 8500, { recipient: "S. Bibi", categoryId: C.aidMedical, note: "Insulin and test strips for one month", method: "cash" });
aid("2025-10-22", 15000, { recipient: "BS student (fee case F-03)", categoryId: C.aidEducation, note: "Semester fee support, part payment", method: "bank_transfer" });
aid("2025-11-06", 6200, { recipient: "Family of A. Hameed", type: "family", count: 5, categoryId: C.aidUtility, note: "Electricity bill (two months arrears)" });
aid("2025-11-20", 10000, { recipient: "N. Akram", categoryId: C.aidFinancial, note: "Support after job loss", method: "easypaisa" });
aid("2026-01-14", 7500, { recipient: "R. Begum", categoryId: C.aidMedical, note: "Physiotherapy sessions", method: "cash" });
aid("2026-01-28", 12000, { recipient: "MSc student (fee case F-07)", categoryId: C.aidEducation, note: "Hostel dues support", method: "bank_transfer" });
expense("2025-10-03", 1200, C.exStationery, "Receipt books and registers", "Stationery Mart");
expense("2025-11-18", 850, C.exMisc, "Bank charges and cheque book", "Bank");
expense("2026-01-10", 1500, C.exTransport, "Travel for beneficiary home visits", "Rickshaw fares");

// ======================================================================
// 3. Winter Relief Drive 2025 (expenditure)
// ======================================================================
{
  const ev = E.winterDrive;
  aid("2025-12-18", 28800, { recipient: "36 families, winter list", type: "group", count: 36, categoryId: C.aidWinter, eventId: ev.id, note: "Blankets, 36 x PKR 800" });
  aid("2025-12-19", 16500, { recipient: "Children of 22 families", type: "group", count: 22, categoryId: C.aidWinter, eventId: ev.id, note: "Children's jackets and socks" });
  expense("2025-12-18", 3500, C.exTransport, "Van hire for distribution", "Local van service", ev.id);
  expense("2025-12-17", 1400, C.exPack, "Carry bags", "Wholesale market", ev.id);
  expense("2025-12-20", 1600, C.exFood, "Volunteer tea and lunch", "Canteen", ev.id);
}

// ======================================================================
// 4. Winter Food Fair 2026  (exact figures from Funds.xlsx)
// ======================================================================
{
  const ev = E.winterFair;
  const rows: [Vendor, number[]][] = [
    [V.fries, [2000, 2000]],
    [V.juice, [2000, 2000]],
    [V.bbq, [4000, 4000]],
    [V.momos, [2500, 2500]],
    [V.samosa, [2500, 2500]],
    [V.sitara, [3500, 3500]],
  ];
  rows.forEach(([v, fees], i) => payDaily(ev, booking(ev, v, `B-${pad(i + 1)}`, fees)));
  income("2026-02-14", 12000, C.incStalls, "Funds raised by students stalls", "Student stall teams", ev.id);
  expense("2026-02-11", 4500, C.exVenue, "Canopies and tables (2 days)", "Rana Tent Service", ev.id);
  expense("2026-02-12", 2500, C.exSound, "Sound system rent", "DJ Sound House", ev.id);
  expense("2026-02-12", 2200, C.exPrint, "Banners and stall number cards", "Print Hub", ev.id);
}

// ======================================================================
// 5 & 6. Ramzan Appeal (collection) and Iftar & Ration Drive (expenditure)
// ======================================================================
sprinkleDonations("2026-02-10", "2026-03-14", 14, "Ramzan appeal", E.ramzanAppeal.id, C.donZakat);
donation("2026-02-25", 25000, { donor: "Alumni batch 2019", purpose: "Ramzan appeal", method: "bank_transfer", eventId: E.ramzanAppeal.id, categoryId: C.donZakat });
{
  const ev = E.iftarDrive;
  aid("2026-02-20", 42000, { recipient: "30 families, ration list", type: "group", count: 30, categoryId: C.aidRamzan, eventId: ev.id, note: "Monthly ration bags, 30 x PKR 1,400" });
  aid("2026-03-02", 29400, { recipient: "21 families, second list", type: "group", count: 21, categoryId: C.aidRamzan, eventId: ev.id, note: "Monthly ration bags, 21 x PKR 1,400" });
  aid("2026-03-10", 11500, { recipient: "Iftar for daily-wage workers", type: "group", count: 120, categoryId: C.aidFood, eventId: ev.id, note: "Iftar boxes over 5 evenings" });
  aid("2026-03-17", 9000, { recipient: "6 families, Eid support", type: "group", count: 6, categoryId: C.aidRamzan, eventId: ev.id, note: "Eid clothes for children" });
  expense("2026-02-19", 3800, C.exPack, "Ration bag packaging", "Wholesale market", ev.id);
  expense("2026-02-21", 4000, C.exTransport, "Delivery loader, 2 trips", "Local loader service", ev.id);
  expense("2026-03-10", 2400, C.exWater, "Water bottles for iftar", "Nestle distributor", ev.id);
}

// ======================================================================
// 7. Sports Gala Stalls 2026 (fundraiser, one vendor still owes)
// ======================================================================
{
  const ev = E.sportsGala;
  const rows: [Vendor, number[]][] = [
    [V.fries, [2500, 2500]],
    [V.bbq, [4000, 4000]],
    [V.chai, [2500, 2500]],
    [V.shawarma, [3500, 3500]],
    [V.smoothie, [3000, 3000]],
    [V.kulfi, [2500, 2500]],
    [V.games, [3000, 3000]],
    [V.pizza, [3500, 3500]],
  ];
  rows.forEach(([v, fees], i) => {
    const b = booking(ev, v, `S-${pad(i + 1)}`, fees);
    if (v === V.pizza) vendorPay(b, "2026-04-16", 3500, "cash", `Day 1 stall fee, stall ${b.stallNo}`);
    else payDaily(ev, b);
  });
  eventVendors.at(-1)!.notes = "Day 2 fee outstanding. Promised to pay after Eid.";
  income("2026-04-17", 8500, C.incStalls, "Funds raised by students stalls", "Student stall teams", ev.id);
  expense("2026-04-14", 7500, C.exVenue, "Canopies, tables, chairs", "Rana Tent Service", ev.id);
  expense("2026-04-15", 6000, C.exSound, "Sound and commentary system", "DJ Sound House", ev.id);
  expense("2026-04-15", 2500, C.exPrint, "Stall banners", "Print Hub", ev.id);
}

// ======================================================================
// 8. Free Medical Camp (expenditure)
// ======================================================================
sprinkleDonations("2026-04-01", "2026-05-31", 5, "Medical fund", undefined, C.donSadaqah);
{
  const ev = E.medicalCamp;
  aid("2026-05-09", 22500, { recipient: "Camp patients (dispensed medicines)", type: "group", count: 86, categoryId: C.aidMedical, eventId: ev.id, note: "Medicines dispensed free at the camp" });
  aid("2026-05-09", 6000, { recipient: "Lab tests for 30 patients", type: "group", count: 30, categoryId: C.aidMedical, eventId: ev.id, note: "Blood sugar and Hb tests" });
  expense("2026-05-08", 3000, C.exVenue, "Community hall booking", "Community hall", ev.id);
  expense("2026-05-09", 2800, C.exFood, "Refreshments for volunteer doctors", "Canteen", ev.id);
  expense("2026-05-06", 1500, C.exPrint, "Patient slips and posters", "Print Hub", ev.id);
}

// ======================================================================
// General activity Jun - Aug 2026
// ======================================================================
sprinkleDonations("2026-06-01", "2026-08-31", 8, "General fund");
income("2026-06-20", 5000, C.incDirect, "Faculty advisor contribution", "Faculty advisor");
income("2026-08-12", 7200, C.incOther, "Independence Day badge sale", "Society members");
aid("2026-06-11", 9500, { recipient: "K. Parveen", categoryId: C.aidMedical, note: "Cataract surgery contribution", method: "cash" });
aid("2026-07-02", 18000, { recipient: "BS student (fee case F-11)", categoryId: C.aidEducation, note: "Semester fee support", method: "bank_transfer" });
aid("2026-07-19", 5400, { recipient: "Family of Z. Ahmed", type: "family", count: 4, categoryId: C.aidUtility, note: "Gas bill arrears" });
aid("2026-08-06", 8000, { recipient: "M. Aslam", categoryId: C.aidFinancial, note: "Rent support for one month", method: "jazzcash" });
aid("2026-08-25", 6500, { recipient: "T. Bibi", categoryId: C.aidOther, note: "Wheelchair repair", method: "cash" });
expense("2026-06-15", 1100, C.exStationery, "Files and printing for records", "Stationery Mart");
expense("2026-08-10", 950, C.exMisc, "Bank charges", "Bank");

// ======================================================================
// 9. Welcome Back Collection Drive (active)
// ======================================================================
sprinkleDonations("2026-09-01", "2026-09-23", 7, "Education fund", E.welcomeDrive.id, C.donGeneral);
income("2026-09-12", 10000, C.incDirect, "Cabinet contribution to education fund", "Society cabinet", E.welcomeDrive.id);
aid("2026-09-15", 16000, { recipient: "BS student (fee case F-14)", categoryId: C.aidEducation, eventId: E.welcomeDrive.id, note: "Admission fee support", method: "bank_transfer" });
aid("2026-09-21", 7000, { recipient: "Book bank, 14 students", type: "group", count: 14, categoryId: C.aidEducation, eventId: E.welcomeDrive.id, note: "Second-hand textbooks" });

// ======================================================================
// 10. University Charity Mela 2026 (active, bookings open)
// ======================================================================
{
  const ev = E.mela;
  const plan: [Vendor, number[], "paid" | "advance" | "none"][] = [
    [V.biryani, [5000, 5000], "paid"],
    [V.chai, [4000, 4000], "paid"],
    [V.golgappay, [4000, 4000], "advance"],
    [V.kulfi, [3500, 3500], "paid"],
    [V.shawarma, [5000, 5000], "advance"],
    [V.pizza, [5000, 5000], "none"],
    [V.henna, [3000, 3000], "paid"],
    [V.books, [3000, 3000], "advance"],
    [V.crafts, [3000, 3000], "paid"],
    [V.thrift, [3500, 3500], "advance"],
    [V.perfume, [3500, 3500], "none"],
    [V.games, [4000, 4000], "advance"],
    [V.photo, [3000, 3000], "paid"],
    [V.candy, [3000, 3000], "advance"],
    [V.dahi, [4000, 4000], "none"],
    [V.jewel, [3500, 3500], "none"],
    [V.bbq, [5000, 5000], "advance"],
    [V.smoothie, [4000, 4000], "paid"],
  ];
  plan.forEach(([v, fees, state], i) => {
    const b = booking(ev, v, `M-${pad(i + 1)}`, fees);
    b.createdAt = stamp(addDays("2026-09-02", i), 13);
    const total = fees[0] + fees[1];
    const d = addDays("2026-09-03", i);
    if (state === "paid") vendorPay(b, d, total, pick(["cash", "easypaisa", "jazzcash"] as PaymentMethod[]), `Full booking fee, stall ${b.stallNo}`);
    if (state === "advance") vendorPay(b, d, fees[0], "cash", `Advance (day 1 fee), stall ${b.stallNo}`);
    if (state === "none") b.notes = "Booking confirmed by phone. Payment due before 10 Oct.";
  });
  expense("2026-09-18", 4200, C.exPrint, "Mela posters and social media boosts", "Print Hub", ev.id);
  expense("2026-09-20", 15000, C.exVenue, "Tent service advance", "Rana Tent Service", ev.id, "bank_transfer", "Invoice RTS-884");
}

// ======================================================================
// Corrections, to show the void workflow in the audit trail
// ======================================================================
{
  donation("2025-11-03", 5000, { donor: "Dr. Saima Rehman", purpose: "General fund", method: "bank_transfer" });
  const dup = donation("2025-11-03", 5000, { donor: "Dr. Saima Rehman", purpose: "General fund", method: "bank_transfer" });
  dup.status = "void";
  dup.voidReason = "Duplicate entry. Same bank transfer recorded twice.";
  dup.voidedBy = ALI;
  dup.voidedAt = stamp("2025-11-04", 9, 12);

  const wrong = expense("2026-04-15", 6500, C.exSound, "Sound and commentary system", "DJ Sound House", E.sportsGala.id);
  wrong.status = "void";
  wrong.voidReason = "Wrong amount. Invoice was PKR 6,000; re-entered correctly.";
  wrong.voidedBy = ALI;
  wrong.voidedAt = stamp("2026-04-18", 16, 40);
}

// ---------- codes, receipts, verification ----------
transactions.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
transactions.forEach((t, i) => {
  t.code = `TXN-${pad(i + 1, 4)}`;
  if (t.date <= "2026-08-31" && t.status === "posted") {
    t.verifiedBy = AYESHA;
    t.verifiedAt = stamp(addDays(t.date, 3), 18, 30);
  }
});
const txnById = new Map(transactions.map((t) => [t.id, t]));
function numberDocs<X extends { transactionId: string }>(docs: X[], prefix: string, set: (d: X, no: string) => void) {
  const perYear: Record<string, number> = {};
  [...docs]
    .sort((a, b) => txnById.get(a.transactionId)!.code.localeCompare(txnById.get(b.transactionId)!.code))
    .forEach((d) => {
      const y = txnById.get(d.transactionId)!.date.slice(0, 4);
      perYear[y] = (perYear[y] ?? 0) + 1;
      set(d, `${prefix}-${y}-${pad(perYear[y], 4)}`);
    });
}
numberDocs(vendorPayments, "VR", (d, no) => (d.receiptNo = no));
numberDocs(donations, "DR", (d, no) => (d.receiptNo = no));
numberDocs(distributions, "AID", (d, no) => (d.referenceNo = no));
// Put receipt numbers on the ledger rows so they show up in search
vendorPayments.forEach((d) => (txnById.get(d.transactionId)!.reference = d.receiptNo));
donations.forEach((d) => (txnById.get(d.transactionId)!.reference = d.receiptNo));
distributions.forEach((d) => (txnById.get(d.transactionId)!.reference = d.referenceNo));

// ---------- audit log ----------
const auditLogs: AuditLog[] = [];
const nameOf = (id: string) => profiles.find((p) => p.id === id)!.fullName;
function log(actorId: string, action: AuditLog["action"], entity: string, summary: string, createdAt: string, entityId?: string, changes?: AuditLog["changes"]) {
  auditLogs.push({ id: nextId(T.audit), actorId, actorName: nameOf(actorId), action, entity, entityId, summary, createdAt, changes });
}
events.forEach((e) => log(ALI, "create", "event", `Created event "${e.name}"`, e.createdAt, e.id));
eventVendors.forEach((b) => {
  const v = vendors.find((x) => x.id === b.vendorId)!;
  const e = events.find((x) => x.id === b.eventId)!;
  log(ALI, "create", "event_vendor", `Added vendor "${v.businessName}" to ${e.name} (stall ${b.stallNo})`, b.createdAt, b.id);
});
transactions.forEach((t) => {
  const what =
    t.kind === "vendor_payment"
      ? `vendor payment from ${t.counterparty}`
      : t.kind === "donation"
        ? `donation from ${t.counterparty}`
        : t.kind === "distribution"
          ? `aid to ${t.counterparty}`
          : t.kind === "expense"
            ? `expense "${t.description}"`
            : `income "${t.description}"`;
  log(t.createdBy, "create", "transaction", `Recorded PKR ${t.amount.toLocaleString("en-PK")} ${what} (${t.code})`, t.createdAt, t.id);
  if (t.status === "void") log(t.voidedBy!, "void", "transaction", `Voided ${t.code}: ${t.voidReason}`, t.voidedAt!, t.id, { status: { from: "posted", to: "void" } });
  if (t.verifiedAt && t.date >= "2026-06-01") log(AYESHA, "verify", "transaction", `Verified ${t.code}`, t.verifiedAt, t.id);
});
const melaPizza = eventVendors.find((b) => b.eventId === E.mela.id && b.vendorId === V.pizza.id)!;
log(ALI, "update", "event_vendor", `Edited stall fee for "Pizza Point" at University Charity Mela 2026`, stamp("2026-09-10", 15, 20), melaPizza.id, { dayFees: { from: [4000, 4000], to: [5000, 5000] } });
log(AYESHA, "view", "report", "Viewed monthly report for August 2026", stamp("2026-09-02", 20, 10));
log(AYESHA, "view", "report", "Viewed event report for Sports Gala Stalls 2026", stamp("2026-05-02", 19, 45));
log(AYESHA, "export", "report", "Exported donation report (Feb to Mar 2026) as CSV", stamp("2026-03-22", 21, 5));
log(AYESHA, "role_change", "profile", "Changed Zainab Iqbal's role to Member", stamp("2026-02-01", 12, 0), profiles[5].id, { role: { from: null, to: "member" } });
log(ALI, "print", "receipt", "Printed 6 vendor receipts for Winter Food Fair 2026", stamp("2026-02-14", 21, 30));
log(ALI, "update", "settings", "Set opening balance to PKR 18,500 (handed over by previous cabinet)", stamp("2025-08-01", 10, 0), undefined, { openingBalance: { from: 0, to: 18500 } });
auditLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const demoSnapshot: Snapshot = {
  settings: {
    societyName: "Adeeb Rizvi Serving Humanity Society",
    subtitle: "Finance Office",
    openingBalance: 18500,
    openingBalanceDate: "2025-08-01",
    receiptFooter: "Thank you for supporting our welfare work. This receipt is valid only with both signatures.",
  },
  profiles,
  categories,
  events,
  eventMembers,
  vendors,
  eventVendors,
  transactions,
  donations,
  distributions,
  vendorPayments,
  auditLogs,
};

/** Returns a fresh deep copy so the store can mutate freely. */
export function freshDemoSnapshot(): Snapshot {
  return JSON.parse(JSON.stringify(demoSnapshot));
}
