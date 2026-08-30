// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	McqChoiceMismatchError,
	McqNotFoundError,
	McqUserNotFoundError,
	recordAttempt,
} from "@/lib/services/mcq";
import { POST } from "./handler";

vi.mock("@/lib/services/mcq", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq")>();
	return {
		...actual,
		recordAttempt: vi.fn(),
	};
});

const mcqId = "mcq-1";
const validBody = {
	userId: "user-1",
	choiceId: "choice-2",
};

const recorded = {
	id: "attempt-1",
	mcqId,
	choiceId: validBody.choiceId,
	isCorrect: false,
};

function context(id = mcqId) {
	return { params: Promise.resolve({ id }) };
}

function postRequest(body: unknown) {
	return new Request(`http://localhost/api/mcqs/${mcqId}/attempts`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/mcqs/[id]/attempts", () => {
	beforeEach(() => {
		vi.mocked(recordAttempt).mockReset();
	});

	it("returns 201 with the server-scored attempt", async () => {
		vi.mocked(recordAttempt).mockResolvedValue(recorded);

		const response = await POST(postRequest(validBody), context());
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual(recorded);
		expect(recordAttempt).toHaveBeenCalledWith({
			mcqId,
			userId: validBody.userId,
			choiceId: validBody.choiceId,
		});
	});

	it("returns 400 and does not record when the body is invalid", async () => {
		const response = await POST(postRequest({ userId: "", choiceId: validBody.choiceId }), context());

		expect(response.status).toBe(400);
		expect(recordAttempt).not.toHaveBeenCalled();
	});

	it("returns 400 when the choice does not belong to the question", async () => {
		vi.mocked(recordAttempt).mockRejectedValue(new McqChoiceMismatchError());

		const response = await POST(postRequest(validBody), context());
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body).toEqual({ error: "Choice does not belong to this question" });
	});

	it("returns 404 when the question does not exist", async () => {
		vi.mocked(recordAttempt).mockRejectedValue(new McqNotFoundError());

		const response = await POST(postRequest(validBody), context("missing"));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "Question not found" });
	});

	it("returns 404 when the user does not exist", async () => {
		vi.mocked(recordAttempt).mockRejectedValue(new McqUserNotFoundError());

		const response = await POST(postRequest(validBody), context());
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body).toEqual({ error: "User not found" });
	});
});
