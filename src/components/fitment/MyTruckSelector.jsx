"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getStoredTruck,
  setStoredTruck,
  clearStoredTruck,
} from "@/lib/fitment/truck-storage";

/**
 * "My Truck" selector — the v1 differentiator (SRCH-03).
 *
 * A global, persistent Make -> Model cascade. The chosen truck is:
 *   1. saved to localStorage (follows the customer across visits), and
 *   2. pushed to the URL as ?truck_model=ID&truck_make=ID (preserving other
 *      params) so server-rendered listing/search pages (03-05) can filter and
 *      mark compatibility deterministically via search_products.
 *
 * Native <select> elements (SSR-safe, no select2 dependency). Selection is
 * client-only and hydrated AFTER mount to avoid an SSR hydration mismatch
 * (Pitfall 3): the server renders empty controls; the effect repopulates them
 * from the URL first (shareable links) then localStorage.
 *
 * Props:
 *   makes?: [{ id, name }]  — optional server-provided seed. When absent the
 *     component fetches /api/fitment/makes once on mount (HeaderTwo is a client
 *     component, so a server prop is awkward there).
 */
const MyTruckSelector = ({ makes: makesProp = null }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [makes, setMakes] = useState(makesProp ?? []);
  const [models, setModels] = useState([]);
  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [makeName, setMakeName] = useState("");
  const [modelName, setModelName] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Fetch the list of models for a make; returns the array so callers can
  // optionally pre-select a model after the list arrives.
  const loadModels = useCallback(async (id) => {
    if (!id) {
      setModels([]);
      return [];
    }
    try {
      const res = await fetch(`/api/fitment/models?make=${id}`);
      const { models: list } = await res.json();
      setModels(list ?? []);
      return list ?? [];
    } catch {
      setModels([]);
      return [];
    }
  }, []);

  // On mount: seed makes (prop or fetch), then hydrate the selection from the
  // URL (shareable link wins) or localStorage. Runs once, after hydration, so
  // the server-rendered empty controls never mismatch.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let makeList = makesProp;
      if (!makeList) {
        try {
          const res = await fetch("/api/fitment/makes");
          const data = await res.json();
          makeList = data.makes ?? [];
        } catch {
          makeList = [];
        }
      }
      if (cancelled) return;
      setMakes(makeList);

      // Prefer the URL (?truck_make / ?truck_model) so a shared link repopulates
      // the control; fall back to the persisted truck.
      const urlMake = searchParams.get("truck_make");
      const urlModel = searchParams.get("truck_model");
      const stored = getStoredTruck();

      const seedMakeId = urlMake ?? (stored ? String(stored.makeId) : "");
      const seedModelId = urlModel ?? (stored ? String(stored.modelId) : "");

      if (seedMakeId) {
        setMakeId(seedMakeId);
        const found = makeList.find((m) => String(m.id) === String(seedMakeId));
        if (found) setMakeName(found.name);
        const modelList = await loadModels(seedMakeId);
        if (cancelled) return;
        if (seedModelId) {
          setModelId(seedModelId);
          const fm = modelList.find(
            (m) => String(m.id) === String(seedModelId)
          );
          if (fm) setModelName(fm.name);
        }
      }
      setHydrated(true);
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push (or clear) the truck params on the URL, preserving everything else.
  const pushTruckParams = useCallback(
    (mId, mkId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mId) {
        params.set("truck_model", String(mId));
        if (mkId) params.set("truck_make", String(mkId));
      } else {
        params.delete("truck_model");
        params.delete("truck_make");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams]
  );

  const handleMakeChange = async (e) => {
    const id = e.target.value;
    const found = makes.find((m) => String(m.id) === String(id));
    setMakeId(id);
    setMakeName(found ? found.name : "");
    // Changing the make invalidates the model selection.
    setModelId("");
    setModelName("");
    await loadModels(id);
  };

  const handleModelChange = (e) => {
    const id = e.target.value;
    if (!id) {
      setModelId("");
      setModelName("");
      return;
    }
    const found = models.find((m) => String(m.id) === String(id));
    const mName = found ? found.name : "";
    setModelId(id);
    setModelName(mName);

    // A full truck is chosen: persist + reflect on the URL.
    setStoredTruck({
      makeId: Number(makeId),
      makeName,
      modelId: Number(id),
      modelName: mName,
    });
    pushTruckParams(id, makeId);
  };

  const handleClear = () => {
    clearStoredTruck();
    setMakeId("");
    setModelId("");
    setMakeName("");
    setModelName("");
    setModels([]);
    pushTruckParams(null, null);
  };

  const label =
    hydrated && modelId && makeName && modelName
      ? `Mi camión: ${makeName} ${modelName}`
      : null;

  return (
    <div className='my-truck-selector flex-align flex-wrap gap-8'>
      <span className='text-sm fw-medium text-heading d-none d-md-flex flex-align gap-4'>
        <i className='ph ph-truck' />
        Mi camión:
      </span>

      <select
        className='form-select form-select-sm w-auto'
        aria-label='Marca del camión'
        value={makeId}
        onChange={handleMakeChange}
        suppressHydrationWarning
      >
        <option value=''>Marca</option>
        {makes.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        className='form-select form-select-sm w-auto'
        aria-label='Modelo del camión'
        value={modelId}
        onChange={handleModelChange}
        disabled={!makeId || models.length === 0}
        suppressHydrationWarning
      >
        <option value=''>Modelo</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {hydrated && modelId ? (
        <button
          type='button'
          onClick={handleClear}
          className='btn btn-sm text-gray-500 hover-text-main-600 p-0 flex-align gap-4'
          aria-label='Quitar mi camión'
          title='Quitar mi camión'
        >
          <i className='ph ph-x-circle' />
        </button>
      ) : null}

      {label ? (
        <span className='text-sm text-main-600 fw-medium d-none d-lg-flex'>
          {label}
        </span>
      ) : null}
    </div>
  );
};

export default MyTruckSelector;
