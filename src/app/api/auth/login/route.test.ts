// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findUserByUsername } from "@/lib/services/user";
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
	username: "jane@school.edu",
	password: passwordHash,
};

const storedUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
	passwordHash,
};

function loginRequest(body: unknown) {
	return new Request("http://localhost/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.mocked(findUserByUsername).mockReset();
	});

	it("returns 200 and a public user when the username and hash match", async () => {
		vi.mocked(findUserByUsername).mockResolvedValue(storedUser);

		const response = await POST(loginRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			id: "user-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "jane@school.edu",
			email: "jane@school.edu",
		});
		expect(body).not.toHaveProperty("passwordHash");
		expect(body).not.toHaveProperty("password_hash");
	});

	it.each([
		[{ username: "", password: passwordHash }, "missing username"],
		[{ username: "jane@school.edu", password: "short" }, "password not a 64-char hex digest"],
	])("returns 400 for %s", async (invalidBody) => {
		const response = await POST(loginRequest(invalidBody));

		expect(response.status).toBe(400);
		expect(findUserByUsername).not.toHaveBeenCalled();
	});

	it("returns the same 401 for an unknown username and a wrong password", async () => {
		vi.mocked(findUserByUsername).mockResolvedValueOnce(null);

		const unknownUser = await POST(loginRequest(validBody));
		const unknownBody = await unknownUser.json();

		vi.mocked(findUserByUsername).mockResolvedValueOnce({
			...storedUser,
			passwordHash: "b".repeat(64),
		});

		const wrongPassword = await POST(loginRequest(validBody));
		const wrongPasswordBody = await wrongPassword.json();

		expect(unknownUser.status).toBe(401);
		expect(wrongPassword.status).toBe(401);
		expect(unknownBody).toEqual(wrongPasswordBody);
		expect(unknownBody).toEqual({ error: "Invalid username or password" });
	});
});
