import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Style convention: always use arrow functions
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
    },
  },
  prettier
);
