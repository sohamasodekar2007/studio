'use server';
/**
 * @fileOverview Predicts a user's rank range based on their test performance relative to others.
 *
 * - predictRank - A function that calls the Genkit flow to generate a rank prediction.
 * - PredictRankInput - The input type for the rank prediction flow.
 * - PredictRankOutput - The return type containing the predicted rank range and feedback.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { getAllReportsForTest } from '@/actions/test-report-actions';
import type { TestResultSummary } from '@/types';

// Define the input schema using Zod
const PredictRankInputSchema = z.object({
  userId: z.string().describe("The ID of the user whose rank is being predicted."),
  testCode: z.string().describe("The unique code of the test."),
  userScore: z.number().describe("The score obtained by the user."),
  totalMarks: z.number().describe("The total possible marks for the test."),
  timeTakenMinutes: z.number().describe("The time taken by the user in minutes."),
  durationMinutes: z.number().describe("The total duration of the test in minutes."),
});
export type PredictRankInput = z.infer<typeof PredictRankInputSchema>;

// Define the output schema using Zod
const PredictRankOutputSchema = z.object({
  predictedRankRange: z.string().describe('A predicted rank range (e.g., "Top 10%", "Rank 500-1000", "Lower 50%").'),
  feedback: z.string().describe('Qualitative feedback based on the performance comparison.'),
});
export type PredictRankOutput = z.infer<typeof PredictRankOutputSchema>;

// Define the prompt for the AI model
const predictRankPrompt = ai.definePrompt({
  name: 'predictRankPrompt',
  input: { schema: z.object({ // Define schema for prompt context
      userScore: z.number(),
      totalMarks: z.number(),
      timeTakenMinutes: z.number(),
      durationMinutes: z.number(),
      totalAttempts: z.number(),
      averageScore: z.number().optional(),
      medianScore: z.number().optional(),
      highestScore: z.number().optional(),
      scoreDistributionSummary: z.string().optional().describe("A brief summary of how scores are distributed, e.g., 'Most scores are between X and Y'"),
  }) },
  output: { schema: PredictRankOutputSchema },
  prompt: `You are an expert performance analyst for competitive exams (MHT-CET, JEE, NEET).
Analyze the following user performance data for a specific test, comparing it against the performance of other students who took the same test.

User's Performance:
- Score: {{userScore}} / {{totalMarks}}
- Time Taken: {{timeTakenMinutes}} / {{durationMinutes}} minutes

Comparison Data (Based on {{totalAttempts}} total attempts):
{{#if averageScore}}Average Score: {{averageScore}}{{/if}}
{{#if medianScore}}Median Score: {{medianScore}}{{/if}}
{{#if highestScore}}Highest Score Recorded: {{highestScore}}{{/if}}
{{#if scoreDistributionSummary}}Score Distribution: {{scoreDistributionSummary}}{{/if}}

Based ONLY on this data, predict a likely rank range for this user among all test takers for THIS SPECIFIC TEST. Provide the prediction as a concise range (e.g., "Top 5-10%", "Rank 250-500", "Likely in the top third", "Lower 50%").

Also, provide brief, constructive qualitative feedback focusing on how the user's score and time compare to the general performance. Mention strengths or areas for improvement based on the comparison. Keep feedback concise (1-2 sentences).
`,
});

// Define the Genkit flow
const predictRankFlow = ai.defineFlow<
  typeof PredictRankInputSchema,
  typeof PredictRankOutputSchema
>(
  {
    name: 'predictRankFlow',
    inputSchema: PredictRankInputSchema,
    outputSchema: PredictRankOutputSchema,
  },
  async (input) => {
    // 1. Fetch all reports for the test
    const allAttempts = await getAllReportsForTest(input.testCode);

    if (allAttempts.length === 0) {
        return {
            predictedRankRange: "N/A (No comparison data)",
            feedback: "Cannot predict rank as no other attempts have been recorded for this test yet."
        }
    }

    // 2. Calculate statistics (handle potential null/undefined scores)
    const validScores = allAttempts.map(a => a.score).filter(s => typeof s === 'number') as number[];
    const totalAttempts = validScores.length;
    let averageScore: number | undefined;
    let medianScore: number | undefined;
    let highestScore: number | undefined;
    let scoreDistributionSummary: string | undefined;


    if (totalAttempts > 0) {
        const sum = validScores.reduce((acc, score) => acc + score, 0);
        averageScore = sum / totalAttempts;
        highestScore = Math.max(...validScores);

        // Calculate median
        const sortedScores = [...validScores].sort((a, b) => a - b);
        const mid = Math.floor(totalAttempts / 2);
        medianScore = totalAttempts % 2 !== 0 ? sortedScores[mid] : (sortedScores[mid - 1] + sortedScores[mid]) / 2;

        // Basic distribution summary (can be enhanced)
         const firstQuartile = sortedScores[Math.floor(totalAttempts * 0.25)];
         const thirdQuartile = sortedScores[Math.floor(totalAttempts * 0.75)];
          if (firstQuartile !== undefined && thirdQuartile !== undefined) {
             scoreDistributionSummary = `50% of scores fall between ${firstQuartile.toFixed(1)} and ${thirdQuartile.toFixed(1)}.`;
          }
    }


    // 3. Prepare prompt input
    const promptInput = {
        userScore: input.userScore,
        totalMarks: input.totalMarks,
        timeTakenMinutes: input.timeTakenMinutes,
        durationMinutes: input.durationMinutes,
        totalAttempts: allAttempts.length, // Use total reports fetched before filtering scores
        averageScore: averageScore ? parseFloat(averageScore.toFixed(1)) : undefined,
        medianScore: medianScore ? parseFloat(medianScore.toFixed(1)): undefined,
        highestScore: highestScore,
        scoreDistributionSummary: scoreDistributionSummary
    };

     console.log("Prompt Input for Rank Prediction:", promptInput);


    // 4. Call the prompt
    const { output } = await predictRankPrompt(promptInput);

    if (!output) {
      throw new Error("AI failed to generate rank prediction.");
    }

    return output;
  }
);

// Exported wrapper function to call the flow
export async function predictRank(input: PredictRankInput): Promise<PredictRankOutput> {
  // Basic validation before calling flow
   if (input.totalMarks <= 0) {
      return { predictedRankRange: "N/A", feedback: "Invalid test data (total marks <= 0)." };
   }
  return predictRankFlow(input);
}
