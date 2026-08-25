import { z } from "zod";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);

export const registerBodySchema = z.object({
	firstName: z.string().trim().min(1).max(50),
	lastName: z.string().trim().min(1).max(50),
	username: z.string().trim().min(3).max(50),
	email: z.string().trim().pipe(z.email()),
	password: sha256Hex,
});

export const loginBodySchema = z.object({
	username: z.string().trim().min(1).max(50),
	password: sha256Hex,
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
