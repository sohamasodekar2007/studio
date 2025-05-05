// ResourceRecommendation.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for providing personalized learning resource recommendations.
 *
 * The flow takes into account the user's learning goals and past performance to suggest relevant materials.
 *
 * @interface ResourceRecommendationInput - Defines the input schema for the resource recommendation flow.
 * @interface ResourceRecommendationOutput - Defines the output schema for the resource recommendation flow.
 * @function recommendResources - The main function to trigger the resource recommendation flow.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ResourceRecommendationInputSchema = z.object({
  learningGoals: z
    .string()
    .describe('The learning goals of the user, e.g., "Learn React"'),
  pastPerformance: z
    .string()
    .describe(
      'The past performance of the user, e.g., "Completed introductory course with a score of 90%"'
    ),
});

export type ResourceRecommendationInput = z.infer<
  typeof ResourceRecommendationInputSchema
>;

const ResourceRecommendationOutputSchema = z.object({
  recommendedResources: z
    .string()
    .describe(
      'A list of recommended learning resources, including links and descriptions.'
    ),
});

export type ResourceRecommendationOutput = z.infer<
  typeof ResourceRecommendationOutputSchema
>;

export async function recommendResources(
  input: ResourceRecommendationInput
): Promise<ResourceRecommendationOutput> {
  return resourceRecommendationFlow(input);
}

const resourceRecommendationPrompt = ai.definePrompt({
  name: 'resourceRecommendationPrompt',
  input: {
    schema: z.object({
      learningGoals: z
        .string()
        .describe('The learning goals of the user, e.g., "Learn React"'),
      pastPerformance: z
        .string()
        .describe(
          'The past performance of the user, e.g., "Completed introductory course with a score of 90%"'
        ),
    }),
  },
  output: {
    schema: z.object({
      recommendedResources: z
        .string()
        .describe(
          'A list of recommended learning resources, including links and descriptions.'
        ),
    }),
  },
  prompt: `You are an AI learning assistant. Recommend learning resources based on the user's learning goals and past performance.

Learning Goals: {{{learningGoals}}}
Past Performance: {{{pastPerformance}}}

Recommended Resources:`,
});

const resourceRecommendationFlow = ai.defineFlow<
  typeof ResourceRecommendationInputSchema,
  typeof ResourceRecommendationOutputSchema
>({
  name: 'resourceRecommendationFlow',
  inputSchema: ResourceRecommendationInputSchema,
  outputSchema: ResourceRecommendationOutputSchema,
},
async input => {
  const {output} = await resourceRecommendationPrompt(input);
  return output!;
});
