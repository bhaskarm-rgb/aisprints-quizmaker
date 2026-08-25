import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/hash-password";
import { LoginForm } from "./login-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("LoginForm", () => {
	beforeEach(() => {
		push.mockReset();
		vi.unstubAllGlobals();
	});

	it("POSTs a hashed password and navigates to /mcqs on 200", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				id: "user-1",
				firstName: "Jane",
				lastName: "Doe",
				username: "jane@school.edu",
				email: "jane@school.edu",
			}),
		});
		vi.stubGlobal("fetch", fetchMock);
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/auth/login");
		expect(init.method).toBe("POST");
		const body = JSON.parse(String(init.body)) as Record<string, string>;
		expect(body.username).toBe("jane@school.edu");
		expect(body.password).toBe(await hashPassword("password123"));
		expect(body.password).not.toBe("password123");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows a generic error on 401 that does not mention whether the username exists", async () => {
		const user = userEvent.setup();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				json: async () => ({ error: "Invalid username or password" }),
			}),
		);
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username/i), "jane@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toMatch(/invalid username or password/i);
		expect(alert.textContent?.toLowerCase()).not.toMatch(/not found|does not exist|no account/);
		expect(push).not.toHaveBeenCalled();
	});
});
