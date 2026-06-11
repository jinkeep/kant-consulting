"use client";

import { useEffect, useState } from "react";

interface PublicModel {
  id: string;
  label: string;
}

interface PublicProvider {
  name: string;
  label: string;
  models: PublicModel[];
}

interface ModelsResponse {
  providers: PublicProvider[];
  defaults: { provider: string; model: string };
}

export interface ModelSelection {
  provider: string;
  model: string;
}

interface Props {
  value: ModelSelection | null;
  onChange: (next: ModelSelection) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const [data, setData] = useState<ModelsResponse | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json() as Promise<ModelsResponse>)
      .then((d) => {
        setData(d);
        if (!value && d.defaults) {
          onChange({ provider: d.defaults.provider, model: d.defaults.model });
        }
      })
      .catch(() => setData({ providers: [], defaults: { provider: "", model: "" } }));
  }, [onChange, value]);

  if (!data || data.providers.length === 0) return null;

  const current =
    value ?? { provider: data.defaults.provider, model: data.defaults.model };
  const provider = data.providers.find((p) => p.name === current.provider);

  return (
    <div className="flex items-center gap-2 font-mono text-xs text-kant-muted">
      <select
        className="border border-kant-line bg-kant-bg px-2 py-1"
        value={current.provider}
        onChange={(e) => {
          const next = data.providers.find((p) => p.name === e.target.value);
          if (!next) return;
          onChange({ provider: next.name, model: next.models[0].id });
        }}
      >
        {data.providers.map((p) => (
          <option key={p.name} value={p.name}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        className="border border-kant-line bg-kant-bg px-2 py-1"
        value={current.model}
        onChange={(e) => onChange({ provider: current.provider, model: e.target.value })}
      >
        {provider?.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
