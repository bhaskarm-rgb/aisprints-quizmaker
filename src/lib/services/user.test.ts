// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

const { users } = vi.hoisted(() => ({
	users: [] as UserRow[],
}));

function createMockDb() {
	return {
		prepare(sql: string) {
			return {
				bind(...values: unknown[]) {
					const statement = {
						async all<T>() {
							if (/INSERT\s+INTO\s+users/i.test(sql)) {
								insertUser(values);
								const row = users[users.length - 1];
								return { results: [row] as T[] };
							}

							if (/UPDATE\s+users/i.test(sql)) {
								const [firstName, lastName, id] = values as string[];
								const row = users.find((user) => user.id === id);
								if (row) {
									row.first_name = firstName;
									row.last_name = lastName;
									row.updated_at = new Date().toISOString();
								}
								return { results: row ? [row as T] : [] };
							}

							if (/DELETE\s+FROM\s+users/i.test(sql)) {
								const [id] = values as string[];
								const index = users.findIndex((user) => user.id === id);
								if (index >= 0) {
									users.splice(index, 1);
								}
								return { results: [] as T[] };
							}

							if (/SELECT\s+/i.test(sql) && /WHERE\s+username\s*=/i.test(sql)) {
								const [username] = values as string[];
								const row = users.find((user) => user.username === username);
								return { results: row ? [row as T] : [] };
							}

							if (/SELECT\s+/i.test(sql) && /WHERE\s+id\s*=/i.test(sql)) {
								const [id] = values as string[];
								const row = users.find((user) => user.id === id);
								return { results: row ? [row as T] : [] };
							}

							return { results: [] as T[] };
						},
						async run() {
							const before = users.length;
							await statement.all();
							const after = users.length;
							let changes = 0;
							if (/INSERT\s+INTO\s+users/i.test(sql)) {
								changes = after > before ? 1 : 0;
							} else if (/DELETE\s+FROM\s+users/i.test(sql)) {
								changes = before > after ? 1 : 0;
							} else if (/UPDATE\s+users/i.test(sql)) {
								changes = 1;
							}
							return { success: true, meta: { changes } };
						},
					};

					return statement;
				},
			};
		},
	};
}

function insertUser(values: unknown[]) {
	const [id, firstName, lastName, username, email, passwordHash] = values as string[];
	const conflict = users.some(
		(user) => user.username === username || user.email === email,
	);
	if (conflict) {
		throw new Error("D1_ERROR: UNIQUE constraint failed: users.username");
	}

	const now = new Date().toISOString();
	users.push({
		id,
		first_name: firstName,
		last_name: lastName,
		username,
		email,
		password_hash: passwordHash,
		created_at: now,
		updated_at: now,
	});
}

vi.mock("server-only", () => ({}));

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: createMockDb() },
	})),
}));

import {
	createUser,
	deleteUser,
	findUserByUsername,
	updateUser,
	UserConflictError,
	UserNotFoundError,
} from "@/lib/services/user";

const jane = {
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
	passwordHash: "a".repeat(64),
};

describe("user service", () => {
	beforeEach(() => {
		users.length = 0;
		vi.clearAllMocks();
	});

	it("creates a user, persists the password hash, and returns a public user", async () => {
		const created = await createUser(jane);

		expect(created).toMatchObject({
			firstName: "Jane",
			lastName: "Doe",
			username: "jane@school.edu",
			email: "jane@school.edu",
		});
		expect(created.id).toEqual(expect.any(String));
		expect(created).not.toHaveProperty("passwordHash");
		expect(created).not.toHaveProperty("password_hash");

		const stored = await findUserByUsername("jane@school.edu");
		expect(stored?.passwordHash).toBe(jane.passwordHash);
	});

	it("allows username and email to be the same value on one user", async () => {
		const created = await createUser(jane);

		expect(created.username).toBe(created.email);
	});

	it("rejects a duplicate username or email with UserConflictError", async () => {
		await createUser(jane);

		await expect(
			createUser({
				...jane,
				email: "other@school.edu",
			}),
		).rejects.toBeInstanceOf(UserConflictError);

		await expect(
			createUser({
				...jane,
				username: "other-jane",
				email: "jane@school.edu",
			}),
		).rejects.toBeInstanceOf(UserConflictError);
	});

	it("finds a user by username including the hash, or returns null", async () => {
		await createUser(jane);

		const found = await findUserByUsername("jane@school.edu");
		expect(found).toMatchObject({
			firstName: "Jane",
			username: "jane@school.edu",
			passwordHash: jane.passwordHash,
		});

		await expect(findUserByUsername("missing")).resolves.toBeNull();
	});

	it("updates name fields and returns a public user", async () => {
		const created = await createUser(jane);

		const updated = await updateUser(created.id, {
			firstName: "Janet",
			lastName: "Smith",
		});

		expect(updated).toMatchObject({
			id: created.id,
			firstName: "Janet",
			lastName: "Smith",
			username: "jane@school.edu",
		});
		expect(updated).not.toHaveProperty("passwordHash");

		const stored = await findUserByUsername("jane@school.edu");
		expect(stored?.firstName).toBe("Janet");
		expect(stored?.lastName).toBe("Smith");
	});

	it("throws when updating a missing user", async () => {
		await expect(
			updateUser("missing-id", { firstName: "Janet", lastName: "Smith" }),
		).rejects.toBeInstanceOf(UserNotFoundError);
	});

	it("deletes a user so a later find returns null", async () => {
		const created = await createUser(jane);

		await deleteUser(created.id);

		await expect(findUserByUsername("jane@school.edu")).resolves.toBeNull();
	});
});
