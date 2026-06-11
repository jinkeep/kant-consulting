import { readFileSync } from "node:fs";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export type CustomProviderType = "anthropic" | "anthropic-compatible";

export interface CustomModel {
  id: string;
  label: string;
}

export interface CustomProvider {
  name: string;
  type: CustomProviderType;
  label: string;
  base_url?: string;
  api_key: string;
  models: CustomModel[];
}

interface ProvidersFile {
  providers: CustomProvider[];
}

let cache: CustomProvider[] | null = null;

function loadProvidersFromDisk(): CustomProvider[] {
  const inline = process.env.CUSTOM_PROVIDERS_JSON;
  if (inline) {
    const parsed = JSON.parse(inline) as ProvidersFile;
    if (!parsed?.providers?.length) {
      throw new Error("CUSTOM_PROVIDERS_JSON 中没有任何 provider");
    }
    return parsed.providers;
  }

  const path = process.env.CUSTOM_PROVIDERS_PATH;
  if (!path) {
    throw new Error(
      "CUSTOM_PROVIDERS_JSON 或 CUSTOM_PROVIDERS_PATH 必须配置一个"
    );
  }
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as ProvidersFile;
  if (!parsed?.providers?.length) {
    throw new Error(`custom_providers.json 中没有任何 provider: ${path}`);
  }
  return parsed.providers;
}

export function getProviders(): CustomProvider[] {
  if (!cache) cache = loadProvidersFromDisk();
  return cache;
}

export function findProvider(name: string): CustomProvider {
  const p = getProviders().find((x) => x.name === name);
  if (!p) throw new Error(`未知 provider: ${name}`);
  return p;
}

export function resolveModel(providerName: string, modelId: string): LanguageModel {
  const provider = findProvider(providerName);
  if (!provider.models.some((m) => m.id === modelId)) {
    throw new Error(`provider ${providerName} 不支持 model: ${modelId}`);
  }

  switch (provider.type) {
    case "anthropic":
    case "anthropic-compatible": {
      const baseURL = provider.base_url
        ? provider.base_url.replace(/\/+$/, "") + "/v1"
        : undefined;
      const anthropic = createAnthropic({
        apiKey: provider.api_key,
        baseURL,
      });
      return anthropic(modelId);
    }
    default:
      throw new Error(`暂不支持的 provider type: ${provider.type}`);
  }
}

export function listPublicProviders() {
  return getProviders().map((p) => ({
    name: p.name,
    label: p.label,
    models: p.models,
  }));
}

export function getDefaults() {
  return {
    provider: process.env.DEFAULT_PROVIDER ?? getProviders()[0].name,
    model:
      process.env.DEFAULT_MODEL ?? getProviders()[0].models[0].id,
  };
}
