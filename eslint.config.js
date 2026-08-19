export default [
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        crypto: "readonly",
        localStorage: "readonly",
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        MutationObserver: "readonly",
        WeakMap: "readonly",
        requestAnimationFrame: "readonly",
        Blob: "readonly",
        URL: "readonly",
        document: "readonly",
        window: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Date: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        FileReader: "readonly",
        location: "readonly",
        fetch: "readonly",
        CSS: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "destructuredArrayIgnorePattern": "^_" }],
      "no-undef": "warn",
      "no-console": "off",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "no-self-compare": "error"
    }
  }
];