/**
 * Product catalogue — single source of truth for /shop, /shop/[slug] and
 * the homepage bestsellers strip. Eventually this file will be swapped for
 * a WordPress / REST fetch; the shape here is what the UI expects.
 *
 * Keep it a plain TS module (no client hooks) so it can be imported from
 * server components for static generation.
 */

export type ProcessKind = "Мита" | "Натуральна" | "Інф'юз" | "Бленд";
export type RoastProfile = "Фільтр" | "Еспресо" | "Універсальна";
export type GrindOption =
  | "Не молоти"
  | "Еспресо"
  | "V60"
  | "Аеропрес"
  | "French Press"
  | "Moka";
export type Badge = "Новий" | "Bestseller" | "Limited";

/** Top-level product category. Mirrors the tiles on the homepage — "subscription"
 *  lives outside the catalogue as a separate route, everything else is a real
 *  SKU grouping here. */
export type CategoryKey =
  | "beans"
  | "ground"
  | "drip"
  | "capsules"
  | "gear"
  | "grinders"
  | "gifts";

export const CATEGORIES: Array<{ key: CategoryKey; label: string }> = [
  { key: "beans", label: "Кава в зернах" },
  { key: "ground", label: "Мелена кава" },
  { key: "drip", label: "Дріп-пакети" },
  { key: "capsules", label: "Капсули" },
  { key: "gear", label: "Аксесуари" },
  { key: "grinders", label: "Млинки" },
  { key: "gifts", label: "Подарункові сети" },
];

/** Coffee-specific vs universal fields: beans/ground/drip/capsules share the
 *  coffee data model (origin, tasting notes, meters, roast). gear / grinders /
 *  gifts don't — their Product has these fields omitted. Helpers below let
 *  the UI branch on shape cleanly. */
const COFFEE_CATEGORIES = new Set<CategoryKey>([
  "beans",
  "ground",
  "drip",
  "capsules",
]);

export function isCoffeeCategory(key: CategoryKey): boolean {
  return COFFEE_CATEGORIES.has(key);
}

export interface WeightVariant {
  /** Display label, e.g. "250 г" */
  label: string;
  /** Raw grams — used for sorting / calculations */
  grams: number;
  /** Price in UAH for this weight */
  price: number;
}

export interface TasteMeters {
  /** 1 – 5 scale */
  acidity: number;
  sweetness: number;
  bitterness: number;
}

/** A single brewing method recommendation with its key parameters.
 *  Coffee SKUs only — used by the PDP "Спосіб приготування" block.
 *  All numeric/textual params are optional so a method can be listed even
 *  when only a couple of dial-ins are known. */
export type BrewMethodName =
  | "Еспресо"
  | "V60"
  | "Аеропрес"
  | "Chemex"
  | "Moka"
  | "French Press";

export interface BrewMethod {
  method: BrewMethodName;
  /** Coffee : water ratio, e.g. "1:16" or "18 → 36" for espresso */
  ratio?: string;
  /** Recommended grind, free-form so it reads naturally — "Середній",
   *  "Дрібний", "Грубий, як морська сіль". */
  grind?: string;
  /** Brew water temperature in °C. */
  waterTemp?: number;
  /** Total time, e.g. "3:00", "25 с", "близько 4 хв". */
  time?: string;
  /** Optional one-line guidance — bloom amount, technique tip, etc. */
  tip?: string;
}

