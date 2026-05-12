import { defineField, defineType } from "sanity";

/**
 * Homepage banner — one slide of the hero carousel.
 *
 * Editors order slides by drag-and-drop in the desk's "Banner" list (we
 * use orderable list in `structure.ts`). The hero image is optional; if
 * absent, the splash mark + fallback colour kicks in.
 */
export const banner = defineType({
  name: "banner",
  title: "Банери на головній",
  type: "document",
  fields: [
    defineField({
      name: "slug",
      title: "Внутрішня назва (slug)",
      type: "slug",
      description: "Для впорядкування, не показується.",
      options: { source: "titleLine1", maxLength: 64 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "kicker",
      title: "Підпис зверху",
      type: "string",
      description: "Напр. «Новий лот · Весна 2026»",
    }),
    defineField({
      name: "titleLine1",
      title: "Заголовок (рядок 1)",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "titleLine2",
      title: "Заголовок (рядок 2)",
      type: "string",
      description: "Виводиться нижче, медіум-вагою.",
    }),
    defineField({
      name: "copy",
      title: "Опис",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "ctaLabel",
      title: "Текст основної кнопки",
      type: "string",
    }),
    defineField({
      name: "ctaHref",
      title: "Куди веде основна кнопка",
      type: "string",
      description: "Напр. /shop/ethiopia-sidamo",
    }),
    defineField({
      name: "secondaryLabel",
      title: "Додаткове посилання (текст)",
      type: "string",
    }),
    defineField({
      name: "secondaryHref",
      title: "Додаткове посилання (URL)",
      type: "string",
    }),
    defineField({
      name: "badge",
      title: "Бейдж зверху-зліва",
      type: "string",
      description: "Напр. «Новий лот · 420 ₴»",
    }),
    defineField({
      name: "image",
      title: "Фото",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({ name: "alt", title: "Alt-текст", type: "string" }),
      ],
      description: "Якщо порожнє — рендериться градієнт + splash mark.",
    }),
    defineField({
      name: "markTint",
      title: "Колір splash mark",
      type: "string",
      description: "HEX. Напр. #8A4A26. Використовується коли фото немає.",
    }),
    defineField({
      name: "fallbackBg",
      title: "Резервний колір тла",
      type: "string",
      description: "HEX. Тло поки фото відсутнє.",
    }),
    defineField({
      name: "visible",
      title: "Опублікований",
      type: "boolean",
      initialValue: true,
      description: "Зніми галку щоб тимчасово сховати без видалення.",
    }),
    defineField({
      name: "order",
      title: "Порядок",
      type: "number",
      description: "Менше число — раніше у слайдері. 10, 20, 30…",
      initialValue: 10,
    }),
  ],
  orderings: [
    {
      title: "За порядком",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "titleLine1",
      subtitle: "titleLine2",
      media: "image",
    },
  },
});
