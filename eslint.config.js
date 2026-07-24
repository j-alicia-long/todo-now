import js from "@eslint/js";
import tseslint from "typescript-eslint";
import checkFile from "eslint-plugin-check-file";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "check-file": checkFile },
    rules: {
      // Style convention: always use arrow functions (including default exports)
      "func-style": [
        "error",
        "expression",
        { overrides: { namedExports: "expression" } },
      ],
      "prefer-arrow-callback": "error",
      // Style convention: kebab-case filenames
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{ts,tsx,js,jsx}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  prettier
);
