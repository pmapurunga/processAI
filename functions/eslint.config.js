// @ts-check

import globals from "globals";
import tseslint from "typescript-eslint";
import eslintJs from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import pluginImport from "eslint-plugin-import";


// Replicar __dirname e __filename para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: eslintJs.configs.recommended,
});

export default tseslint.config(
  {
    // Configuração global de ignores
    ignores: ["lib/**/*", "generated/**/*"],
  },
  eslintJs.configs.recommended,
  ...compat.extends(
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
  ),
  {
    // Configurações específicas para arquivos TypeScript
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.dev.json"], // Relative to functions directory
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
      "import/no-unresolved": 0,
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
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // "require-jsdoc": "off", // Removed to avoid conflict, let 'google' config handle if needed
      // "valid-jsdoc": "off",   // Removed to avoid conflict/error
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],
    },
  },
  {
    // Configuração para o próprio arquivo eslint.config.js
    files: ["eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "max-len": "off", // Desabilitar max-len para este arquivo
    },
  }
);
