// src/ai/flows/study-tip-flow.ts
'use server';
/**
 * @fileOverview Generates personalized study tips for competitive exams.
 *
 * - getStudyTips - A function that calls the Genkit flow to generate tips.
 * - StudyTipInput - The input type for the study tip generation.
 * - StudyTipOutput - The return type containing the generated tips.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

// Define the input schema using Zod
const StudyTipInputSchema = z.object({
  exam: z.string().describe('The name of the competitive exam (e.g., MHT-CET, JEE Main, NEET).'),
  subject: z.string().describe('The subject for which tips are needed (e.g., Physics, Chemistry, Maths, Biology).'),
  topic: z.string().describe('The specific topic within the subject (e.g., Calculus, Organic Chemistry, Genetics).'),
  difficultyLevel: z.string().describe('The perceived difficulty level of the topic for the user (e.g., Beginner, Intermediate, Advanced).'),
});
export type StudyTipInput = z.infer<typeof StudyTipInputSchema>;

// Define the output schema using Zod
const StudyTipOutputSchema = z.object({
  tips: z.string().describe('A set of actionable and personalized study tips, formatted as a numbered or bulleted list.'),
});
export type StudyTipOutput = z.infer<typeof StudyTipOutputSchema>;

// Define the prompt for the AI model
const studyTipPrompt = ai.definePrompt({
  name: 'studyTipPrompt',
  input: { schema: StudyTipInputSchema },
  output: { schema: StudyTipOutputSchema },
  prompt: `You are an expert academic advisor specializing in competitive exam preparation for Indian students (MHT-CET, JEE Main, JEE Advanced, NEET).

Generate a list of 3-5 concise, actionable, and personalized study tips for a student preparing for the "{{exam}}" exam.

The student needs help with the subject "{{subject}}", specifically the topic "{{topic}}".
They find this topic to be at a "{{difficultyLevel}}" difficulty level.

Focus on practical advice, specific techniques, and resource recommendations relevant to the Indian education system and the specified exam. Avoid generic advice. Format the output as a bulleted or numbered list.

Example format:
*   Tip 1: Focus on [specific concept] using [specific method/resource].
*   Tip 2: Practice [type of problems] from [recommended source for the exam].
*   Tip 3: Try [alternative approach] for [specific challenge related to difficulty].
`,
});

// Define the Genkit flow
const studyTipFlow = ai.defineFlow<
  typeof StudyTipInputSchema,
  typeof StudyTipOutputSchema
>(
  {
    name: 'studyTipFlow',
    inputSchema: StudyTipInputSchema,
    outputSchema: StudyTipOutputSchema,
  },
  async (input) => {
    const { output } = await studyTipPrompt(input);

    if (!output) {
      throw new Error("Failed to generate study tips from the AI model.");
    }

    return output;
  }
);

// Exported wrapper function to call the flow
export async function getStudyTips(input: StudyTipInput): Promise<StudyTipOutput> {
  return studyTipFlow(input);
}