export interface Product {
  slug: string;
  name: string;
  /** Top-level category — drives the sidebar filter + homepage tiles. */
  category: CategoryKey;
  /** One-liner under the title on the card */
  shortDescription: string;
  /** Paragraph story on the PDP */
  story: string;
  weights: WeightVariant[];
  /** Gradients used as placeholder imagery until real photos land. First
   *  gradient is the primary (card + hero). Rest populate the PDP gallery. */
  gallery: string[];
  badge?: Badge;
  inStock: boolean;
  // --- coffee-specific (beans / ground / drip / capsules). Omitted for
  // gear / grinders / gifts where none of these apply. ---
  /** "Сідамо, Ефіопія" — for breadcrumb + meta */
  origin?: string;
  country?: string;
  region?: string;
  process?: ProcessKind;
  /** Spec-sheet fields surfaced on the PDP origin panel. All optional —
   *  panels gracefully omit cells with no value rather than rendering "—",
   *  so partial data still looks clean. */
  altitude?: string; // "1 950 м"
  varietal?: string; // "Heirloom" / "Bourbon, Caturra"
  farm?: string; // farm or co-op name
  harvest?: string; // "Січень 2026"
  /** One or more roast profiles the customer can choose between.
   *  Single-element array → roast is fixed, UI still renders it as a pill. */
  roasts?: RoastProfile[];
  /** 3 tasting notes — short nouns */
  notes?: string[];
  meters?: TasteMeters;
  /** Grind choices for the PDP dropdown. Omitted for pre-portioned products
   *  (drip packs, capsules) and non-coffee gear. */
  grinds?: GrindOption[];
  /** Recommended brewing methods + per-method dial-ins. Coffee SKUs only.
   *  Order matters — first entry is the "default" method shown initially
   *  on the PDP recipe block. */
  brewing?: BrewMethod[];
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const PRODUCTS: Product[] = [
  {
    slug: "ethiopia-sidamo",
    name: "Ефіопія Сідамо",
    category: "beans",
    origin: "Сідамо, Ефіопія",
    country: "Ефіопія",
    region: "Сідамо",
    process: "Натуральна",
    altitude: "1 950 м",
    varietal: "Heirloom",
    farm: "Sidama Coffee Farmers Co-op",
    harvest: "Січень 2026",
    roasts: ["Фільтр", "Еспресо"],
    notes: ["Полуниця", "Чорний чай", "Мед"],
    shortDescription: "Ягідна й квітуча — лоту з натуральною обробкою.",
    story:
      "Лот з ферми на висоті 1 950 м у Сідамо. Довга суха ферментація на піднятих ліжках надає чашці ваги чорного чаю й полуничного варення. У центрі — тиха медова солодкість, яка довго тримається у післясмаку.",
    meters: { acidity: 4, sweetness: 4, bitterness: 2 },
    weights: [
      { label: "250 г", grams: 250, price: 420 },
      { label: "500 г", grams: 500, price: 790 },
      { label: "1 кг", grams: 1000, price: 1490 },
    ],
    grinds: ["Не молоти", "V60", "Аеропрес", "Еспресо"],
    brewing: [
      {
        method: "V60",
        ratio: "1:16",
        grind: "Середній",
        waterTemp: 92,
        time: "3:00",
        tip: "Bloom 40 г на 30 с — розкриває чай і ягоду.",
      },
      {
        method: "Аеропрес",
        ratio: "1:14",
        grind: "Дрібніший за середній",
        waterTemp: 88,
        time: "1:30",
        tip: "Інверт-метод, 30 с занурення перед прокачкою.",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 35% 35%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
      "radial-gradient(ellipse at 60% 50%, #D19E6E 0%, #8A4F2A 65%, #3A1F10 100%)",
      "radial-gradient(ellipse at 45% 60%, #F0CFA3 0%, #A16439 60%, #5A2E16 100%)",
    ],
    badge: "Bestseller",
    inStock: true,
  },
  {
    slug: "colombia-huila",
    name: "Колумбія Уїла",
    category: "beans",
    origin: "Уїла, Колумбія",
    country: "Колумбія",
    region: "Уїла",
    process: "Мита",
    altitude: "1 700 м",
    varietal: "Caturra, Castillo",
    farm: "Finca El Mirador",
    harvest: "Грудень 2025",
    roasts: ["Еспресо", "Фільтр"],
    notes: ["Молочний шоколад", "Карамель", "Яблуко"],
    shortDescription: "Класичний баланс — шоколад і карамель у чашці.",
    story:
      "Мита обробка надає лоту чистоти й щільності тіла. Ферма невелика, збирають руками. У профілі під еспресо — вершкова карамель і молочний шоколад, з легкою кислинкою стиглого червоного яблука наприкінці.",
    meters: { acidity: 3, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "250 г", grams: 250, price: 390 },
      { label: "500 г", grams: 500, price: 730 },
      { label: "1 кг", grams: 1000, price: 1390 },
    ],
    grinds: ["Не молоти", "Еспресо", "Moka", "French Press"],
    brewing: [
      {
        method: "Еспресо",
        ratio: "18 → 36 г",
        grind: "Дрібний",
        waterTemp: 93,
        time: "26 с",
        tip: "Підходить як для чорного, так і для молочних напоїв.",
      },
      {
        method: "Moka",
        ratio: "1:7",
        grind: "Середньо-дрібний",
        time: "близько 4 хв",
        tip: "Холодна вода в нижній резервуар, не додавай тепла після свистка.",
      },
      {
        method: "French Press",
        ratio: "1:15",
        grind: "Грубий",
        waterTemp: 94,
        time: "4:00",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 55% 50%, #C9935E 0%, #7A4A2A 60%, #3D2416 100%)",
      "radial-gradient(ellipse at 40% 45%, #B07A48 0%, #5A3420 65%, #2E180C 100%)",
    ],
    badge: "Bestseller",
    inStock: true,
  },
  {
    slug: "kenya-nyeri",
    name: "Кенія Ньєрі",
    category: "beans",
    origin: "Ньєрі, Кенія",
    country: "Кенія",
    region: "Ньєрі",
    process: "Мита",
    altitude: "1 800 м",
    varietal: "SL28, SL34",
    farm: "Tegu Factory",
    harvest: "Листопад 2025",
    roasts: ["Фільтр"],
    notes: ["Чорна смородина", "Грейпфрут", "Томат"],
    shortDescription: "Яскрава, з томатом і чорною смородиною.",
    story:
      "Кенійська класика — складна, щільна, з глибокою кислотністю. У чашці читається чорна смородина, цедра грейпфрута і несподівана нотка в'яленого томата. Лот під V60 або Kalita — там профіль розкривається найповніше.",
    meters: { acidity: 5, sweetness: 3, bitterness: 2 },
    weights: [
      { label: "250 г", grams: 250, price: 460 },
      { label: "500 г", grams: 500, price: 870 },
    ],
    grinds: ["Не молоти", "V60", "Аеропрес"],
    brewing: [
      {
        method: "V60",
        ratio: "1:16",
        grind: "Середній",
        waterTemp: 93,
        time: "3:15",
        tip: "Висока кислотність грейпфрута розкривається на чистому V60.",
      },
      {
        method: "Chemex",
        ratio: "1:17",
        grind: "Середньо-грубий",
        waterTemp: 92,
        time: "4:30",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 50% 50%, #D97A6A 0%, #8B3A2E 55%, #3F1812 100%)",
      "radial-gradient(ellipse at 35% 45%, #C56A5A 0%, #6F2A22 65%, #301008 100%)",
    ],
    badge: "Новий",
    inStock: true,
  },
  {
    slug: "brazil-cerrado",
    name: "Бразилія Серрадо",
    category: "beans",
    origin: "Серрадо, Бразилія",
    country: "Бразилія",
    region: "Серрадо",
    process: "Натуральна",
    altitude: "1 100 м",
    varietal: "Yellow Catuaí",
    farm: "Fazenda Sertãozinho",
    harvest: "Серпень 2025",
    roasts: ["Еспресо"],
    notes: ["Горіх", "Какао", "Апельсин"],
    shortDescription: "Щільне тіло, горіх і какао — для щоденного ранку.",
    story:
      "Класика для ранкового еспресо: горіх, какао, ледь помітна цитрусова нотка в післясмаку. Лот з плантації на плато Серрадо — суха природна ферментація додає чашці солодощі без надмірної кислоти.",
    meters: { acidity: 2, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "250 г", grams: 250, price: 360 },
      { label: "500 г", grams: 500, price: 680 },
      { label: "1 кг", grams: 1000, price: 1290 },
    ],
    grinds: ["Не молоти", "Еспресо", "Moka", "French Press"],
    brewing: [
      {
        method: "Еспресо",
        ratio: "18 → 36 г",
        grind: "Дрібний",
        waterTemp: 92,
        time: "27 с",
        tip: "Горіх і какао у крему — добре під капучино.",
      },
      {
        method: "Moka",
        ratio: "1:7",
        grind: "Середньо-дрібний",
        time: "близько 4 хв",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 40% 45%, #B87F52 0%, #5E3A22 65%, #2A1810 100%)",
      "radial-gradient(ellipse at 55% 55%, #A06E43 0%, #4A2C18 70%, #1F1008 100%)",
    ],
    inStock: true,
  },
  {
    slug: "guatemala-antigua",
    name: "Гватемала Антигуа",
    category: "beans",
    origin: "Антигуа, Гватемала",
    country: "Гватемала",
    region: "Антигуа",
    process: "Мита",
    altitude: "1 600 м",
    varietal: "Bourbon, Caturra",
    farm: "Finca La Soledad",
    harvest: "Лютий 2026",
    roasts: ["Еспресо"],
    notes: ["Темний шоколад", "Какао боб", "Спеції"],
    shortDescription: "Темніше обсмажений — чорний шоколад і спеції.",
    story:
      "Вирощений у вулканічному ґрунті Антигуа на висоті понад 1 600 м. Профіль темнішого обсмажування витягає з зерна чорний шоколад, какао боб і теплі спеції. Добре тримається у латте й капучино.",
    meters: { acidity: 2, sweetness: 3, bitterness: 4 },
    weights: [
      { label: "250 г", grams: 250, price: 410 },
      { label: "500 г", grams: 500, price: 770 },
    ],
    grinds: ["Не молоти", "Еспресо", "Moka"],
    brewing: [
      {
        method: "Еспресо",
        ratio: "18 → 38 г",
        grind: "Дрібний",
        waterTemp: 93,
        time: "28 с",
        tip: "Темний шоколад тримає молочні напої — особливо латте.",
      },
      {
        method: "French Press",
        ratio: "1:15",
        grind: "Грубий",
        waterTemp: 95,
        time: "4:00",
        tip: "Витримай 4 хв, прокачай повільно — менше осаду.",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 45% 50%, #9D6B4A 0%, #4A2A1A 70%, #1F1008 100%)",
      "radial-gradient(ellipse at 55% 45%, #8A5E40 0%, #402410 70%, #180C06 100%)",
    ],
    inStock: true,
  },
  {
    slug: "costa-rica-tarrazu",
    name: "Коста-Ріка Таррасу",
    category: "beans",
    origin: "Таррасу, Коста-Ріка",
    country: "Коста-Ріка",
    region: "Таррасу",
    process: "Мита",
    altitude: "1 750 м",
    varietal: "Caturra, Catuaí",
    farm: "Beneficio Tarrazú",
    harvest: "Січень 2026",
    roasts: ["Фільтр", "Еспресо"],
    notes: ["Червоне яблуко", "Мигдаль", "Ваніль"],
    shortDescription: "Універсальна кава, що смакує і у V60, і в еспресо.",
    story:
      "М'який універсальний профіль — однаково добре розкривається у фільтрі й еспресо. Червоне яблуко тримає кислотний каркас, мигдаль додає тіла, ваніль залишає делікатний післясмак.",
    meters: { acidity: 3, sweetness: 4, bitterness: 2 },
    weights: [
      { label: "250 г", grams: 250, price: 440 },
      { label: "500 г", grams: 500, price: 830 },
      { label: "1 кг", grams: 1000, price: 1590 },
    ],
    grinds: ["Не молоти", "V60", "Аеропрес", "Еспресо", "Moka"],
    brewing: [
      {
        method: "V60",
        ratio: "1:16",
        grind: "Середній",
        waterTemp: 92,
        time: "3:00",
      },
      {
        method: "Аеропрес",
        ratio: "1:14",
        grind: "Дрібніший за середній",
        waterTemp: 89,
        time: "1:30",
      },
      {
        method: "Еспресо",
        ratio: "18 → 36 г",
        grind: "Дрібний",
        waterTemp: 93,
        time: "27 с",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 50% 55%, #D4A574 0%, #8B5A3C 55%, #3D2417 100%)",
      "radial-gradient(ellipse at 40% 45%, #C29669 0%, #7A4E30 60%, #2E1A10 100%)",
    ],
    badge: "Новий",
    inStock: true,
  },
  {
    slug: "ethiopia-bensa-infused",
    name: "Ефіопія Бенса",
    category: "beans",
    origin: "Бенса, Ефіопія",
    country: "Ефіопія",
    region: "Бенса",
    process: "Інф'юз",
    altitude: "2 050 м",
    varietal: "Heirloom 74110",
    farm: "Daye Bensa Coffee",
    harvest: "Грудень 2025",
    roasts: ["Фільтр"],
    notes: ["Манго", "Персик", "Бергамот"],
    shortDescription: "Експериментальна інф'юзія — манго й персик.",
    story:
      "Інф'юзія з натуральних фруктових заквасок під час ферментації — у чашці читаються стиглий манго й соковитий персик, довгий післясмак з бергамотом. Обмежена партія, під V60 і Chemex.",
    meters: { acidity: 4, sweetness: 5, bitterness: 1 },
    weights: [
      { label: "250 г", grams: 250, price: 520 },
      { label: "500 г", grams: 500, price: 990 },
    ],
    grinds: ["Не молоти", "V60", "Аеропрес"],
    brewing: [
      {
        method: "V60",
        ratio: "1:17",
        grind: "Середній",
        waterTemp: 91,
        time: "3:30",
        tip: "Нижча температура зберігає тонкі ноти манго й бергамоту.",
      },
      {
        method: "Chemex",
        ratio: "1:17",
        grind: "Середньо-грубий",
        waterTemp: 92,
        time: "5:00",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 45% 40%, #E8C89A 0%, #B87A4E 55%, #5E3220 100%)",
      "radial-gradient(ellipse at 55% 55%, #D9B886 0%, #9C663C 60%, #3E1E10 100%)",
    ],
    badge: "Limited",
    inStock: true,
  },
  {
    slug: "house-blend",
    name: "House Blend N°1",
    category: "beans",
    origin: "Бразилія + Ефіопія",
    country: "Купаж",
    region: "Бленд",
    process: "Бленд",
    varietal: "Yellow Catuaí · Heirloom",
    harvest: "Свіжа партія щотижня",
    roasts: ["Еспресо", "Фільтр"],
    notes: ["Молочний шоколад", "Лісовий горіх", "Родзинки"],
    shortDescription: "Щоденний бленд під еспресо й молочні напої.",
    story:
      "Наш основний домашній бленд — база з бразильського натурала й ефіопського мита. Під еспресо й молочні напої: молочний шоколад і лісовий горіх у першому ковтку, родзинки в післясмаку. Добре тримається у чашці навіть за помилок помелу.",
    meters: { acidity: 3, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "250 г", grams: 250, price: 340 },
      { label: "500 г", grams: 500, price: 640 },
      { label: "1 кг", grams: 1000, price: 1190 },
    ],
    grinds: ["Не молоти", "Еспресо", "Moka", "French Press"],
    brewing: [
      {
        method: "Еспресо",
        ratio: "18 → 36 г",
        grind: "Дрібний",
        waterTemp: 92,
        time: "26 с",
        tip: "Універсальний рецепт під щоденне еспресо й каппучино.",
      },
      {
        method: "Moka",
        ratio: "1:7",
        grind: "Середньо-дрібний",
        time: "близько 4 хв",
      },
      {
        method: "French Press",
        ratio: "1:15",
        grind: "Грубий",
        waterTemp: 94,
        time: "4:00",
      },
    ],
    gallery: [
      "radial-gradient(ellipse at 50% 50%, #A87B58 0%, #5A3A24 65%, #241410 100%)",
      "radial-gradient(ellipse at 40% 55%, #9C7050 0%, #4E3020 70%, #1A0E08 100%)",
    ],
    badge: "Bestseller",
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Дріп-пакети — попередньо змелена кава у пакетиках, готова до заварювання.
  // ---------------------------------------------------------------------------
  {
    slug: "drip-ethiopia-sidamo",
    name: "Дріп · Ефіопія Сідамо",
    category: "drip",
    origin: "Сідамо, Ефіопія",
    country: "Ефіопія",
    region: "Сідамо",
    process: "Натуральна",
    roasts: ["Фільтр"],
    notes: ["Полуниця", "Чорний чай", "Мед"],
    shortDescription: "Наш Сідамо у зручних пакетиках — залий окропом.",
    story:
      "Той самий лот з Сідамо, помелений під занурювання й запакований у дріп-пакети. Ідеально в дорогу, на роботу або для щоденного ранку без турки чи V60. Один пакет — 12 г кави, вистачає на чашку 200 мл.",
    meters: { acidity: 4, sweetness: 4, bitterness: 2 },
    weights: [
      { label: "6 шт", grams: 72, price: 280 },
      { label: "12 шт", grams: 144, price: 520 },
    ],
    gallery: [
      "radial-gradient(ellipse at 35% 40%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
      "radial-gradient(ellipse at 55% 55%, #D19E6E 0%, #8A4F2A 65%, #3A1F10 100%)",
    ],
    badge: "Новий",
    inStock: true,
  },
  {
    slug: "drip-house-blend",
    name: "Дріп · House Blend",
    category: "drip",
    origin: "Бразилія + Ефіопія",
    country: "Купаж",
    region: "Бленд",
    process: "Бленд",
    roasts: ["Універсальна"],
    notes: ["Молочний шоколад", "Лісовий горіх", "Родзинки"],
    shortDescription: "Домашній бленд у форматі дрипу — щодня простіше.",
    story:
      "House Blend в зручному форматі — для офісу, подорожей, ранкової гіпертрофії у черзі. М'який, збалансований профіль, якому не потрібне обладнання — тільки окріп і хвилина часу.",
    meters: { acidity: 3, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "6 шт", grams: 72, price: 240 },
      { label: "12 шт", grams: 144, price: 450 },
      { label: "24 шт", grams: 288, price: 830 },
    ],
    gallery: [
      "radial-gradient(ellipse at 50% 45%, #A87B58 0%, #5A3A24 65%, #241410 100%)",
      "radial-gradient(ellipse at 40% 55%, #9C7050 0%, #4E3020 70%, #1A0E08 100%)",
    ],
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Капсули — Nespresso-сумісний формат для домашніх капсульних машин.
  // ---------------------------------------------------------------------------
  {
    slug: "capsules-house-blend",
    name: "Капсули · House Blend",
    category: "capsules",
    origin: "Бразилія + Ефіопія",
    country: "Купаж",
    region: "Бленд",
    process: "Бленд",
    roasts: ["Еспресо"],
    notes: ["Молочний шоколад", "Лісовий горіх", "Карамель"],
    shortDescription: "Nespresso-сумісні капсули з нашого House Blend.",
    story:
      "Свіжообсмажена House Blend у форматі капсул Nespresso Original. Щільне тіло, тонка крема, баланс шоколаду й горіха. Сумісно з більшістю побутових капсульних машин — Krups, De'Longhi, Magimix.",
    meters: { acidity: 3, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "10 капсул", grams: 55, price: 320 },
      { label: "20 капсул", grams: 110, price: 610 },
    ],
    gallery: [
      "radial-gradient(ellipse at 45% 45%, #8A5E3E 0%, #4A2C18 70%, #1A0E08 100%)",
      "radial-gradient(ellipse at 55% 50%, #735036 0%, #3D2414 70%, #140A06 100%)",
    ],
    badge: "Новий",
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Мелена кава — ті самі лоти, але змелені наперед під конкретний метод.
  // ---------------------------------------------------------------------------
  {
    slug: "ground-house-blend",
    name: "Мелена · House Blend N°1",
    category: "ground",
    origin: "Бразилія + Ефіопія",
    country: "Купаж",
    region: "Бленд",
    process: "Бленд",
    roasts: ["Універсальна"],
    notes: ["Молочний шоколад", "Лісовий горіх", "Родзинки"],
    shortDescription: "House Blend у середньому помелі — під турку й дрип.",
    story:
      "Наш основний бленд, змелений під середній помел — підходить для турки, мока-поту й фільтр-кавоварок. Пакет з клапаном утримує аромат два тижні.",
    meters: { acidity: 3, sweetness: 4, bitterness: 3 },
    weights: [
      { label: "250 г", grams: 250, price: 350 },
      { label: "500 г", grams: 500, price: 660 },
    ],
    grinds: ["V60", "Moka", "French Press"],
    gallery: [
      "radial-gradient(ellipse at 45% 50%, #B58B65 0%, #6B4429 65%, #2A180E 100%)",
      "radial-gradient(ellipse at 55% 45%, #A17A56 0%, #5A3A24 70%, #20120A 100%)",
    ],
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Аксесуари — дрипери, ваги, чайники. Кавові поля (origin / notes) не мають
  // сенсу для hardware, тому їх просто немає у товарі.
  // ---------------------------------------------------------------------------
  {
    slug: "gear-v60-02",
    name: "Hario V60-02 · кераміка",
    category: "gear",
    shortDescription: "Класичний дрипер з ребристою стінкою — 1 – 4 чашки.",
    story:
      "Hario V60 — еталонний конусний дрипер. Керамічна версія тримає температуру рівномірно, спіральні ребра всередині створюють повітряну прошарку й дають воді проходити з правильною швидкістю. Розмір 02 — на 1 – 4 чашки.",
    weights: [{ label: "1 шт", grams: 1, price: 890 }],
    gallery: [
      "radial-gradient(ellipse at 45% 45%, #E8E4DC 0%, #B8B1A4 55%, #7A7468 100%)",
      "radial-gradient(ellipse at 55% 55%, #D4CFC4 0%, #9C9486 60%, #524C42 100%)",
    ],
    inStock: true,
  },
  {
    slug: "gear-pour-over-kettle",
    name: "Чайник гусяче-шийний · 1 л",
    category: "gear",
    shortDescription: "Тонкий носик для контрольованого проливу на дрипері.",
    story:
      "Металевий чайник з довгим тонким носиком — для точного проливу на V60, Chemex чи Kalita Wave. Місткість 1 л, нержавіюча сталь, матове покриття. Підходить для індукції та газу.",
    weights: [{ label: "1 шт", grams: 1, price: 1490 }],
    gallery: [
      "radial-gradient(ellipse at 40% 40%, #D8D3CA 0%, #8B867D 55%, #3E3A34 100%)",
      "radial-gradient(ellipse at 55% 50%, #C2BCB2 0%, #6E695F 65%, #2E2A24 100%)",
    ],
    badge: "Новий",
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Млинки — ручні й електричні.
  // ---------------------------------------------------------------------------
  {
    slug: "grinder-1zpresso-jx",
    name: "1zpresso JX · ручний млинок",
    category: "grinders",
    shortDescription: "48-мм конічні жорна, діапазон помелу V60 – Еспресо.",
    story:
      "Флагманський ручний млинок 1zpresso JX з конічними жорнами 48 мм зі сталі S2. Точність регулювання — 25 мкм на клік, діапазон від турки до еспресо. Бункер на 35 г, алюмінієвий корпус.",
    weights: [{ label: "1 шт", grams: 1, price: 6490 }],
    gallery: [
      "radial-gradient(ellipse at 45% 50%, #D8D3CA 0%, #8B867D 55%, #3E3A34 100%)",
      "radial-gradient(ellipse at 55% 45%, #B8B3A9 0%, #6E695F 65%, #2E2A24 100%)",
    ],
    badge: "Bestseller",
    inStock: true,
  },
  // ---------------------------------------------------------------------------
  // Подарункові набори — готові комбінації для подарунку.
  // ---------------------------------------------------------------------------
  {
    slug: "gift-starter-kit",
    name: "Стартер-сет · зерна + дрипер",
    category: "gifts",
    shortDescription: "Усе для першої чашки: дрипер V60, фільтри, 250 г кави.",
    story:
      "Ідеальний подарунок для того, хто починає варити каву вдома. У коробці: керамічний дрипер V60-02, пакет паперових фільтрів, 250 г свіжої кави на вибір і наша коротка памʼятка з рецептом. Усе спаковано у крафтову подарункову коробку.",
    weights: [{ label: "1 сет", grams: 1, price: 1290 }],
    gallery: [
      "radial-gradient(ellipse at 45% 45%, #F3D9C5 0%, #C78871 55%, #7A4432 100%)",
      "radial-gradient(ellipse at 55% 55%, #E5C5AB 0%, #B47555 60%, #5E321E 100%)",
    ],
    badge: "Limited",
    inStock: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAllProducts(): Product[] {
  return PRODUCTS;
}

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: CategoryKey): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}

export function getBestsellers(limit = 6): Product[] {
  // Homepage strip uses beans only — drip/capsules have their own merch space
  // elsewhere in the future.
  return PRODUCTS.filter(
    (p) => p.category === "beans" && (p.badge === "Bestseller" || p.badge === "Новий"),
  ).slice(0, limit);
}

/** Lowest price across weights — for display "від 340 ₴" if we ever need it. */
export function getStartingPrice(product: Product): number {
  return Math.min(...product.weights.map((w) => w.price));
}
