import { defineField, defineType } from "sanity";

/**
 * Homepage category tile. Lives separately from the `product.category`
 * enum because the tile is a display object with colours and an explicit
 * URL — sometimes pointing outside `/shop` (e.g. the "Підписка" tile
 * goes to /subscription, not /shop?category=subscription).
 */
export const category = defineType({
  name: "category",
  title: "Категорії на головній",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Назва",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "href",
      title: "Куди веде",
      type: "string",
      description: "Напр. /shop?category=beans або /subscription",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "gradient",
      title: "Градієнт тла",
      type: "string",
      description:
        "CSS-градієнт. Напр. radial-gradient(ellipse at 35% 40%, #F2E2CE 0%, #D9B689 55%, #9E7148 100%)",
    }),
    defineField({
      name: "image",
      title: "Фото (опційно)",
      type: "image",
      options: { hotspot: true },
      description: "Якщо вибрано — замінює градієнт.",
    }),
    defineField({
      name: "order",
      title: "Порядок",
      type: "number",
      initialValue: 10,
    }),
    defineField({
      name: "visible",
      title: "Опублікована",
      type: "boolean",
      initialValue: true,
    }),
  ],
  orderings: [
    {
      title: "За порядком",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: { select: { title: "title", subtitle: "href", media: "image" } },
});
