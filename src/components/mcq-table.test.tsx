import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McqTable } from "./mcq-table";

const questions = [
	{
		id: "mcq-1",
		name: "Closest planet",
		question: "Which planet is closest to the Sun?",
		choiceCount: 2,
		createdAt: "2026-08-30T12:00:00.000Z",
		updatedAt: "2026-08-30T12:00:00.000Z",
	},
	{
		id: "mcq-2",
		name: "Largest planet",
		question: "Which planet is the largest?",
		choiceCount: 3,
		createdAt: "2026-08-30T12:01:00.000Z",
		updatedAt: "2026-08-30T12:01:00.000Z",
	},
];

describe("McqTable", () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders a row per question with name and question text", () => {
		render(<McqTable questions={questions} />);

		expect(screen.getByText("Closest planet")).toBeTruthy();
		expect(screen.getByText("Which planet is closest to the Sun?")).toBeTruthy();
		expect(screen.getByText("Largest planet")).toBeTruthy();
		expect(screen.getByText("Which planet is the largest?")).toBeTruthy();
	});

	it("opens an actions menu with Edit, Preview, and Delete", async () => {
		const user = userEvent.setup();
		render(<McqTable questions={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for closest planet/i }));

		expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeTruthy();
	});

	it("deletes only after confirmation", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ ok: true }),
		});
		vi.stubGlobal("fetch", fetchMock);
		const onDeleted = vi.fn();
		render(<McqTable questions={questions} onDeleted={onDeleted} />);

		await user.click(screen.getByRole("button", { name: /actions for closest planet/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));

		expect(fetchMock).not.toHaveBeenCalled();

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(/closest planet/i)).toBeTruthy();

		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/mcqs/mcq-1",
				expect.objectContaining({ method: "DELETE" }),
			),
		);
		expect(onDeleted).toHaveBeenCalledWith("mcq-1");
	});

	it("does not call DELETE when confirmation is cancelled", async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		render(<McqTable questions={questions} />);

		await user.click(screen.getByRole("button", { name: /actions for closest planet/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));

		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("shows an empty state when there are no questions", () => {
		render(<McqTable questions={[]} />);

		expect(screen.getByText(/no questions yet/i)).toBeTruthy();
		expect(screen.getByRole("link", { name: /create question/i }).getAttribute("href")).toBe(
			"/mcqs/new",
		);
	});
});
