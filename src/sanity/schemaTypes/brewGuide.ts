import { defineField, defineType } from "sanity";

export const brewGuide = defineType({
  name: "brewGuide",
  title: "Brew Guide",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Назва методу",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL (slug)",
      type: "slug",
      options: { source: "name", maxLength: 64 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "tagline",
      title: "Підпис під назвою",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "intro",
      title: "Вступ (параграф)",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "ratio",
      title: "Пропорція",
      type: "string",
      description: "Напр. 1 : 16",
    }),
    defineField({ name: "grind", title: "Помел", type: "string" }),
    defineField({
      name: "waterTemp",
      title: "Температура",
      type: "string",
      description: "Напр. 92 °C",
    }),
    defineField({
      name: "totalTime",
      title: "Загальний час",
      type: "string",
    }),
    defineField({
      name: "gradient",
      title: "Градієнт-плейсхолдер",
      type: "string",
    }),
    defineField({
      name: "image",
      title: "Фото (опційно)",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "steps",
      title: "Кроки рецепта",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "time", title: "Час", type: "string" }),
            defineField({
              name: "title",
              title: "Назва кроку",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "body",
              title: "Опис",
              type: "text",
              rows: 3,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "time" },
          },
        },
      ],
    }),
    defineField({
      name: "tips",
      title: "Поради",
      type: "array",
      of: [{ type: "text", rows: 2 }],
    }),
    defineField({
      name: "order",
      title: "Порядок у списку",
      type: "number",
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
    select: { title: "name", subtitle: "tagline", media: "image" },
  },
});
