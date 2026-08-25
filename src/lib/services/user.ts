import { getCloudflareContext } from "@opennextjs/cloudflare";

export class UserConflictError extends Error {
	constructor(message = "Username or email already exists") {
		super(message);
		this.name = "UserConflictError";
	}
}

export class UserNotFoundError extends Error {
	constructor(message = "User not found") {
		super(message);
		this.name = "UserNotFoundError";
	}
}

export type PublicUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
};

export type UserRecord = PublicUser & {
	passwordHash: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = {
	firstName: string;
	lastName: string;
};

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash?: string;
};

async function getDb() {
	const { env } = await getCloudflareContext({ async: true });
	return env.DB;
}

function toPublicUser(row: UserRow): PublicUser {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
	};
}

function toUserRecord(row: UserRow): UserRecord {
	return {
		...toPublicUser(row),
		passwordHash: row.password_hash ?? "",
	};
}

function isUniqueConstraintError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /unique constraint failed/i.test(message);
}

async function findPublicUserById(db: D1Database, id: string): Promise<PublicUser | null> {
	const { results } = await db
		.prepare(
			"SELECT id, first_name, last_name, username, email FROM users WHERE id = ?1",
		)
		.bind(id)
		.all<UserRow>();

	const row = results[0];
	return row ? toPublicUser(row) : null;
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
	const db = await getDb();
	const id = crypto.randomUUID();

	try {
		await db
			.prepare(
				"INSERT INTO users (id, first_name, last_name, username, email, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			)
			.bind(
				id,
				input.firstName,
				input.lastName,
				input.username,
				input.email,
				input.passwordHash,
			)
			.run();
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			throw new UserConflictError();
		}
		throw error;
	}

	const created = await findPublicUserById(db, id);
	if (!created) {
		throw new Error("Failed to load created user");
	}

	return created;
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
	const db = await getDb();
	const { results } = await db
		.prepare(
			"SELECT id, first_name, last_name, username, email, password_hash FROM users WHERE username = ?1 COLLATE NOCASE OR email = ?1 COLLATE NOCASE",
		)
		.bind(username)
		.all<UserRow>();

	const row = results[0];
	return row ? toUserRecord(row) : null;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<PublicUser> {
	const db = await getDb();

	await db
		.prepare(
			"UPDATE users SET first_name = ?1, last_name = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
		)
		.bind(input.firstName, input.lastName, id)
		.run();

	const updated = await findPublicUserById(db, id);
	if (!updated) {
		throw new UserNotFoundError();
	}

	return updated;
}

export async function deleteUser(id: string): Promise<void> {
	const db = await getDb();
	const result = await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();

	if (!result.meta.changes) {
		throw new UserNotFoundError();
	}
}
