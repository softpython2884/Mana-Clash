'use server';

/**
 * @fileOverview A card idea generator AI agent.
 *
 * - generateCardIdeas - A function that generates card ideas based on a theme.
 * - GenerateCardIdeasInput - The input type for the generateCardIdeas function.
 * - GenerateCardIdeasOutput - The return type for the generateCardIdeas function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCardIdeasInputSchema = z.object({
  theme: z.string().describe('The theme or concept for the card ideas.'),
  numberOfCards: z.number().default(3).describe('The number of card ideas to generate.'),
});
export type GenerateCardIdeasInput = z.infer<typeof GenerateCardIdeasInputSchema>;

const CardIdeaSchema = z.object({
  name: z.string().describe('The name of the card.'),
  manaCost: z.number().describe('The mana cost of the card.'),
  attack: z.number().describe('The attack value of the card.'),
  defense: z.number().describe('The defense value of the card.'),
  criticalHitChance: z.number().describe('The critical hit chance of the card.'),
  description: z.string().describe('A brief description of the card.'),
});

const GenerateCardIdeasOutputSchema = z.object({
  cards: z.array(CardIdeaSchema).describe('An array of card ideas.'),
});
export type GenerateCardIdeasOutput = z.infer<typeof GenerateCardIdeasOutputSchema>;

export async function generateCardIdeas(input: GenerateCardIdeasInput): Promise<GenerateCardIdeasOutput> {
  return generateCardIdeasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateCardIdeasPrompt',
  input: {schema: GenerateCardIdeasInputSchema},
  output: {schema: GenerateCardIdeasOutputSchema},
  prompt: `You are a creative card game designer. Generate {{numberOfCards}} card ideas based on the following theme:\n\nTheme: {{{theme}}}\n\nEach card idea should include: name, mana cost, attack, defense, critical hit chance, and a brief description.\n\nEnsure that the card stats are reasonable and balanced for a card game. The mana cost should be proportional to the card's power, with stronger cards costing more mana.`,
});

const generateCardIdeasFlow = ai.defineFlow(
  {
    name: 'generateCardIdeasFlow',
    inputSchema: GenerateCardIdeasInputSchema,
    outputSchema: GenerateCardIdeasOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
