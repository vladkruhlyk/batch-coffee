import { defineField, defineType } from "sanity";

/**
 * Product schema — mirrors the `Product` interface in `data/products.ts`.
 *
 * Coffee-only fields (origin, process, brewing, taste meters) live inside
 * the same document but are marked optional. The editor sees them all, but
 * for non-coffee categories (gear, gifts, grinders) we just leave them
 * empty; the rendering side already branches on their presence.
 */
export const product = defineType({
  name: "product",
  title: "Товари",
  type: "document",
  groups: [
    { name: "main", title: "Основне", default: true },
    { name: "origin", title: "Походження" },
    { name: "taste", title: "Смак" },
    { name: "variants", title: "Варіанти" },
    { name: "brewing", title: "Рецепти" },
    { name: "media", title: "Фото" },
  ],
  fields: [
    defineField({
      name: "name",
      title: "Назва",
      type: "string",
      group: "main",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL",
      type: "slug",
      group: "main",
      description:
        "Адреса сторінки товару, наприклад /shop/ethiopia-sidamo. Краще латиницею через дефіси.",
      options: { source: "name", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Категорія",
      type: "string",
      group: "main",
      options: {
        list: [
          { title: "Кава в зернах", value: "beans" },
          { title: "Дріп-пакети", value: "drip" },
          { title: "Капсули", value: "capsules" },
          { title: "Аксесуари", value: "gear" },
          { title: "Млинки", value: "grinders" },
          { title: "Подарункові сети", value: "gifts" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "shortDescription",
      title: "Короткий опис",
      type: "string",
      group: "main",
      description: "Один рядок під назвою на картці.",
      validation: (rule) => rule.required().max(120),
    }),
    defineField({
      name: "story",
      title: "Опис на сторінці товару",
      type: "text",
      rows: 5,
      group: "main",
    }),
    defineField({
      name: "badge",
      title: "Бейдж",
      type: "string",
      group: "main",
      description:
        "Будь-який текст на картці: Новий, Bestseller, Funky, Legendary Lot тощо. Залиш порожнім — і бейджа не буде.",
    }),
    defineField({
      name: "inStock",
      title: "В наявності",
      type: "boolean",
      group: "main",
      initialValue: true,
    }),

    // --- Origin ---
    defineField({
      name: "origin",
      title: "Походження (короткий текст)",
      type: "string",
      group: "origin",
      description: "Напр. «Сідамо, Ефіопія» — для хлібних крихт.",
    }),
    defineField({
      name: "country",
      title: "Країна",
      type: "string",
      group: "origin",
    }),
    defineField({
      name: "region",
      title: "Регіон",
      type: "string",
      group: "origin",
    }),
    defineField({
      name: "process",
      title: "Обробка",
      type: "string",
      group: "origin",
      description:
        "Будь-який текст: Мита, Натуральна, Хані, Натуральна анаеробна, Мита + Термал шок тощо.",
    }),
    defineField({
      name: "altitude",
      title: "Висота",
      type: "string",
      group: "origin",
      description: "Напр. «1 950 м»",
    }),
    defineField({
      name: "varietal",
      title: "Сорт",
      type: "string",
      group: "origin",
      description: "Heirloom, Bourbon, Caturra…",
    }),
    defineField({
      name: "farm",
      title: "Ферма",
      type: "string",
      group: "origin",
    }),
    defineField({
      name: "harvest",
      title: "Збір",
      type: "string",
      group: "origin",
      description: "Напр. «Січень 2026»",
    }),

    // --- Taste ---
    defineField({
      name: "notes",
      title: "Смакові ноти",
      type: "array",
      of: [{ type: "string" }],
      group: "taste",
      validation: (rule) => rule.max(5),
      description: "Не більше 5 — на картці поміщається до трьох.",
    }),
    defineField({
      name: "meters",
      title: "Інтенсивність (1-5)",
      type: "object",
      group: "taste",
      fields: [
        defineField({
          name: "acidity",
          title: "Кислотність",
          type: "number",
          validation: (rule) => rule.min(1).max(5),
        }),
        defineField({
          name: "sweetness",
          title: "Солодкість",
          type: "number",
          validation: (rule) => rule.min(1).max(5),
        }),
        defineField({
          name: "bitterness",
          title: "Гіркота",
          type: "number",
          validation: (rule) => rule.min(1).max(5),
        }),
      ],
    }),
    defineField({
      name: "roasts",
      title: "Профілі обсмажки",
      type: "array",
      of: [{ type: "string" }],
      group: "taste",
      options: { layout: "tags" },
      description:
        "Додавай свої значення (Enter після кожного): Фільтр, Еспресо, Універсальна тощо.",
    }),
    defineField({
      name: "grinds",
      title: "Опції помелу",
      type: "array",
      of: [{ type: "string" }],
      group: "taste",
      options: { layout: "tags" },
      description:
        "Додавай будь-які помоли (Enter після кожного): Не молоти, Еспресо, V60, Джезва, Гейзерна, Батч Брю тощо.",
    }),

    // --- Variants ---
    defineField({
      name: "weights",
      title: "Варіанти ваги і ціни",
      type: "array",
      group: "variants",
      validation: (rule) => rule.required().min(1),
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "label",
              title: "Лейбл",
              type: "string",
              description: "Напр. «250 г» або «6 шт»",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "grams",
              title: "Грамів",
              type: "number",
              description: "Сирі грами — для сортування.",
              validation: (rule) => rule.required().min(1),
            }),
            defineField({
              name: "price",
              title: "Ціна, ₴",
              type: "number",
              validation: (rule) => rule.required().min(0),
            }),
            defineField({
              name: "wholesalePrice",
              title: "Гуртова ціна, ₴",
              type: "number",
              description:
                "Опціонально. Якщо задано на варіанті 1 кг — застосовується при замовленні від 3 кг цього SKU замість авто-знижки 15%.",
              validation: (rule) => rule.min(0),
            }),
          ],
          preview: {
            select: { label: "label", price: "price" },
            prepare: ({ label, price }) => ({
              title: label,
              subtitle: price ? `${price} ₴` : undefined,
            }),
          },
        },
      ],
    }),

    // --- Brewing ---
    defineField({
      name: "brewing",
      title: "Способи приготування",
      type: "array",
      group: "brewing",
      description:
        "Рекомендовані методи із параметрами. Перший — найрекомендованіший.",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "method",
              title: "Метод",
              type: "string",
              description:
                "Будь-який метод: Еспресо, V60, Аеропрес, Кемекс, Джезва тощо.",
              validation: (rule) => rule.required(),
            }),
            defineField({ name: "ratio", title: "Пропорція", type: "string" }),
            defineField({ name: "grind", title: "Помел", type: "string" }),
            defineField({
              name: "waterTemp",
              title: "Температура, °C",
              type: "number",
            }),
            defineField({ name: "time", title: "Час", type: "string" }),
            defineField({ name: "tip", title: "Порада", type: "text", rows: 2 }),
          ],
          preview: {
            select: { method: "method", ratio: "ratio" },
            prepare: ({ method, ratio }) => ({
              title: method,
              subtitle: ratio,
            }),
          },
        },
      ],
    }),

    // --- Media ---
    defineField({
      name: "gallery",
      title: "Галерея",
      type: "array",
      group: "media",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Alt-текст",
              type: "string",
              description: "Опис для accessibility / SEO.",
            }),
          ],
        },
      ],
      description:
        "Перше зображення — головне (картка, hero). Решта — на сторінці товару.",
    }),
    defineField({
      name: "fallbackGradient",
      title: "Резервний градієнт",
      type: "string",
      group: "media",
      description:
        "CSS-градієнт показується замість фото, поки галерея порожня. Напр. radial-gradient(ellipse at 35% 35%, #E8B888 0%, #B46A3D 55%, #6B3A1E 100%)",
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "shortDescription",
      media: "gallery.0",
    },
  },
});
