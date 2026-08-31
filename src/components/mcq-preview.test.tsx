import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrentUser } from "@/lib/current-user";
import { McqPreview } from "./mcq-preview";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

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

function submitButton() {
	return screen.getByRole("button", { name: /^submit$/i }) as HTMLButtonElement;
}

describe("McqPreview", () => {
	beforeEach(() => {
		push.mockReset();
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

	it("shows Submit and Back to questions on launch", () => {
		render(<McqPreview mcq={mcq} />);

		expect(submitButton()).toBeTruthy();
		expect(screen.getByRole("button", { name: /back to questions/i })).toBeTruthy();
	});

	it("keeps Submit disabled until a choice is selected", () => {
		render(<McqPreview mcq={mcq} />);

		expect(submitButton().disabled).toBe(true);
	});

	it("navigates to the question bank from Back to questions without posting", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		render(<McqPreview mcq={mcq} />);

		await user.click(screen.getByRole("button", { name: /back to questions/i }));

		expect(push).toHaveBeenCalledWith("/mcqs");
		expect(fetchMock).not.toHaveBeenCalled();
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
		expect(submitButton().disabled).toBe(false);

		await user.click(submitButton());

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs/mcq-1/attempts");
		expect(init.method).toBe("POST");
		expect(JSON.parse(String(init.body))).toEqual({
			userId: "user-1",
			choiceId: "choice-1",
		});
		expect(await screen.findByText(/^incorrect$/i)).toBeTruthy();
		expect(submitButton().disabled).toBe(true);
	});

	it("lets the user change choice and submit again", async () => {
		const user = userEvent.setup();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({
					id: "attempt-1",
					mcqId: "mcq-1",
					choiceId: "choice-1",
					isCorrect: false,
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 201,
				json: async () => ({
					id: "attempt-2",
					mcqId: "mcq-1",
					choiceId: "choice-2",
					isCorrect: true,
				}),
			});
		vi.stubGlobal("fetch", fetchMock);
		render(<McqPreview mcq={mcq} />);

		await user.click(screen.getByRole("radio", { name: /mercury/i }));
		await user.click(submitButton());
		expect(await screen.findByText(/^incorrect$/i)).toBeTruthy();
		expect(submitButton().disabled).toBe(true);

		await user.click(screen.getByRole("radio", { name: /venus/i }));
		expect(screen.queryByText(/^incorrect$/i)).toBeNull();
		expect(submitButton().disabled).toBe(false);

		await user.click(submitButton());
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))).toEqual({
			userId: "user-1",
			choiceId: "choice-2",
		});
		expect(await screen.findByText(/^correct$/i)).toBeTruthy();
		expect(submitButton().disabled).toBe(true);
	});
});
