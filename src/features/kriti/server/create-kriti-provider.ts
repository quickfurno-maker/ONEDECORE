import type { KritiServerEnv } from "./kriti-env.ts";
import { createKritiFakeProvider } from "../providers/kriti-fake-provider.ts";
import { createKritiGroqProvider } from "../providers/kriti-groq-provider.ts";
import type { KritiInferenceProvider } from "../providers/kriti-inference-provider.ts";

export function createKritiInferenceProvider(env: KritiServerEnv): KritiInferenceProvider | null {
  if (env.mode === "disabled") {
    return null;
  }
  if (env.mode === "local-test") {
    return createKritiFakeProvider();
  }
  return createKritiGroqProvider(env);
}
