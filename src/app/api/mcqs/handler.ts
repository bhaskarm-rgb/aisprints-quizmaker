import { NextResponse } from "next/server";
import { createMcqBodySchema } from "@/lib/mcq/schemas";
import {
	createMcq,
	listMcqs,
	McqUserNotFoundError,
	McqValidationError,
} from "@/lib/services/mcq";

export async function GET(_request: Request) {
	try {
		const mcqs = await listMcqs();
		return NextResponse.json({ mcqs });
	} catch {
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	const parsed = createMcqBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const mcq = await createMcq({
			name: parsed.data.name,
			question: parsed.data.question,
			createdByUserId: parsed.data.userId,
			choices: parsed.data.choices,
		});
		return NextResponse.json(mcq, { status: 201 });
	} catch (error) {
		if (error instanceof McqUserNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}
		if (error instanceof McqValidationError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
