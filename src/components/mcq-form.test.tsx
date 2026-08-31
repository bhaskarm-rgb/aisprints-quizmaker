import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setCurrentUser } from "@/lib/current-user";
import { McqForm } from "./mcq-form";

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

async function fillValidQuestion(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText(/^name$/i), "Closest planet");
	await user.type(screen.getByLabelText(/^question$/i), "Which planet is closest to the Sun?");
	await user.type(screen.getByLabelText(/^choice 1$/i), "Mercury");
	await user.type(screen.getByLabelText(/^choice 2$/i), "Venus");
	await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
}

describe("McqForm", () => {
	beforeEach(() => {
		push.mockReset();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it("renders two empty choice rows by default", () => {
		render(<McqForm />);

		expect(screen.getByLabelText(/^choice 1$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^choice 2$/i)).toBeTruthy();
		expect(screen.queryByLabelText(/^choice 3$/i)).toBeNull();
	});

	it("adds choices up to six and cannot add a seventh", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		for (let count = 3; count <= 6; count += 1) {
			await user.click(screen.getByRole("button", { name: /add choice/i }));
			expect(screen.getByLabelText(new RegExp(`^choice ${count}$`, "i"))).toBeTruthy();
		}

		expect(
			(screen.getByRole("button", { name: /add choice/i }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(screen.queryByLabelText(/^choice 7$/i)).toBeNull();
	});

	it("cannot remove below two choices", async () => {
		const user = userEvent.setup();
		render(<McqForm />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		expect(screen.getByLabelText(/^choice 3$/i)).toBeTruthy();

		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));
		expect(screen.queryByLabelText(/^choice 3$/i)).toBeNull();

		expect(
			(screen.getByRole("button", { name: /remove choice 1/i }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(
			(screen.getByRole("button", { name: /remove choice 2/i }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect(screen.getByLabelText(/^choice 1$/i)).toBeTruthy();
		expect(screen.getByLabelText(/^choice 2$/i)).toBeTruthy();
	});

	it.each([
		["empty name", async (user: ReturnType<typeof userEvent.setup>) => {
			await user.type(screen.getByLabelText(/^question$/i), "Which planet is closest to the Sun?");
			await user.type(screen.getByLabelText(/^choice 1$/i), "Mercury");
			await user.type(screen.getByLabelText(/^choice 2$/i), "Venus");
			await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		}],
		["empty question", async (user: ReturnType<typeof userEvent.setup>) => {
			await user.type(screen.getByLabelText(/^name$/i), "Closest planet");
			await user.type(screen.getByLabelText(/^choice 1$/i), "Mercury");
			await user.type(screen.getByLabelText(/^choice 2$/i), "Venus");
			await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		}],
		["empty choice", async (user: ReturnType<typeof userEvent.setup>) => {
			await user.type(screen.getByLabelText(/^name$/i), "Closest planet");
			await user.type(screen.getByLabelText(/^question$/i), "Which planet is closest to the Sun?");
			await user.type(screen.getByLabelText(/^choice 1$/i), "Mercury");
			await user.click(screen.getByRole("radio", { name: /choice 1 is correct/i }));
		}],
		["no correct answer", async (user: ReturnType<typeof userEvent.setup>) => {
			await user.type(screen.getByLabelText(/^name$/i), "Closest planet");
			await user.type(screen.getByLabelText(/^question$/i), "Which planet is closest to the Sun?");
			await user.type(screen.getByLabelText(/^choice 1$/i), "Mercury");
			await user.type(screen.getByLabelText(/^choice 2$/i), "Venus");
		}],
	])("does not submit when %s", async (_label, fill) => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		setCurrentUser(teacher);
		render(<McqForm />);

		await fill(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetchMock).not.toHaveBeenCalled();
		expect(push).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toBeTruthy();
	});

	it("POSTs a new question with userId and navigates to /mcqs", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 201,
			json: async () => ({ id: "mcq-1" }),
		});
		vi.stubGlobal("fetch", fetchMock);
		setCurrentUser(teacher);
		render(<McqForm />);

		await fillValidQuestion(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs");
		expect(init.method).toBe("POST");
		expect(JSON.parse(String(init.body))).toEqual({
			name: "Closest planet",
			question: "Which planet is closest to the Sun?",
			userId: "user-1",
			choices: [
				{ text: "Mercury", isCorrect: true },
				{ text: "Venus", isCorrect: false },
			],
		});
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("preloads an existing question and PUTs on save", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: "mcq-1" }),
		});
		vi.stubGlobal("fetch", fetchMock);
		setCurrentUser(teacher);
		render(
			<McqForm
				mcqId="mcq-1"
				initial={{
					name: "Closest planet",
					question: "Which planet is closest to the Sun?",
					choices: [
						{ text: "Mercury", isCorrect: true },
						{ text: "Venus", isCorrect: false },
					],
				}}
			/>,
		);

		expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe("Closest planet");
		expect((screen.getByLabelText(/^question$/i) as HTMLTextAreaElement).value).toBe(
			"Which planet is closest to the Sun?",
		);

		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "Closest planet (edited)");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/mcqs/mcq-1");
		expect(init.method).toBe("PUT");
		expect(JSON.parse(String(init.body))).toMatchObject({
			name: "Closest planet (edited)",
			question: "Which planet is closest to the Sun?",
		});
		expect(JSON.parse(String(init.body))).not.toHaveProperty("userId");
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("navigates home on cancel without fetching", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		render(<McqForm />);

		await user.click(screen.getByRole("button", { name: /^cancel$/i }));

		expect(fetchMock).not.toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith("/mcqs");
	});

	it("shows an error and does not post when no user is stored", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		render(<McqForm />);

		await fillValidQuestion(user);
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toBeTruthy();
		expect(push).toHaveBeenCalledWith("/login");
	});
});
