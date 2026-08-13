// R2 adapter for the ReportWriter seam: Reports land as Markdown
// objects in a private R2 bucket, one flat namespace — status lives on
// each Report's GitHub issue, not in folder structure. Mac-side triage
// pulls them with `wrangler r2 object get` (see
// docs/cloudflare-migration/spec.md). They stay out of git because
// Snippets can contain personal task text; only sanitized issue bodies
// go public.

import type { R2Bucket } from "@cloudflare/workers-types";
import type { ReportWriter } from "./reports";

export const createR2ReportWriter = (bucket: R2Bucket): ReportWriter => ({
  save: async (fileName, markdown) => {
    // De-collide: same-minute reports get a numeric suffix.
    let name = fileName;
    for (let i = 2; (await bucket.head(name)) !== null; i++) {
      name = fileName.replace(/\.md$/, `-${i}.md`);
    }
    await bucket.put(name, markdown);
    return name;
  },
  update: async (fileName, markdown) => {
    await bucket.put(fileName, markdown);
  },
});
