// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by_user_id: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	user_id: string;
	choice_id: string;
	is_correct: number;
};

type UserRow = {
	id: string;
};

const { mcqs, choices, attempts, users, clock } = vi.hoisted(() => ({
	mcqs: [] as McqRow[],
	choices: [] as ChoiceRow[],
	attempts: [] as AttemptRow[],
	users: [] as UserRow[],
	clock: { seq: 0 },
}));

function now() {
	clock.seq += 1;
	return new Date(Date.UTC(2026, 7, 30, 12, 0, clock.seq)).toISOString();
}

function createStatement(sql: string, values: unknown[]) {
	const statement = {
		async all<T>() {
			if (/INSERT\s+INTO\s+mcqs\b/i.test(sql)) {
				insertMcq(values);
				const row = mcqs[mcqs.length - 1];
				return { results: [row] as T[] };
			}

			if (/INSERT\s+INTO\s+mcq_choices\b/i.test(sql)) {
				insertChoice(values);
				const row = choices[choices.length - 1];
				return { results: [row] as T[] };
			}

			if (/INSERT\s+INTO\s+mcq_attempts\b/i.test(sql)) {
				insertAttempt(values);
				const row = attempts[attempts.length - 1];
				return { results: [row] as T[] };
			}

			if (/UPDATE\s+mcqs\b/i.test(sql)) {
				const [name, question, id] = values as string[];
				const row = mcqs.find((mcq) => mcq.id === id);
				if (row) {
					row.name = name;
					row.question = question;
					row.updated_at = now();
				}
				return { results: row ? [row as T] : [] };
			}

			if (/DELETE\s+FROM\s+mcq_attempts\b/i.test(sql)) {
				const [mcqId] = values as string[];
				for (let index = attempts.length - 1; index >= 0; index -= 1) {
					if (attempts[index].mcq_id === mcqId) {
						attempts.splice(index, 1);
					}
				}
				return { results: [] as T[] };
			}

			if (/DELETE\s+FROM\s+mcq_choices\b/i.test(sql)) {
				const [mcqId] = values as string[];
				for (let index = choices.length - 1; index >= 0; index -= 1) {
					if (choices[index].mcq_id === mcqId) {
						choices.splice(index, 1);
					}
				}
				return { results: [] as T[] };
			}

			if (/DELETE\s+FROM\s+mcqs\b/i.test(sql)) {
				const [id] = values as string[];
				const index = mcqs.findIndex((mcq) => mcq.id === id);
				if (index >= 0) {
					mcqs.splice(index, 1);
				}
				return { results: [] as T[] };
			}

			if (/SELECT\s+/i.test(sql) && /FROM\s+users\b/i.test(sql)) {
				const [id] = values as string[];
				const row = users.find((user) => user.id === id);
				return { results: row ? [row as T] : [] };
			}

			if (/SELECT\s+/i.test(sql) && /FROM\s+mcqs\b/i.test(sql) && /WHERE\s+id\s*=/i.test(sql)) {
				const [id] = values as string[];
				const row = mcqs.find((mcq) => mcq.id === id);
				return { results: row ? [row as T] : [] };
			}

			if (/SELECT\s+/i.test(sql) && /FROM\s+mcqs\b/i.test(sql)) {
				const rows = [...mcqs]
					.sort((left, right) => right.created_at.localeCompare(left.created_at))
					.map((mcq) => ({
						...mcq,
						choice_count: choices.filter((choice) => choice.mcq_id === mcq.id).length,
					}));
				return { results: rows as T[] };
			}

			if (/SELECT\s+/i.test(sql) && /FROM\s+mcq_choices\b/i.test(sql) && /WHERE\s+id\s*=/i.test(sql)) {
				const [id] = values as string[];
				const row = choices.find((choice) => choice.id === id);
				return { results: row ? [row as T] : [] };
			}

			if (/SELECT\s+/i.test(sql) && /FROM\s+mcq_choices\b/i.test(sql)) {
				const [mcqId] = values as string[];
				const rows = choices
					.filter((choice) => choice.mcq_id === mcqId)
					.sort((left, right) => left.position - right.position);
				return { results: rows as T[] };
			}

			return { results: [] as T[] };
		},
		async run() {
			const beforeMcqs = mcqs.length;
			const beforeChoices = choices.length;
			const beforeAttempts = attempts.length;
			await statement.all();
			let changes = 0;
			if (/INSERT\s+INTO\s+mcqs\b/i.test(sql)) {
				changes = mcqs.length > beforeMcqs ? 1 : 0;
			} else if (/INSERT\s+INTO\s+mcq_choices\b/i.test(sql)) {
				changes = choices.length > beforeChoices ? 1 : 0;
			} else if (/INSERT\s+INTO\s+mcq_attempts\b/i.test(sql)) {
				changes = attempts.length > beforeAttempts ? 1 : 0;
			} else if (/DELETE\s+FROM\s+mcq_attempts\b/i.test(sql)) {
				changes = beforeAttempts - attempts.length;
			} else if (/DELETE\s+FROM\s+mcq_choices\b/i.test(sql)) {
				changes = beforeChoices - choices.length;
			} else if (/DELETE\s+FROM\s+mcqs\b/i.test(sql)) {
				changes = beforeMcqs > mcqs.length ? 1 : 0;
			} else if (/UPDATE\s+mcqs\b/i.test(sql)) {
				changes = 1;
			}
			return { success: true, meta: { changes } };
		},
	};

	return statement;
}

