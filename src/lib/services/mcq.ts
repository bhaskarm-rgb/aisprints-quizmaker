import { getCloudflareContext } from "@opennextjs/cloudflare";

export class McqValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqValidationError";
	}
}

export class McqNotFoundError extends Error {
	constructor(message = "Question not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class McqUserNotFoundError extends Error {
	constructor(message = "User not found") {
		super(message);
		this.name = "McqUserNotFoundError";
	}
}

export class McqChoiceMismatchError extends Error {
	constructor(message = "Choice does not belong to this question") {
		super(message);
		this.name = "McqChoiceMismatchError";
	}
}

export type McqChoiceInput = {
	text: string;
	isCorrect: boolean;
};

export type McqChoice = McqChoiceInput & {
	id: string;
	position: number;
};

export type Mcq = {
	id: string;
	name: string;
	question: string;
	createdByUserId: string;
	choices: McqChoice[];
	createdAt: string;
	updatedAt: string;
};

export type McqSummary = {
	id: string;
	name: string;
	question: string;
	choiceCount: number;
	createdAt: string;
	updatedAt: string;
};

export type CreateMcqInput = {
	name: string;
	question: string;
	createdByUserId: string;
	choices: McqChoiceInput[];
};

export type UpdateMcqInput = {
	name: string;
	question: string;
	choices: McqChoiceInput[];
};

export type RecordAttemptInput = {
	mcqId: string;
	userId: string;
	choiceId: string;
};

export type McqAttempt = {
	id: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
};

type McqRow = {
	id: string;
	name: string;
	question: string;
	created_by_user_id: string;
	created_at: string;
	updated_at: string;
};

type McqSummaryRow = {
	id: string;
	name: string;
	question: string;
	choice_count: number;
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

async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	return env.DB;
}

function assertValidChoices(choices: McqChoiceInput[]) {
	if (choices.length < 2 || choices.length > 6) {
		throw new McqValidationError("A question needs between 2 and 6 choices");
	}
	if (choices.filter((choice) => choice.isCorrect).length !== 1) {
		throw new McqValidationError("Exactly one choice must be correct");
	}
}

function toChoice(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		text: row.choice_text,
		isCorrect: Boolean(row.is_correct),
		position: row.position,
	};
}

function toMcq(row: McqRow, choiceRows: ChoiceRow[]): Mcq {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		choices: choiceRows.map(toChoice),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toSummary(row: McqSummaryRow): McqSummary {
	return {
		id: row.id,
		name: row.name,
		question: row.question,
		choiceCount: Number(row.choice_count),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

async function userExists(db: D1Database, userId: string): Promise<boolean> {
	const { results } = await db
		.prepare("SELECT id FROM users WHERE id = ?1")
		.bind(userId)
		.all<{ id: string }>();

	return Boolean(results[0]);
}

async function findMcqRow(db: D1Database, id: string): Promise<McqRow | null> {
	const { results } = await db
		.prepare(
			"SELECT id, name, question, created_by_user_id, created_at, updated_at FROM mcqs WHERE id = ?1",
		)
		.bind(id)
		.all<McqRow>();

	return results[0] ?? null;
}

async function findChoices(db: D1Database, mcqId: string): Promise<ChoiceRow[]> {
	const { results } = await db
		.prepare(
			"SELECT id, mcq_id, choice_text, is_correct, position FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position ASC",
		)
		.bind(mcqId)
		.all<ChoiceRow>();

	return results;
}

function choiceInserts(db: D1Database, mcqId: string, choices: McqChoiceInput[]) {
	return choices.map((choice, index) =>
		db
			.prepare(
				"INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position) VALUES (?1, ?2, ?3, ?4, ?5)",
			)
			.bind(crypto.randomUUID(), mcqId, choice.text, choice.isCorrect ? 1 : 0, index),
	);
}

async function loadMcq(db: D1Database, id: string): Promise<Mcq | null> {
	const row = await findMcqRow(db, id);
	if (!row) {
		return null;
	}

	const choiceRows = await findChoices(db, id);
	return toMcq(row, choiceRows);
}

export async function createMcq(input: CreateMcqInput): Promise<Mcq> {
	assertValidChoices(input.choices);

	const db = await getDb();

	if (!(await userExists(db, input.createdByUserId))) {
		throw new McqUserNotFoundError();
	}

	const id = crypto.randomUUID();

	await db
		.prepare(
			"INSERT INTO mcqs (id, name, question, created_by_user_id) VALUES (?1, ?2, ?3, ?4)",
		)
		.bind(id, input.name, input.question, input.createdByUserId)
		.run();

	await db.batch(choiceInserts(db, id, input.choices));

	const created = await loadMcq(db, id);
	if (!created) {
		throw new Error("Failed to load created question");
	}

	return created;
}

export async function getMcq(id: string): Promise<Mcq | null> {
	const db = await getDb();
	return loadMcq(db, id);
}

export async function listMcqs(): Promise<McqSummary[]> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			`SELECT id, name, question, created_at, updated_at,
        (SELECT COUNT(*) FROM mcq_choices WHERE mcq_choices.mcq_id = mcqs.id) AS choice_count
       FROM mcqs
       ORDER BY created_at DESC`,
		)
		.bind()
		.all<McqSummaryRow>();

	return results.map(toSummary);
}

export async function updateMcq(id: string, input: UpdateMcqInput): Promise<Mcq> {
	assertValidChoices(input.choices);

	const db = await getDb();
	const existing = await findMcqRow(db, id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	await db
		.prepare(
			"UPDATE mcqs SET name = ?1, question = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
		)
		.bind(input.name, input.question, id)
		.run();

	await db.batch([
		db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
		...choiceInserts(db, id, input.choices),
	]);

	const updated = await loadMcq(db, id);
	if (!updated) {
		throw new Error("Failed to load updated question");
	}

	return updated;
}

export async function deleteMcq(id: string): Promise<void> {
	const db = await getDb();
	const existing = await findMcqRow(db, id);
	if (!existing) {
		throw new McqNotFoundError();
	}

	await db.batch([
		db.prepare("DELETE FROM mcq_attempts WHERE mcq_id = ?1").bind(id),
		db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id),
		db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id),
	]);
}

export async function recordAttempt(input: RecordAttemptInput): Promise<McqAttempt> {
	const db = await getDb();

	const question = await findMcqRow(db, input.mcqId);
	if (!question) {
		throw new McqNotFoundError();
	}

	if (!(await userExists(db, input.userId))) {
		throw new McqUserNotFoundError();
	}

	const { results } = await db
		.prepare(
			"SELECT id, mcq_id, choice_text, is_correct, position FROM mcq_choices WHERE id = ?1",
		)
		.bind(input.choiceId)
		.all<ChoiceRow>();

	const choice = results[0];
	if (!choice || choice.mcq_id !== input.mcqId) {
		throw new McqChoiceMismatchError();
	}

	const id = crypto.randomUUID();
	const isCorrect = Boolean(choice.is_correct);

	await db
		.prepare(
			"INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, is_correct) VALUES (?1, ?2, ?3, ?4, ?5)",
		)
		.bind(id, input.mcqId, input.userId, input.choiceId, isCorrect ? 1 : 0)
		.run();

	return {
		id,
		mcqId: input.mcqId,
		choiceId: input.choiceId,
		isCorrect,
	};
}
