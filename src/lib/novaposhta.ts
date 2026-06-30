/**
 * Nova Poshta (Нова Пошта) API client — server-only.
 *
 * We use it purely to LOOK UP cities + warehouses/postomats so the
 * customer can pick a pickup point at checkout. We do NOT create waybills
 * (TTN) — the merchant does that manually in the NP cabinet — and we do
 * NOT charge for delivery (the customer pays NP on pickup).
 *
 * The API key lives in NOVAPOSHTA_API_KEY and never reaches the browser:
 * the client calls our /api/novaposhta/* routes, which call this.
 *
 * API: POST https://api.novaposhta.ua/v2.0/json/ with
 *   { apiKey, modelName, calledMethod, methodProperties }
 */

const NP_ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

interface NpEnvelope<T> {
  success: boolean;
  data: T[];
  errors?: string[];
}

async function npCall<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<T[]> {
  const apiKey = process.env.NOVAPOSHTA_API_KEY;
  if (!apiKey) throw new Error("NOVAPOSHTA_API_KEY is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(NP_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
      signal: controller.signal,
    });
    const json = (await res.json()) as NpEnvelope<T>;
    if (!json.success) {
      throw new Error(json.errors?.join("; ") || "Nova Poshta API error");
    }
    return json.data ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export interface NpCity {
  ref: string;
  name: string;
  area: string;
}

export interface NpWarehouse {
  ref: string;
  number: string;
  description: string;
}

/** City autocomplete. Returns the city Ref used to look up warehouses. */
export async function searchCities(q: string): Promise<NpCity[]> {
  const query = (q ?? "").trim();
  if (query.length < 2) return [];
  const data = await npCall<{
    Ref: string;
    Description: string;
    AreaDescription: string;
  }>("Address", "getCities", { FindByString: query, Limit: "20" });
  return data.map((c) => ({
    ref: c.Ref,
    name: c.Description,
    area: c.AreaDescription,
  }));
}

/** Warehouses (branches) or postomats for a city, optionally filtered by a
 *  search string (number / street). */
export async function getWarehouses(
  cityRef: string,
  type: "branch" | "postomat",
  q?: string,
): Promise<NpWarehouse[]> {
  if (!cityRef) return [];
  const props: Record<string, unknown> = {
    CityRef: cityRef,
    Limit: "50",
    Page: "1",
  };
  const query = (q ?? "").trim();
  if (query) props.FindByString = query;

  const data = await npCall<{
    Ref: string;
    Number: string;
    Description: string;
    CategoryOfWarehouse: string;
  }>("Address", "getWarehouses", props);

  // NP categories: "Branch" (відділення), "Postomat", "DropOff" (partner
  // pickup points). For "відділення" we show only real Branch offices —
  // DropOff would confuse customers expecting a Nova Poshta office.
  const wanted = type === "postomat" ? "Postomat" : "Branch";

  return data
    .filter((w) => w.CategoryOfWarehouse === wanted)
    .map((w) => ({ ref: w.Ref, number: w.Number, description: w.Description }));
}
