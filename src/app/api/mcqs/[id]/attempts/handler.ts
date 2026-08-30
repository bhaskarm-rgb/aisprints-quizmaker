import { NextResponse } from "next/server";
import { recordAttemptBodySchema } from "@/lib/mcq/schemas";
import {
	McqChoiceMismatchError,
	McqNotFoundError,
	McqUserNotFoundError,
	recordAttempt,
} from "@/lib/services/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
	const { id } = await context.params;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	const parsed = recordAttemptBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const attempt = await recordAttempt({
			mcqId: id,
			userId: parsed.data.userId,
			choiceId: parsed.data.choiceId,
		});
		return NextResponse.json(attempt, { status: 201 });
	} catch (error) {
		if (error instanceof McqChoiceMismatchError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		if (error instanceof McqNotFoundError || error instanceof McqUserNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
