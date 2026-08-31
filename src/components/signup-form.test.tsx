import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/hash-password";
import { getCurrentUser } from "@/lib/current-user";
import { SignupForm } from "./signup-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

const valid = {
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
	password: "password123",
};

async function fillValidForm(
	user: ReturnType<typeof userEvent.setup>,
	overrides: Partial<typeof valid & { confirmPassword: string }> = {},
) {
	const values = { confirmPassword: valid.password, ...valid, ...overrides };
	await user.type(screen.getByLabelText(/first name/i), values.firstName);
	await user.type(screen.getByLabelText(/last name/i), values.lastName);
	await user.type(screen.getByLabelText(/^username$/i), values.username);
	await user.type(screen.getByLabelText(/^email$/i), values.email);
	await user.type(screen.getByLabelText(/^password$/i), values.password);
	await user.type(screen.getByLabelText(/confirm password/i), values.confirmPassword);
}

describe("SignupForm", () => {
	beforeEach(() => {
		push.mockReset();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it("renders first name, last name, username, email, password, and confirm password", () => {
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeTruthy();
		expect(screen.getByLabelText(/last name/i)).toBeTruthy();
		expect(screen.getByLabelText(/^username$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^password$/i)).toBeTruthy();
		expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
	});

	it("does not submit when confirm password does not match", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		render(<SignupForm />);

		await fillValidForm(user, { confirmPassword: "different-password" });
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toBeTruthy();
	});

	it("POSTs a SHA-256 password hash and navigates to /mcqs on 201", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({
				id: "user-1",
				firstName: "Jane",
				lastName: "Doe",
				username: "jane@school.edu",
				email: "jane@school.edu",
			}),
		});
		vi.stubGlobal("fetch", fetchMock);
		render(<SignupForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/auth/register");
		expect(init.method).toBe("POST");
		const body = JSON.parse(String(init.body)) as Record<string, string>;
		expect(body.password).toBe(await hashPassword(valid.password));
		expect(body.password).not.toBe(valid.password);
		expect(body).toMatchObject({
			firstName: "Jane",
			lastName: "Doe",
			username: "jane@school.edu",
			email: "jane@school.edu",
		});
		expect(push).toHaveBeenCalledWith("/mcqs");
		expect(getCurrentUser()).toMatchObject({ id: "user-1", username: "jane@school.edu" });
	});

	it("shows a form-level error on 409", async () => {
		const user = userEvent.setup();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 409,
				json: async () => ({ error: "Username or email already exists" }),
			}),
		);
		render(<SignupForm />);

		await fillValidForm(user);
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByRole("alert")).toBeTruthy();
		expect((await screen.findByRole("alert")).textContent).toMatch(
			/username or email already exists/i,
		);
		expect(push).not.toHaveBeenCalled();
	});
});
