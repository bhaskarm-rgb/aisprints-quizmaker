// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createMcq,
	listMcqs,
	McqUserNotFoundError,
} from "@/lib/services/mcq";
import { GET, POST } from "./handler";

vi.mock("@/lib/services/mcq", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq")>();
	return {
		...actual,
		createMcq: vi.fn(),
		listMcqs: vi.fn(),
		getMcq: vi.fn(),
		updateMcq: vi.fn(),
		deleteMcq: vi.fn(),
	};
});

const validBody = {
	name: "Closest planet",
	question: "Which planet is closest to the Sun?",
	userId: "user-1",
	choices: [
		{ text: "Mercury", isCorrect: true },
		{ text: "Venus", isCorrect: false },
	],
};

const createdMcq = {
	id: "mcq-1",
	name: validBody.name,
	question: validBody.question,
	createdByUserId: validBody.userId,
	createdAt: "2026-08-30T12:00:00.000Z",
	updatedAt: "2026-08-30T12:00:00.000Z",
	choices: [
		{ id: "c1", text: "Mercury", isCorrect: true, position: 0 },
		{ id: "c2", text: "Venus", isCorrect: false, position: 1 },
	],
};

const summaries = [
	{
		id: "mcq-1",
		name: "Closest planet",
		question: "Which planet is closest to the Sun?",
		choiceCount: 2,
		createdAt: "2026-08-30T12:00:00.000Z",
		updatedAt: "2026-08-30T12:00:00.000Z",
	},
];

function postRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/mcqs", () => {
	beforeEach(() => {
		vi.mocked(listMcqs).mockReset();
	});

	it("returns 200 with a list of question summaries", async () => {
		vi.mocked(listMcqs).mockResolvedValue(summaries);

		const response = await GET(new Request("http://localhost/api/mcqs"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ mcqs: summaries });
	});
});

describe("POST /api/mcqs", () => {
	beforeEach(() => {
		vi.mocked(createMcq).mockReset();
	});

	it("creates a question and returns 201", async () => {
		vi.mocked(createMcq).mockResolvedValue(createdMcq);

		const response = await POST(postRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual(createdMcq);
		expect(createMcq).toHaveBeenCalledWith({
			name: validBody.name,
			question: validBody.question,
			createdByUserId: validBody.userId,
			choices: validBody.choices,
		});
	});

	it.each([
		[{ ...validBody, name: "" }, "empty name"],
		[{ ...validBody, question: "" }, "empty question"],
		[{ ...validBody, choices: [{ text: "Only one", isCorrect: true }] }, "fewer than 2 choices"],
		[
			{
				...validBody,
				choices: [
					{ text: "A", isCorrect: true },
					{ text: "B", isCorrect: false },
					{ text: "C", isCorrect: false },
					{ text: "D", isCorrect: false },
					{ text: "E", isCorrect: false },
					{ text: "F", isCorrect: false },
					{ text: "G", isCorrect: false },
				],
			},
			"more than 6 choices",
		],
		[
			{
				...validBody,
				choices: [
					{ text: "Mercury", isCorrect: false },
					{ text: "Venus", isCorrect: false },
				],
			},
			"no correct choice",
		],
		[{ ...validBody, choices: [{ text: "", isCorrect: true }, { text: "Venus", isCorrect: false }] }, "empty choice text"],
	])("returns 400 and does not create for %s", async (invalidBody) => {
		const response = await POST(postRequest(invalidBody));

		expect(response.status).toBe(400);
		expect(createMcq).not.toHaveBeenCalled();
	});

	it("returns 404 when the user does not exist", async () => {
		vi.mocked(createMcq).mockRejectedValue(new McqUserNotFoundError());

		const response = await POST(postRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "User not found" });
	});
});
