"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textEmbedding004 = exports.ai = void 0;
const core_1 = require("@genkit-ai/core");
const googleai_1 = require("@genkit-ai/googleai");
Object.defineProperty(exports, "textEmbedding004", { enumerable: true, get: function () { return googleai_1.textEmbedding004; } });
const vertexai_1 = require("@genkit-ai/vertexai");
/**
 * Configures the AI plugins for the application.
 *
 * The vertexAI plugin is configured to use 'gemini-2.5-pro' as the default model
 * for all generation requests. The location is set to 'us-central1'.
 *
 * We also export specific tools like the text-embedding-004 model
 * for use in flows that require embeddings.
 */
exports.ai = (0, core_1.configure)({
    plugins: [
        // The googleAI plugin is included for additional functionalities.
        (0, googleai_1.googleAI)(),
        // The vertexAI plugin is the primary interface for Google's Gemini models.
        (0, vertexai_1.vertexAI)({
            location: 'us-central1',
            // Specifies the default generative model for the application.
            model: 'gemini-2.5-pro',
        }),
    ],
    // Enables detailed logging for debugging purposes.
    logLevel: 'debug',
    // Enables performance tracing and metrics.
    enableTracingAndMetrics: true,
});
//# sourceMappingURL=genkit.config.js.map