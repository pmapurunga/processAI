// @ts-check

import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginImport from "eslint-plugin-import";
import globals from "globals";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  // 1. Global ignores
  {
    ignores: [
      "lib/**/*", // Common output directory for tsc
      "generated/**/*", // Common for generated code
      "node_modules/**/*", // Always ignore node_modules
    ],
  },

  // 2. Base ESLint recommended for all JS/TS files
  eslintJs.configs.recommended,

  // 3. Configuration for JavaScript files (.js, .mjs, .cjs)
  // Applied only to non-TypeScript JS files in the root of functions or similar.
  {
    files: ["*.js", "*.mjs", "*.cjs"], // More specific to avoid src/
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "import": pluginImport,
    },
    rules: {
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "max-len": ["warn", {
        "code": 100,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
        "ignoreRegExpLiterals": true,
        "ignoreComments": true,
      }],
      "object-curly-spacing": ["error", "always"],
      "padded-blocks": ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
      "require-jsdoc": "off",
      "valid-jsdoc": "off",
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
  },

  // 4. Configuration for TypeScript files (.ts) in src/
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "import": pluginImport,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"],
        tsconfigRootDir: __dirname,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Inherit from tseslint.configs.recommendedTypeChecked and stylisticTypeChecked
      ...tseslint.configs.recommendedTypeChecked.rules,
      ...tseslint.configs.stylisticTypeChecked.rules,

      // Override or add specific rules for TypeScript
      "quotes": ["error", "double"],
      "indent": ["error", 2],
      "max-len": ["warn", {
        "code": 100,
        "ignoreUrls": true,
        "ignoreStrings": true,
        "ignoreTemplateLiterals": true,
        "ignoreRegExpLiterals": true,
        "ignoreComments": true,
      }],
      "object-curly-spacing": ["error", "always"],
      "padded-blocks": ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],

      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "require-jsdoc": "off",
      "valid-jsdoc": "off",

      // Import plugin rules for TypeScript
      "import/no-unresolved": "off", // Disable as tsc handles module resolution
      "import/named": "error",
      "import/namespace": "off", // Disabled due to issues with firebase-functions and resolver
      "import/default": "error",
      "import/export": "error",
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json", "./tsconfig.dev.json"],
        },
        node: true,
      },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts"],
      },
    },
  },

  // 5. Configuration for the eslint.config.js file itself
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "import": pluginImport,
    },
    rules: {
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
      "max-len": "off",
      "sort-keys": "off",
      "import/no-unresolved": ["error", { "commonjs": true, "amd": true, "ignore": ["typescript-eslint"] }],
    },
    settings: {
      "import": {
        "resolver": {
          node: true,
        },
      },
    },
  },
);
