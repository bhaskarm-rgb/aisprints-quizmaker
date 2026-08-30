// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMcq, getMcq, McqNotFoundError, updateMcq } from "@/lib/services/mcq";
import { DELETE, GET, PUT } from "./handler";

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

const mcqId = "mcq-1";

const storedMcq = {
	id: mcqId,
	name: "Closest planet",
	question: "Which planet is closest to the Sun?",
	createdByUserId: "user-1",
	createdAt: "2026-08-30T12:00:00.000Z",
	updatedAt: "2026-08-30T12:00:00.000Z",
	choices: [
		{ id: "c1", text: "Mercury", isCorrect: true, position: 0 },
		{ id: "c2", text: "Venus", isCorrect: false, position: 1 },
	],
};

const updateBody = {
	name: "Closest planet (edited)",
	question: "Which planet orbits nearest the Sun?",
	choices: [
		{ text: "Mercury", isCorrect: true },
		{ text: "Mars", isCorrect: false },
		{ text: "Earth", isCorrect: false },
	],
};

function context(id = mcqId) {
	return { params: Promise.resolve({ id }) };
}

function putRequest(body: unknown) {
	return new Request(`http://localhost/api/mcqs/${mcqId}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.mocked(getMcq).mockReset();
	});

	it("returns 200 with the question and its choices", async () => {
		vi.mocked(getMcq).mockResolvedValue(storedMcq);

		const response = await GET(
			new Request(`http://localhost/api/mcqs/${mcqId}`),
			context(),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(storedMcq);
		expect(getMcq).toHaveBeenCalledWith(mcqId);
	});

	it("returns 404 when the question does not exist", async () => {
		vi.mocked(getMcq).mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/mcqs/missing"),
			context("missing"),
		);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "Question not found" });
	});
});

describe("PUT /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.mocked(updateMcq).mockReset();
	});

	it("updates a question and returns 200", async () => {
		vi.mocked(updateMcq).mockResolvedValue({
			...storedMcq,
			name: updateBody.name,
			question: updateBody.question,
			choices: [
				{ id: "c3", text: "Mercury", isCorrect: true, position: 0 },
				{ id: "c4", text: "Mars", isCorrect: false, position: 1 },
				{ id: "c5", text: "Earth", isCorrect: false, position: 2 },
			],
		});

		const response = await PUT(putRequest(updateBody), context());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.name).toBe(updateBody.name);
		expect(updateMcq).toHaveBeenCalledWith(mcqId, {
			name: updateBody.name,
			question: updateBody.question,
			choices: updateBody.choices,
		});
	});

	it("returns 400 and does not update when the body is invalid", async () => {
		const response = await PUT(putRequest({ ...updateBody, name: "" }), context());

		expect(response.status).toBe(400);
		expect(updateMcq).not.toHaveBeenCalled();
	});

	it("returns 404 when the question does not exist", async () => {
		vi.mocked(updateMcq).mockRejectedValue(new McqNotFoundError());

		const response = await PUT(putRequest(updateBody), context("missing"));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "Question not found" });
	});
});

describe("DELETE /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.mocked(deleteMcq).mockReset();
	});

	it("deletes a question and returns 200", async () => {
		vi.mocked(deleteMcq).mockResolvedValue(undefined);

		const response = await DELETE(
			new Request(`http://localhost/api/mcqs/${mcqId}`, { method: "DELETE" }),
			context(),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ ok: true });
		expect(deleteMcq).toHaveBeenCalledWith(mcqId);
	});

	it("returns 404 when the question does not exist", async () => {
		vi.mocked(deleteMcq).mockRejectedValue(new McqNotFoundError());

		const response = await DELETE(
			new Request("http://localhost/api/mcqs/missing", { method: "DELETE" }),
			context("missing"),
		);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "Question not found" });
	});
});
