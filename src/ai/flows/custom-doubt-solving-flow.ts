// src/ai/flows/custom-doubt-solving-flow.ts
'use server';
/**
 * @fileOverview EduNexus by GODWIN AI Doubt Solving Agent.
 *
 * - solveDoubt - A function that handles the doubt solving process.
 * - SolveDoubtInput - The input type for the solveDoubt function.
 * - SolveDoubtOutput - The return type for the solveDoubt function.
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
  answer: z.string().describe('A clear, concise, and accurate answer to the doubt.'),
});
export type SolveDoubtOutput = z.infer<typeof SolveDoubtOutputSchema>;

// Exported wrapper function to call the flow
export async function solveDoubt(input: SolveDoubtInput): Promise<SolveDoubtOutput> {
  if (!ai.plugins().find(p => p.name === 'googleAI')) {
    console.error("CustomDoubtSolvingFlow: Google AI plugin not configured. GOOGLE_GENAI_API_KEY might be missing.");
    throw new Error("The AI doubt solving service is not available at the moment. Please try again later.");
  }
  return solveDoubtFlow(input);
}

// Prompt definition
const doubtSolvingPrompt = ai.definePrompt({
  name: 'eduNexusDoubtSolvingPrompt',
  input: { schema: SolveDoubtInputSchema },
  output: { schema: SolveDoubtOutputSchema },
  prompt: `You are EduNexus by GODWIN, an expert AI tutor specializing in MHT-CET, JEE, and NEET subjects (Physics, Chemistry, Mathematics, Biology).
Your task is to provide a clear, concise, and accurate answer to the user's doubt.
If the question involves calculations, show the steps clearly. Use LaTeX for mathematical formulas, surrounded by $$ for block and $ for inline.
If it's a conceptual question, explain the concept thoroughly but simply.
If an image is provided, consider it as part of the question.

User's Question:
{{#if questionText}}
Text: {{{questionText}}}
{{/if}}
{{#if imageDataUri}}
Image: {{media url=imageDataUri}}
(If you cannot directly process the image content, acknowledge that an image was provided and answer based on the text, or state that you need a textual description of the image if the text is insufficient.)
{{/if}}
{{#unless questionText}}{{#unless imageDataUri}}
The user did not provide any text or image for their doubt. Please ask them to provide their question.
{{/unless}}{{/unless}}

Provide your answer below:`,
});


// Flow definition
const solveDoubtFlow = ai.defineFlow(
  {
    name: 'solveDoubtFlow',
    inputSchema: SolveDoubtInputSchema,
    outputSchema: SolveDoubtOutputSchema,
  },
  async (input) => {
    const { output } = await doubtSolvingPrompt(input);
    if (!output) {
      throw new Error("AI failed to generate an answer for the doubt.");
    }
    return output;
  }
);