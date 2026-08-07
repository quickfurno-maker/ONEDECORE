import { buildKritiPrompts } from "../safety/build-kriti-prompts.ts";
import { createNoOpKritiAuditSink } from "../audit/no-op-audit-sink.ts";
import { createKritiInferenceProvider } from "../server/create-kriti-provider.ts";
import { getKritiServerEnv } from "../server/kriti-env.ts";
import { runKritiTask, type KritiTaskRunnerDeps } from "../server/run-kriti-task.ts";
import type { KritiRequest } from "../contracts/context.ts";
import type { KritiResult } from "../contracts/result.ts";

export interface KritiRuntime {
  readonly run: (request: KritiRequest) => Promise<KritiResult>;
  readonly mode: ReturnType<typeof getKritiServerEnv>["mode"];
}

export function createKritiRuntime(
  env: Record<string, string | undefined> = process.env
): KritiRuntime {
  const serverEnv = getKritiServerEnv(env);
  const provider = createKritiInferenceProvider(serverEnv);
  const auditSink = createNoOpKritiAuditSink();
  const deps: KritiTaskRunnerDeps = {
    env: serverEnv,
    provider,
    buildPrompts: buildKritiPrompts,
    auditSink,
  };

  return {
    mode: serverEnv.mode,
    run: (request) => runKritiTask(request, deps),
  };
}
