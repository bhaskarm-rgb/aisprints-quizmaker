// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, UserConflictError } from "@/lib/services/user";
import { POST } from "./handler";

vi.mock("@/lib/services/user", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user")>();
	return {
		...actual,
		createUser: vi.fn(),
		findUserByUsername: vi.fn(),
	};
});

const passwordHash = "a".repeat(64);

const validBody = {
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
	password: passwordHash,
};

const publicUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
};

function registerRequest(body: unknown) {
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.mocked(createUser).mockReset();
	});

	it("creates a user and returns 201 without a password hash", async () => {
		vi.mocked(createUser).mockResolvedValue(publicUser);

		const response = await POST(registerRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual(publicUser);
		expect(body).not.toHaveProperty("passwordHash");
		expect(body).not.toHaveProperty("password_hash");
		expect(createUser).toHaveBeenCalledWith({
			firstName: "Jane",
			lastName: "Doe",
			username: "jane@school.edu",
			email: "jane@school.edu",
			passwordHash,
		});
	});

	it.each([
		[{ ...validBody, firstName: "" }, "empty first name"],
		[{ ...validBody, email: "not-an-email" }, "invalid email"],
		[{ ...validBody, password: "plaintext-password" }, "password not a 64-char hex digest"],
	])("returns 400 and does not create a user for %s", async (invalidBody) => {
		const response = await POST(registerRequest(invalidBody));

		expect(response.status).toBe(400);
		expect(createUser).not.toHaveBeenCalled();
	});

	it("returns 409 when the username or email already exists", async () => {
		vi.mocked(createUser).mockRejectedValue(new UserConflictError());

		const response = await POST(registerRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body).toEqual({ error: "Username or email already exists" });
	});
});
