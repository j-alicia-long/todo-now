import webConfig from "@j-alicia-long/web-config/eslint";

export default [
  { ignores: ["dist", "node_modules", "public"] },
  ...webConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // Root index.tsx is the frontend entry-point shim, not a grouping barrel
    files: ["index.tsx"],
    rules: { "check-file/filename-blocklist": "off" },
  },
];
