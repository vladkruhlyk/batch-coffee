import { defineField, defineType } from "sanity";

/**
 * Singleton document — global site config. Logo, default SEO, contacts,
 * social links. There should be exactly ONE of these in the dataset;
 * the desk structure enforces that via a single editor entry.
 */
export const siteSettings = defineType({
  name: "siteSettings",
  title: "Налаштування сайту",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Назва сайту",
      type: "string",
      initialValue: "BATCH Coffee Roastery",
    }),
    defineField({
      name: "description",
      title: "Опис сайту (для SEO)",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "logoBlack",
      title: "Логотип темний",
      type: "image",
    }),
    defineField({
      name: "logoWhite",
      title: "Логотип білий",
      type: "image",
    }),
    defineField({
      name: "favicon",
      title: "Favicon",
      type: "image",
    }),
    defineField({
      name: "ogImage",
      title: "OG-зображення",
      type: "image",
      description: "Картинка для шерінгу у соцмережах (1200×630).",
    }),
    defineField({
      name: "visitPhoto",
      title: "Фото кав'ярні",
      type: "image",
      options: { hotspot: true },
      description:
        "Показується у секції «Кав'ярня» на сторінці /visit. Бажано горизонтальне (16:11).",
    }),

    defineField({
      name: "contactPhone",
      title: "Телефон",
      type: "string",
    }),
    defineField({
      name: "contactEmail",
      title: "Email",
      type: "string",
    }),
    defineField({
      name: "address",
      title: "Адреса",
      type: "string",
    }),
    defineField({
      name: "hours",
      title: "Графік роботи",
      type: "string",
    }),

    defineField({
      name: "instagram",
      title: "Instagram URL",
      type: "url",
    }),
    defineField({
      name: "telegram",
      title: "Telegram URL",
      type: "url",
    }),
    defineField({
      name: "facebook",
      title: "Facebook URL",
      type: "url",
    }),

    defineField({
      name: "promoBarText",
      title: "Текст промо-смужки зверху",
      type: "string",
      description: "Залиш порожнім щоб сховати.",
    }),
  ],
  preview: {
    prepare: () => ({ title: "Налаштування сайту" }),
  },
});
