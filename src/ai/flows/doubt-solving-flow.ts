'use server';
/**
 * @fileOverview AI agent to solve student doubts for competitive exams.
 *
 * - getDoubtAnswer - A function that calls the Genkit flow to generate an answer.
 * - DoubtSolvingInput - The input type for the doubt solving flow.
 * - DoubtSolvingOutput - The return type containing the generated answer.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the input schema using Zod
export const DoubtSolvingInputSchema = z.object({
  questionText: z.string().optional().describe('The textual question asked by the student.'),
  imageDataUri: z.string().optional().describe(
    "An image of the doubt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. Optional."
  ),
}).refine(data => data.questionText || data.imageDataUri, {
    message: "Either questionText or imageDataUri must be provided.",
});
export type DoubtSolvingInput = z.infer<typeof DoubtSolvingInputSchema>;

// Define the output schema using Zod
export const DoubtSolvingOutputSchema = z.object({
  answer: z.string().describe('A clear, step-by-step explanation or answer to the student\'s doubt.'),
});
export type DoubtSolvingOutput = z.infer<typeof DoubtSolvingOutputSchema>;

// Define the prompt for the AI model
const doubtSolvingPrompt = ai.definePrompt({
  name: 'doubtSolvingPrompt',
  input: { schema: DoubtSolvingInputSchema },
  output: { schema: DoubtSolvingOutputSchema },
  prompt: `You are EduNexus by GODWIN, an expert AI tutor specializing in MHT-CET, JEE, and NEET subjects (Physics, Chemistry, Mathematics, Biology).

A student has asked the following doubt. Provide a clear, concise, and accurate answer. If the question involves calculations, show the steps. If it's a conceptual question, explain the concept thoroughly but simply.

Analyze the provided text and/or image to understand the doubt.

{{#if questionText}}
Student's Question (Text):
{{{questionText}}}
{{/if}}

{{#if imageDataUri}}
Student's Question (Image):
{{media url=imageDataUri}}
{{/if}}

Provide the answer below:
`,
});

// Define the Genkit flow
const doubtSolvingFlow = ai.defineFlow<
  typeof DoubtSolvingInputSchema,
  typeof DoubtSolvingOutputSchema
>(
  {
    name: 'doubtSolvingFlow',
    inputSchema: DoubtSolvingInputSchema,
    outputSchema: DoubtSolvingOutputSchema,
  },
  async (input) => {
    // Check if at least one input is provided (already handled by Zod refine, but good practice)
    if (!input.questionText && !input.imageDataUri) {
        throw new Error("No question text or image provided.");
    }

    const { output } = await doubtSolvingPrompt(input);

    if (!output) {
      throw new Error("EduNexus by GODWIN could not generate an answer at this time.");
    }

    return output;
  }
);

// Exported wrapper function to call the flow
export async function getDoubtAnswer(input: DoubtSolvingInput): Promise<DoubtSolvingOutput> {
  return doubtSolvingFlow(input);
}
