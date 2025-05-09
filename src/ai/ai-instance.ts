
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const googleAiApiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!googleAiApiKey) {
  console.error(
    '**********************************************************************************'
  );
  console.error(
    'CRITICAL GENKIT ERROR: GOOGLE_GENAI_API_KEY environment variable is missing.'
  );
  console.error(
    'AI features will not work. Please set this variable in your .env file.'
  );
  console.error(
    'See README.md for setup instructions.'
  );
  console.error(
    '**********************************************************************************'
  );
  // To prevent a hard crash during initialization if the key is missing,
  // we will initialize genkit without the googleAI plugin.
  // Flows attempting to use Google AI will fail at runtime with a more specific error.
}

export const ai = genkit({
  promptDir: './prompts', // Genkit can handle if this dir doesn't exist
  plugins: googleAiApiKey
    ? [
        googleAI({
          apiKey: googleAiApiKey,
        }),
      ]
    : [], // Initialize with no Google AI plugin if key is missing
  // Setting a default model here might cause an error if the googleAI plugin isn't loaded.
  // It's safer to specify the model directly in each prompt or generate call,
  // or ensure flows check for plugin availability.
  // model: 'googleai/gemini-2.0-flash', // Commenting out default model for robustness
});

if (!googleAiApiKey) {
  console.warn(
    'Genkit was initialized WITHOUT the Google AI plugin due to a missing GOOGLE_GENAI_API_KEY.'
  );
  console.warn(
    'Any AI flows or operations relying on Google AI models (e.g., "googleai/gemini-2.0-flash") will fail.'
  );
}
