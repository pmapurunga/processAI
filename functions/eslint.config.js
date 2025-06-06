
// @ts-check

import globals from "globals";
import tseslint from "typescript-eslint";
import eslintJs from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

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
        project: ["tsconfig.json", "tsconfig.dev.json"],
        tsconfigRootDir: __dirname, // Garante que tsconfig.json seja encontrado corretamente
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      // O plugin 'import' é gerenciado pelo compat.extends acima
    },
    rules: {
      "quotes": ["error", "double"],
      "import/no-unresolved": 0,
      "indent": ["error", 2],
      "max-len": ["error", {
        "code": 100, // Aumentado um pouco para evitar quebras excessivas
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
      "require-jsdoc": "off", // Desabilitado pois Google config já lida com isso
      "valid-jsdoc": "off", // Desabilitado
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
