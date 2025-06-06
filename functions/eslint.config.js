
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
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "import": pluginImport,
    },
    rules: {
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
      "require-jsdoc": "off", // Explicitly off for JS files too, if not desired
      "valid-jsdoc": "off",   // Explicitly off for JS files too
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
  },

  // 4. Configuration for TypeScript files (.ts)
  {
    files: ["src/**/*.ts"], // Target only .ts files in src for these rules
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "import": pluginImport,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"], // Ensure these paths are correct relative to `functions`
        tsconfigRootDir: __dirname, // Root directory for tsconfig.json resolution
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Inherit from tseslint.configs.recommendedTypeChecked and stylisticTypeChecked
      // These will enable rules like @typescript-eslint/no-unsafe-assignment etc.
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
      "@typescript-eslint/explicit-function-return-type": "off", // Common preference
      "@typescript-eslint/no-explicit-any": "warn", // Warn instead of error for 'any'
      "require-jsdoc": "off", // Turn off JSDoc requirements for TS
      "valid-jsdoc": "off",   // Turn off JSDoc requirements for TS

      // Ensure import plugin works with TypeScript
      "import/no-unresolved": "off", // Disable as tsc handles module resolution
      "import/named": "error",
      "import/namespace": "error",
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
        module: "readonly", // if using module.exports
        require: "readonly", // if using require
        __dirname: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "import": pluginImport, // Enable import plugin for the config file itself
    },
    rules: {
      "indent": ["error", 2],
      "quotes": ["error", "double"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
      "max-len": "off",
      "sort-keys": "off",
      "import/no-unresolved": ["error", { "commonjs": true, "amd": true, "ignore": ["typescript-eslint"] }], // Allow 'typescript-eslint' import
    },
    settings: {
      "import/resolver": { // Resolver for the config file
        node: true,
      },
    },
  }
);
