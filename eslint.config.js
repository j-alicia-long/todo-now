import webConfig from "@j-alicia-long/web-config/eslint";

export default [
  { ignores: ["dist", "node_modules", "public"] },
  ...webConfig({ tsconfigRootDir: import.meta.dirname }),
];
