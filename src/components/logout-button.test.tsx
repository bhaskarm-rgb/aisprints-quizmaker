import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./logout-button";
import { setCurrentUser } from "@/lib/current-user";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("LogoutButton", () => {
	beforeEach(() => {
		push.mockReset();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it("POSTs /api/auth/logout then navigates to /login", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		});
		vi.stubGlobal("fetch", fetchMock);
		setCurrentUser({
			id: "user-1",
			firstName: "Jane",
			lastName: "Doe",
			username: "jane@school.edu",
			email: "jane@school.edu",
		});
		render(<LogoutButton />);

		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/auth/logout",
				expect.objectContaining({ method: "POST" }),
			),
		);
		expect(push).toHaveBeenCalledWith("/login");
		expect(window.localStorage.getItem("quizmaker.currentUser")).toBeNull();
	});
});
