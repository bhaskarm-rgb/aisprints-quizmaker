import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrentUser } from "@/lib/current-user";
import { McqPreview } from "./mcq-preview";

const teacher = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
};

const mcq = {
	id: "mcq-1",
	name: "Closest planet",
	question: "Which planet is closest to the Sun?",
	choices: [
		{ id: "choice-1", text: "Mercury", isCorrect: true },
		{ id: "choice-2", text: "Venus", isCorrect: false },
	],
};

describe("McqPreview", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		window.localStorage.clear();
		setCurrentUser(teacher);
	});

	it("renders the question prompt and choices without revealing the answer", () => {
		render(<McqPreview mcq={mcq} />);

		expect(screen.getByText("Which planet is closest to the Sun?")).toBeTruthy();
		expect(screen.getByRole("radio", { name: /mercury/i })).toBeTruthy();
		expect(screen.getByRole("radio", { name: /venus/i })).toBeTruthy();
		expect(screen.queryByText(/closest planet/i)).toBeNull();
		expect(screen.queryByText(/correct/i)).toBeNull();
		expect(screen.queryByText(/incorrect/i)).toBeNull();
	});

	it("keeps Submit disabled until a choice is selected", () => {
		render(<McqPreview mcq={mcq} />);

		expect((screen.getByRole("button", { name: /^submit$/i }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("POSTs userId and choiceId, then shows the server result even when the first option is marked correct in the payload", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({
				id: "attempt-1",
				mcqId: "mcq-1",
				choiceId: "choice-1",
				isCorrect: false,
			}),
		});
		vi.stubGlobal("fetch", fetchMock);
		render(<McqPreview mcq={mcq} />);

		await user.click(screen.getByRole("radio", { name: /mercury/i }));
		expect((screen.getByRole("button", { name: /^submit$/i }) as HTMLButtonElement).disabled).toBe(
			false,
		);

		await user.click(screen.getByRole("button", { name: /^submit$/i }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs/mcq-1/attempts");
		expect(init.method).toBe("POST");
		expect(JSON.parse(String(init.body))).toEqual({
			userId: "user-1",
			choiceId: "choice-1",
		});
		expect(await screen.findByText(/incorrect/i)).toBeTruthy();
		expect(screen.getByRole("link", { name: /back to question bank/i }).getAttribute("href")).toBe(
			"/mcqs",
		);
	});
});
