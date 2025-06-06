// @ts-check

import globals from "globals";
import tseslint from "typescript-eslint";
import eslintJs from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import pluginImport from "eslint-plugin-import";

// Replicate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname, // Important for FlatCompat to find plugins
});

export default tseslint.config(
  // 1. Global ignores
  {
    ignores: ["lib/**/*", "generated/**/*"],
  },

  // 2. Base ESLint recommended for all JS/TS files
  eslintJs.configs.recommended,

  // 3. Configuration for JavaScript files (.js, .mjs, .cjs)
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [
      ...compat.extends(
        "google",
        "plugin:import/errors",
        "plugin:import/warnings"
      ),
    ],
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
    },
  },

  // 4. Configuration for TypeScript files (.ts)
  {
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...compat.extends("plugin:import/typescript"),
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"], // Explicitly list tsconfig files
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
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

      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",

      // Explicitly turn off JSDoc rules for TS files
      "require-jsdoc": "off",
      "valid-jsdoc": "off",

      "import/no-unresolved": 0,
    },
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: ['./tsconfig.json', './tsconfig.dev.json'],
            },
            node: true,
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
    },
  },
  
  // 5. Configuration for the eslint.config.js file itself
  {
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "max-len": "off",
    },
  }
);