function insertMcq(values: unknown[]) {
	const [id, name, question, createdByUserId] = values as string[];
	const timestamp = now();
	mcqs.push({
		id,
		name,
		question,
		created_by_user_id: createdByUserId,
		created_at: timestamp,
		updated_at: timestamp,
	});
}

function insertChoice(values: unknown[]) {
	let id: string;
	let mcqId: string;
	let choiceText: string;
	let isCorrect: number;
	let position: number;

	if (values.length >= 5) {
		[id, mcqId, choiceText, isCorrect, position] = values as [
			string,
			string,
			string,
			number,
			number,
		];
	} else {
		id = crypto.randomUUID();
		[mcqId, choiceText, isCorrect, position] = values as [string, string, number, number];
	}

	choices.push({
		id,
		mcq_id: mcqId,
		choice_text: choiceText,
		is_correct: Number(isCorrect),
		position: Number(position),
	});
}

function insertAttempt(values: unknown[]) {
	const [id, mcqId, userId, choiceId, isCorrect] = values as [
		string,
		string,
		string,
		string,
		number,
	];
	attempts.push({
		id,
		mcq_id: mcqId,
		user_id: userId,
		choice_id: choiceId,
		is_correct: Number(isCorrect),
	});
}

function createMockDb() {
	return {
		prepare(sql: string) {
			return {
				bind(...values: unknown[]) {
					return createStatement(sql, values);
				},
			};
		},
		async batch(statements: Array<{ run: () => Promise<unknown> }>) {
			const results = [];
			for (const statement of statements) {
				results.push(await statement.run());
			}
			return results;
		},
	};
}

vi.mock("server-only", () => ({}));

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: createMockDb() },
	})),
}));

import {
	createMcq,
	deleteMcq,
	getMcq,
	listMcqs,
	McqChoiceMismatchError,
	McqNotFoundError,
	McqUserNotFoundError,
	McqValidationError,
	recordAttempt,
	updateMcq,
} from "@/lib/services/mcq";

const teacherId = "teacher-1";

const twoChoices = [
	{ text: "Mercury", isCorrect: true },
	{ text: "Venus", isCorrect: false },
];

const validInput = {
	name: "Closest planet",
	question: "Which planet is closest to the Sun?",
	createdByUserId: teacherId,
	choices: twoChoices,
};

