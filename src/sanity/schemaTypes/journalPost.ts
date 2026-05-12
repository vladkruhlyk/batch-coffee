import { defineField, defineType } from "sanity";

/**
 * Journal article. Body uses Portable Text (Sanity's structured rich text)
 * — gives editors headings, quotes, lists, inline images, links etc.
 * without raw HTML or markdown. The renderer at /journal/[slug] maps each
 * block kind to a styled component.
 */
export const journalPost = defineType({
  name: "journalPost",
  title: "Журнал",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Заголовок",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "URL",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Категорія",
      type: "string",
      description: "Напр. «Brew Guide», «Історії ферм», «Основи»",
    }),
    defineField({
      name: "excerpt",
      title: "Анонс (1-2 речення)",
      type: "text",
      rows: 2,
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: "publishedAt",
      title: "Дата публікації",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "readTime",
      title: "Час читання",
      type: "string",
      description: "Напр. «6 хв»",
    }),
    defineField({
      name: "author",
      title: "Автор",
      type: "string",
    }),
    defineField({
      name: "coverImage",
      title: "Обкладинка",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({ name: "alt", title: "Alt-текст", type: "string" }),
      ],
    }),
    defineField({
      name: "coverGradient",
      title: "Резервний градієнт",
      type: "string",
      description: "Якщо обкладинки нема — буде показано градієнт.",
    }),
    defineField({
      name: "body",
      title: "Текст статті",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "Звичайний", value: "normal" },
            { title: "Підзаголовок", value: "h2" },
            { title: "Цитата", value: "blockquote" },
          ],
          lists: [
            { title: "Маркір", value: "bullet" },
            { title: "Нумерований", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Жирний", value: "strong" },
              { title: "Курсив", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Посилання",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "URL",
                  },
                ],
              },
            ],
          },
        },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({ name: "alt", title: "Alt-текст", type: "string" }),
            defineField({ name: "caption", title: "Підпис", type: "string" }),
          ],
        },
      ],
    }),
    defineField({
      name: "related",
      title: "Повʼязані статті",
      type: "array",
      of: [{ type: "reference", to: [{ type: "journalPost" }] }],
      validation: (rule) => rule.max(3),
    }),
  ],
  orderings: [
    {
      title: "Нові перші",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "category", media: "coverImage" },
  },
});
