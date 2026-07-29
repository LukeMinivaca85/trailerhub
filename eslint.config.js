module.exports = [
  {
    files: ["src/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        XMLHttpRequest: "readonly",
        Promise: "readonly",
        Date: "readonly",
        Error: "readonly",
        Number: "readonly",
        String: "readonly",
        Array: "readonly",
        YT: "readonly",
        IntersectionObserver: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "no-var": "off",
      "prefer-const": "off"
    }
  }
];
