export default {
  extends: ["@j-alicia-long/web-config/stylelint"],
  rules: {
    // TODO(jlong): migrate todo-base.scss raw colors to tokens, then re-error these
    "color-no-hex": [
      true,
      { severity: "warning", message: "Use design tokens from styles.scss" },
    ],
    "color-named": [
      "never",
      { severity: "warning", message: "Use design tokens from styles.scss" },
    ],
    "function-disallowed-list": [
      ["/^rgb/", "/^hsl/"],
      { severity: "warning", message: "Use design tokens from styles.scss" },
    ],
    // Third-party class names from react-aria-components can't be renamed
    "selector-class-pattern": [
      "^(_?([a-z][a-z0-9]*)(-[a-z0-9]+)*|react-aria-[A-Za-z]+)$",
      { message: "Expected class selector to be kebab-case" },
    ],
  },
  overrides: [
    {
      // styles.scss is where design tokens are DEFINED — raw colors are the point.
      files: ["src/styles.scss"],
      rules: {
        "color-no-hex": null,
        "color-function-notation": null,
        "function-disallowed-list": null,
      },
    },
  ],
};
