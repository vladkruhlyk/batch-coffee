import type { StructureResolver } from "sanity/structure";

/**
 * Desk structure — controls how the left sidebar in Studio is organised.
 *
 * Singleton documents (e.g. siteSettings) are surfaced as a single
 * editor entry rather than a list. Order matters: most-used content
 * (Products, Banners) sits at the top.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Контент")
    .items([
      S.listItem()
        .title("Товари")
        .child(S.documentTypeList("product").title("Товари")),
      S.divider(),
      S.listItem()
        .title("Банери на головній")
        .child(
          S.documentTypeList("banner")
            .title("Банери на головній")
            .defaultOrdering([{ field: "order", direction: "asc" }]),
        ),
      S.listItem()
        .title("Категорії")
        .child(
          S.documentTypeList("category")
            .title("Категорії на головній")
            .defaultOrdering([{ field: "order", direction: "asc" }]),
        ),
      S.divider(),
      S.listItem()
        .title("Журнал")
        .child(
          S.documentTypeList("journalPost")
            .title("Журнал")
            .defaultOrdering([
              { field: "publishedAt", direction: "desc" },
            ]),
        ),
      S.listItem()
        .title("Brew Guide")
        .child(
          S.documentTypeList("brewGuide")
            .title("Brew Guide")
            .defaultOrdering([{ field: "order", direction: "asc" }]),
        ),
      S.divider(),
      // Singleton — single editable doc, not a list.
      S.listItem()
        .title("Налаштування сайту")
        .child(
          S.editor()
            .id("siteSettings")
            .schemaType("siteSettings")
            .documentId("siteSettings"),
        ),
    ]);
