import { defineField, defineType } from "sanity";

/**
 * Promo code — managed entirely from Studio so the roaster can create,
 * disable, and schedule discounts without a code change or redeploy.
 *
 * The discount is ALWAYS recomputed server-side (api/orders/create) from
 * this document + the server's own subtotal, so nothing the customer's
 * browser sends can change the real charge. The client only uses these
 * fields to preview the discount in the cart/checkout summary.
 */
export const promoCode = defineType({
  name: "promoCode",
  title: "Промокоди",
  type: "document",
  fields: [
    defineField({
      name: "code",
      title: "Код",
      type: "string",
      description:
        "Те, що вводить клієнт. Напр. BATCH10. Регістр не важливий — knew10 = KNEW10.",
      validation: (rule) =>
        rule
          .required()
          .custom((value) =>
            value && /\s/.test(value)
              ? "Код не може містити пробіли"
              : true,
          ),
    }),
    defineField({
      name: "discountType",
      title: "Тип знижки",
      type: "string",
      options: {
        list: [
          { title: "Відсоток (%)", value: "percent" },
          { title: "Фіксована сума (₴)", value: "fixed" },
        ],
        layout: "radio",
      },
      initialValue: "percent",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "discountValue",
      title: "Розмір знижки",
      type: "number",
      description:
        "Для відсотка: 10 означає −10%. Для фіксованої суми: 100 означає −100 ₴.",
      validation: (rule) =>
        rule
          .required()
          .positive()
          .custom((value, context) => {
            const type = (context.parent as { discountType?: string })
              ?.discountType;
            if (type === "percent" && typeof value === "number" && value > 100) {
              return "Відсоток не може бути більшим за 100";
            }
            return true;
          }),
    }),
    defineField({
      name: "active",
      title: "Активний",
      type: "boolean",
      description: "Вимкни, щоб тимчасово прибрати код без видалення.",
      initialValue: true,
    }),
    defineField({
      name: "startsAt",
      title: "Діє з (опційно)",
      type: "datetime",
      description: "Якщо порожнє — діє одразу.",
    }),
    defineField({
      name: "expiresAt",
      title: "Діє до (опційно)",
      type: "datetime",
      description: "Якщо порожнє — діє безстроково.",
    }),
    defineField({
      name: "minSubtotal",
      title: "Мін. сума товарів (опційно)",
      type: "number",
      description:
        "Знижка діє лише якщо сума товарів у кошику ≥ цього значення (у ₴).",
      validation: (rule) => rule.positive(),
    }),
    defineField({
      name: "note",
      title: "Нотатка для себе (опційно)",
      type: "string",
      description: "Не показується клієнтам. Напр. «Розсилка лютий».",
    }),
  ],
  preview: {
    select: {
      code: "code",
      type: "discountType",
      value: "discountValue",
      active: "active",
    },
    prepare({ code, type, value, active }) {
      const amount = type === "fixed" ? `−${value ?? 0} ₴` : `−${value ?? 0}%`;
      return {
        title: code ?? "—",
        subtitle: `${active ? "✅ активний" : "⛔ вимкнено"} · ${amount}`,
      };
    },
  },
});
