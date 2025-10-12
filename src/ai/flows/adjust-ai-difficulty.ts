'use server';

/**
 * @fileOverview AI difficulty adjustment flow.
 *
 * This file defines a Genkit flow that dynamically adjusts the AI opponent's difficulty
 * based on the player's win/loss ratio and experience level.
 *
 * @Exported Members:
 *   - adjustAiDifficulty - The main function to adjust AI difficulty.
 *   - AdjustAiDifficultyInput - The input type for the adjustAiDifficulty function.
 *   - AdjustAiDifficultyOutput - The output type for the adjustAiDifficulty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Input schema for adjusting AI difficulty.
 */
const AdjustAiDifficultyInputSchema = z.object({
  winLossRatio: z
    .number()
    .describe(
      'The player win/loss ratio, where 1.0 indicates always winning and 0.0 indicates always losing.'
    ),
  experienceLevel: z
    .number()
    .describe('The player experience level, as a numerical value.'),
});

export type AdjustAiDifficultyInput = z.infer<typeof AdjustAiDifficultyInputSchema>;

/**
 * Output schema for AI difficulty adjustment.
 */
const AdjustAiDifficultyOutputSchema = z.object({
  difficultyLevel: z
    .string()
    .describe(
      'The adjusted AI difficulty level, which can be Easy, Medium, or Hard.'
    ),\n  explanation: z
    .string()
    .describe('An explanation of why the AI difficulty was adjusted.'),
});

export type AdjustAiDifficultyOutput = z.infer<typeof AdjustAiDifficultyOutputSchema>;

/**
 * Main function to adjust AI difficulty based on player stats.
 * @param input - The input containing player win/loss ratio and experience level.
 * @returns The adjusted AI difficulty level.
 */
export async function adjustAiDifficulty(input: AdjustAiDifficultyInput): Promise<AdjustAiDifficultyOutput> {
  return adjustAiDifficultyFlow(input);
}

const adjustAiDifficultyPrompt = ai.definePrompt({
  name: 'adjustAiDifficultyPrompt',
  input: {schema: AdjustAiDifficultyInputSchema},
  output: {schema: AdjustAiDifficultyOutputSchema},
  prompt: `You are an expert game AI balancer.

You will receive the player's win/loss ratio and experience level, and you will output an AI difficulty level (Easy, Medium, or Hard) and explain why you chose that difficulty.

Here is the player's information:
Win/Loss Ratio: {{{winLossRatio}}}
Experience Level: {{{experienceLevel}}}

Consider the following:
* A win/loss ratio above 0.75 indicates the player is consistently winning and needs a greater challenge.
* A win/loss ratio below 0.25 indicates the player is consistently losing and needs an easier challenge.
* Experience level should also be taken into account; a high-level player should generally face a higher difficulty.
`,
});

const adjustAiDifficultyFlow = ai.defineFlow(
  {
    name: 'adjustAiDifficultyFlow',
    inputSchema: AdjustAiDifficultyInputSchema,
    outputSchema: AdjustAiDifficultyOutputSchema,
  },
  async input => {
    const {output} = await adjustAiDifficultyPrompt(input);
    return output!;
  }
);
