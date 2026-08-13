// Cloudflare Workers entry point: composes the runtime-agnostic app
// (src/server/app.ts) with the Workers adapters — D1 stores, the R2
// report writer, and GitHub issue filing via fetch — and exports the
// fetch handler. Bindings arrive per-request through env (Workers has
// no process.env); the composed app is memoized since bindings are
// stable for the isolate's lifetime.
//
// Static serving: the assets binding (wrangler.jsonc) serves the built
// frontend with SPA fallback; the Worker only runs first for /api/*,
// "/", and /favicon.ico. Local dev runs this same Worker inside
// `vite dev` via @cloudflare/vite-plugin (Miniflare-simulated D1/R2).
//
// AI agents: read README.md for navigation and contribution guidance.

import type { Hono, ExecutionContext } from "hono";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createApp } from "./src/server/app";
import { createD1Stores } from "./src/server/d1";
import { createR2ReportWriter } from "./src/server/r2";
import { createGitHubIssueCreator } from "./src/server/github";

export type WorkerEnv = {
  DB: D1Database;
  REPORTS: R2Bucket;
  /** Issue-filing target repo; unset disables filing. */
  REPORTS_REPO?: string;
  /** Workers secret; absent in local dev, so filing is a no-op there. */
  GITHUB_TOKEN?: string;
};

let app: Hono | null = null;

const composeApp = (env: WorkerEnv): Hono =>
  createApp({
    ...createD1Stores(env.DB),
    reportsWriter: createR2ReportWriter(env.REPORTS),
    issueCreator: createGitHubIssueCreator(
      env.REPORTS_REPO ?? null,
      env.GITHUB_TOKEN ?? null
    ),
  });

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    app ??= composeApp(env);
    return app.fetch(request, env, ctx);
  },
};