describe("mcq service", () => {
	beforeEach(() => {
		mcqs.length = 0;
		choices.length = 0;
		attempts.length = 0;
		users.length = 0;
		clock.seq = 0;
		users.push({ id: teacherId });
		vi.clearAllMocks();
	});

	it("creates a question and persists its choices with positions", async () => {
		const created = await createMcq(validInput);

		expect(created).toMatchObject({
			name: "Closest planet",
			question: "Which planet is closest to the Sun?",
			createdByUserId: teacherId,
		});
		expect(created.id).toEqual(expect.any(String));
		expect(created.choices).toEqual([
			expect.objectContaining({ text: "Mercury", isCorrect: true, position: 0 }),
			expect.objectContaining({ text: "Venus", isCorrect: false, position: 1 }),
		]);

		const stored = await getMcq(created.id);
		expect(stored?.choices.map((choice) => choice.text)).toEqual(["Mercury", "Venus"]);
	});

	it("rejects fewer than 2 choices, more than 6, or a correct count other than 1", async () => {
		await expect(
			createMcq({ ...validInput, choices: [{ text: "Only one", isCorrect: true }] }),
		).rejects.toBeInstanceOf(McqValidationError);

		await expect(
			createMcq({
				...validInput,
				choices: [
					{ text: "A", isCorrect: true },
					{ text: "B", isCorrect: false },
					{ text: "C", isCorrect: false },
					{ text: "D", isCorrect: false },
					{ text: "E", isCorrect: false },
					{ text: "F", isCorrect: false },
					{ text: "G", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);

		await expect(
			createMcq({
				...validInput,
				choices: [
					{ text: "Mercury", isCorrect: false },
					{ text: "Venus", isCorrect: false },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);

		await expect(
			createMcq({
				...validInput,
				choices: [
					{ text: "Mercury", isCorrect: true },
					{ text: "Venus", isCorrect: true },
				],
			}),
		).rejects.toBeInstanceOf(McqValidationError);

		expect(mcqs).toHaveLength(0);
		expect(choices).toHaveLength(0);
	});

	it("rejects create when the author does not exist", async () => {
		await expect(
			createMcq({ ...validInput, createdByUserId: "missing-user" }),
		).rejects.toBeInstanceOf(McqUserNotFoundError);

		expect(mcqs).toHaveLength(0);
	});

	it("lists summaries with choiceCount, newest first", async () => {
		const first = await createMcq(validInput);
		const second = await createMcq({
			...validInput,
			name: "Largest planet",
			question: "Which planet is the largest?",
			choices: [
				{ text: "Jupiter", isCorrect: true },
				{ text: "Saturn", isCorrect: false },
				{ text: "Earth", isCorrect: false },
			],
		});

		const listed = await listMcqs();

		expect(listed).toHaveLength(2);
		expect(listed[0]).toMatchObject({
			id: second.id,
			name: "Largest planet",
			question: "Which planet is the largest?",
			choiceCount: 3,
		});
		expect(listed[1]).toMatchObject({
			id: first.id,
			name: "Closest planet",
			choiceCount: 2,
		});
		expect(listed[0]).not.toHaveProperty("choices");
	});

	it("returns a question with choices ordered by position, or null when missing", async () => {
		const created = await createMcq({
			...validInput,
			choices: [
				{ text: "First", isCorrect: false },
				{ text: "Second", isCorrect: true },
				{ text: "Third", isCorrect: false },
			],
		});

		const found = await getMcq(created.id);
		expect(found?.choices.map((choice) => choice.text)).toEqual([
			"First",
			"Second",
			"Third",
		]);
		expect(found?.choices.map((choice) => choice.position)).toEqual([0, 1, 2]);

		await expect(getMcq("missing-id")).resolves.toBeNull();
	});

	it("replaces the choice set on update", async () => {
		const created = await createMcq(validInput);

		const updated = await updateMcq(created.id, {
			name: "Closest planet (edited)",
			question: "Which planet orbits nearest the Sun?",
			choices: [
				{ text: "Mercury", isCorrect: true },
				{ text: "Mars", isCorrect: false },
				{ text: "Earth", isCorrect: false },
			],
		});

		expect(updated).toMatchObject({
			id: created.id,
			name: "Closest planet (edited)",
			question: "Which planet orbits nearest the Sun?",
		});
		expect(updated.choices.map((choice) => choice.text)).toEqual([
			"Mercury",
			"Mars",
			"Earth",
		]);
		expect(updated.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);

		const stored = await getMcq(created.id);
		expect(stored?.choices).toHaveLength(3);
		expect(choices.filter((choice) => choice.mcq_id === created.id)).toHaveLength(3);
	});

	it("throws when updating a missing question", async () => {
		await expect(
			updateMcq("missing-id", {
				name: "Gone",
				question: "Does this exist?",
				choices: twoChoices,
			}),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("deletes a question together with its choices and attempts", async () => {
		const created = await createMcq(validInput);
		attempts.push({
			id: "attempt-1",
			mcq_id: created.id,
			user_id: teacherId,
			choice_id: created.choices[0].id,
			is_correct: 1,
		});

		await deleteMcq(created.id);

		await expect(getMcq(created.id)).resolves.toBeNull();
		expect(choices.filter((choice) => choice.mcq_id === created.id)).toHaveLength(0);
		expect(attempts.filter((attempt) => attempt.mcq_id === created.id)).toHaveLength(0);
	});

	it("throws when deleting a missing question", async () => {
		await expect(deleteMcq("missing-id")).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("records an attempt and derives correctness from the stored choice", async () => {
		const created = await createMcq(validInput);
		const wrong = created.choices.find((choice) => !choice.isCorrect);
		const right = created.choices.find((choice) => choice.isCorrect);

		const incorrect = await recordAttempt({
			mcqId: created.id,
			userId: teacherId,
			choiceId: wrong!.id,
		});
		const correct = await recordAttempt({
			mcqId: created.id,
			userId: teacherId,
			choiceId: right!.id,
		});

		expect(incorrect).toMatchObject({
			mcqId: created.id,
			choiceId: wrong!.id,
			isCorrect: false,
		});
		expect(correct.isCorrect).toBe(true);
		expect(attempts).toHaveLength(2);
		expect(attempts[0].is_correct).toBe(0);
		expect(attempts[1].is_correct).toBe(1);
	});

	it("rejects a choice that belongs to a different question", async () => {
		const first = await createMcq(validInput);
		const second = await createMcq({
			...validInput,
			name: "Largest planet",
			question: "Which planet is the largest?",
		});

		await expect(
			recordAttempt({
				mcqId: first.id,
				userId: teacherId,
				choiceId: second.choices[0].id,
			}),
		).rejects.toBeInstanceOf(McqChoiceMismatchError);

		expect(attempts).toHaveLength(0);
	});

	it("rejects an attempt from an unknown user", async () => {
		const created = await createMcq(validInput);

		await expect(
			recordAttempt({
				mcqId: created.id,
				userId: "missing-user",
				choiceId: created.choices[0].id,
			}),
		).rejects.toBeInstanceOf(McqUserNotFoundError);

		expect(attempts).toHaveLength(0);
	});

	it("rejects an attempt against a missing question", async () => {
		await expect(
			recordAttempt({
				mcqId: "missing-mcq",
				userId: teacherId,
				choiceId: "choice-1",
			}),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});
});
