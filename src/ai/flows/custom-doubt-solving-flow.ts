// src/ai/flows/custom-doubt-solving-flow.ts
'use server';
/**
 * @fileOverview EduNexus by GODWIN AI Doubt Solving Agent using Gemini.
 *
 * - solveDoubtWithGemini - A function that handles the doubt solving process using Gemini.
 * - SolveDoubtInput - The input type for the solveDoubtWithGemini function.
 * - SolveDoubtOutput - The return type for the solveDoubtWithGemini function.
 */

import { ai } from '@/ai/ai-instance'; // Use the project's AI instance
import { z } from 'genkit';

const SolveDoubtInputSchema = z.object({
  questionText: z.string().optional().describe("The user's question or doubt."),
  imageDataUri: z
    .string()
    .optional()
    .describe(
      "An image related to the doubt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Optional."
    ),
}).refine(data => data.questionText || data.imageDataUri, {
    message: "Either questionText or imageDataUri must be provided.",
});

export type SolveDoubtInput = z.infer<typeof SolveDoubtInputSchema>;

const SolveDoubtOutputSchema = z.object({
  answer: z.string().describe('A clear, concise, and accurate answer to the doubt, potentially including LaTeX for math.'),
});
export type SolveDoubtOutput = z.infer<typeof SolveDoubtOutputSchema>;

// Exported wrapper function to call the flow
export async function solveDoubtWithGemini(input: SolveDoubtInput): Promise<SolveDoubtOutput> {
  // Check if the Google AI plugin is configured
  if (!ai.plugins().find(p => p.name === 'googleAI')) {
    console.error("CustomDoubtSolvingFlow (Gemini): Google AI plugin not configured. GOOGLE_GENAI_API_KEY might be missing or invalid.");
    throw new Error("The AI doubt solving service is currently unavailable. Please ensure the AI service is correctly configured.");
  }
  // Check if Gemini model is specifically available if needed, or rely on Genkit's default if set.
  // For now, we assume if the plugin is there, Genkit can handle model selection.
  return solveDoubtGeminiFlow(input);
}

// Prompt definition for Gemini
const geminiDoubtSolvingPrompt = ai.definePrompt({
  name: 'eduNexusGeminiDoubtSolvingPrompt',
  input: { schema: SolveDoubtInputSchema },
  output: { schema: SolveDoubtOutputSchema },
  // Specify a Gemini model known for multimodal capabilities if image processing is key
  // e.g., 'googleai/gemini-1.5-flash-latest' or 'googleai/gemini-pro-vision' (check latest Genkit model names)
  // If no specific model, Genkit will use its default from ai-instance or the first available.
  // model: 'googleai/gemini-1.5-flash-latest', // Example: Using a recent multimodal model
  prompt: `You are EduNexus by GODWIN, an expert AI tutor specializing in MHT-CET, JEE, and NEET subjects (Physics, Chemistry, Mathematics, Biology).
Your task is to provide a clear, concise, and accurate answer to the user's doubt.
If the question involves calculations, show the steps clearly. Use LaTeX for mathematical formulas, surrounded by $$ for block and $ for inline.
If it's a conceptual question, explain the concept thoroughly but simply.

User's Doubt:
{{#if questionText}}
Question: {{{questionText}}}
{{/if}}
{{#if imageDataUri}}
Image context: {{media url=imageDataUri}}
(Analyze the image provided and incorporate its content into your answer if relevant to the textual question, or describe the image if it's the primary subject of the doubt.)
{{/if}}
{{#unless questionText}}{{#unless imageDataUri}}
The user did not provide any text or image for their doubt. Please ask them to provide their question or an image illustrating their doubt.
{{/unless}}{{/unless}}

Provide your answer below:`,
config: {
    // Adjust safety settings if needed, especially if questions might involve complex diagrams or scientific content
    // that could be misconstrued by safety filters.
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
       {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ]
  }
});


// Flow definition using Gemini
const solveDoubtGeminiFlow = ai.defineFlow(
  {
    name: 'solveDoubtGeminiFlow',
    inputSchema: SolveDoubtInputSchema,
    outputSchema: SolveDoubtOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await geminiDoubtSolvingPrompt(input);
      if (!output || !output.answer) {
        // Log the full output for debugging if it's not as expected
        console.warn("AI output was missing or did not contain an answer:", output);
        throw new Error("AI failed to generate a valid answer for the doubt.");
      }
      return output;
    } catch (error: any) {
        console.error("Error during Gemini flow execution:", error);
        if (error.message && error.message.includes("GOOGLE_GENAI_API_KEY")) {
            throw new Error("AI service configuration error. Please contact support.");
        }
        throw new Error(`AI processing error: ${error.message || "An unknown error occurred."}`);
    }
  }
);
