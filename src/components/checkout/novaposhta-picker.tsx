"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface NpSelection {
  cityRef: string;
  cityName: string;
  warehouseRef: string;
  warehouseDescription: string;
}

interface City {
  ref: string;
  name: string;
  area: string;
}
interface Warehouse {
  ref: string;
  number: string;
  description: string;
}

/**
 * Nova Poshta city → branch/postomat picker for checkout.
 *
 * Two dependent autocompletes: type a city, pick it, then search the
 * branches/postomats in that city. Reports the full selection up via
 * onChange (null until both city + warehouse are chosen). All lookups go
 * through our /api/novaposhta/* proxy — the API key never reaches here.
 *
 * Mounted with a `key` per delivery type by the parent, so switching
 * branch↔postomat remounts it fresh — no stale warehouse state.
 */
export function NovaPoshtaPicker({
  type,
  onChange,
}: {
  type: "branch" | "postomat";
  onChange: (sel: NpSelection | null) => void;
}) {
  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [cityOpen, setCityOpen] = useState(false);

  const [whQuery, setWhQuery] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [whOpen, setWhOpen] = useState(false);
  const [whLoading, setWhLoading] = useState(false);

  const cityBoxRef = useRef<HTMLDivElement>(null);
  const whBoxRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node))
        setCityOpen(false);
      if (whBoxRef.current && !whBoxRef.current.contains(e.target as Node))
        setWhOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // City autocomplete (debounced). Skip while a city is already locked in.
  // All setState happens inside the timeout (async) — never synchronously
  // in the effect body — to satisfy React 19's set-state-in-effect rule.
  useEffect(() => {
    if (city) return;
    const q = cityQuery.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setCities([]);
        return;
      }
      fetch(`/api/novaposhta/cities?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setCities(d.cities ?? []))
        .catch(() => setCities([]));
    }, 250);
    return () => clearTimeout(t);
  }, [cityQuery, city]);

  // Warehouses for the selected city (debounced on the search box). City
  // clearing resets warehouses in resetCity(), so here we only need to
  // (re)load when a city is set — and again, setState lives in the timeout.
  useEffect(() => {
    if (!city) return;
    const t = setTimeout(() => {
      setWhLoading(true);
      const params = new URLSearchParams({
        cityRef: city.ref,
        type,
        q: whQuery.trim(),
      });
      fetch(`/api/novaposhta/warehouses?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setWarehouses(d.warehouses ?? []))
        .catch(() => setWarehouses([]))
        .finally(() => setWhLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [city, type, whQuery]);

  const pickCity = (c: City) => {
    setCity(c);
    setCityQuery(c.name);
    setCityOpen(false);
    setWarehouse(null);
    setWhQuery("");
    onChange(null);
  };

  const resetCity = () => {
    setCity(null);
    setCityQuery("");
    setCities([]);
    setWarehouse(null);
    setWarehouses([]);
    setWhQuery("");
    onChange(null);
  };

  const pickWarehouse = (w: Warehouse) => {
    setWarehouse(w);
    setWhQuery(w.description);
    setWhOpen(false);
    if (city) {
      onChange({
        cityRef: city.ref,
        cityName: city.name,
        warehouseRef: w.ref,
        warehouseDescription: w.description,
      });
    }
  };

  const inputCls =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-transparent px-4 py-3 text-sm outline-none focus:border-[var(--color-text-primary)] transition-colors";
  const listCls =
    "absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.25)]";
  const itemCls =
    "w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--color-bg-secondary)] transition-colors";

  const whLabel = type === "postomat" ? "Поштомат" : "Відділення";

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {/* City */}
      <div className="relative" ref={cityBoxRef}>
        <label className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] block mb-2">
          Місто
        </label>
        <input
          value={cityQuery}
          onChange={(e) => {
            if (city) resetCity();
            setCityQuery(e.target.value);
            setCityOpen(true);
          }}
          onFocus={() => setCityOpen(true)}
          placeholder="Почни вводити місто"
          className={inputCls}
        />
        {cityOpen && !city && cities.length > 0 && (
          <div className={listCls}>
            {cities.map((c) => (
              <button
                key={c.ref}
                type="button"
                onClick={() => pickCity(c)}
                className={itemCls}
              >
                {c.name}
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · {c.area} обл.
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse */}
      <div className="relative" ref={whBoxRef}>
        <label className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] block mb-2">
          {whLabel}
        </label>
        <input
          value={whQuery}
          disabled={!city}
          onChange={(e) => {
            if (warehouse) setWarehouse(null);
            setWhQuery(e.target.value);
            setWhOpen(true);
            onChange(null);
          }}
          onFocus={() => setWhOpen(true)}
          placeholder={
            city ? `Номер або адреса` : "Спочатку обери місто"
          }
          className={cn(inputCls, "disabled:opacity-50")}
        />
        {whOpen && city && (warehouses.length > 0 || whLoading) && (
          <div className={listCls}>
            {whLoading && warehouses.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                Завантаження…
              </p>
            ) : (
              warehouses.map((w) => (
                <button
                  key={w.ref}
                  type="button"
                  onClick={() => pickWarehouse(w)}
                  className={itemCls}
                >
                  {w.description}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
