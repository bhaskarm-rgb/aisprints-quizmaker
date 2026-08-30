import { z } from "zod";

const choiceSchema = z.object({
	text: z.string().trim().min(1).max(500),
	isCorrect: z.boolean(),
});

const choicesSchema = z
	.array(choiceSchema)
	.min(2)
	.max(6)
	.refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
		message: "Exactly one choice must be correct",
	});

export const createMcqBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	question: z.string().trim().min(1).max(1000),
	userId: z.string().trim().min(1),
	choices: choicesSchema,
});

export const updateMcqBodySchema = z.object({
	name: z.string().trim().min(1).max(200),
	question: z.string().trim().min(1).max(1000),
	choices: choicesSchema,
});

export type CreateMcqBody = z.infer<typeof createMcqBodySchema>;
export type UpdateMcqBody = z.infer<typeof updateMcqBodySchema>;

export const recordAttemptBodySchema = z.object({
	userId: z.string().trim().min(1),
	choiceId: z.string().trim().min(1),
});

export type RecordAttemptBody = z.infer<typeof recordAttemptBodySchema>;
