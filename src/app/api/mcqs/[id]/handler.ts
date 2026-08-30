import { NextResponse } from "next/server";
import { updateMcqBodySchema } from "@/lib/mcq/schemas";
import {
	deleteMcq,
	getMcq,
	McqNotFoundError,
	McqValidationError,
	updateMcq,
} from "@/lib/services/mcq";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		const mcq = await getMcq(id);
		if (!mcq) {
			return NextResponse.json({ error: "Question not found" }, { status: 404 });
		}
		return NextResponse.json(mcq);
	} catch {
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}

export async function PUT(request: Request, context: RouteContext) {
	const { id } = await context.params;

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	const parsed = updateMcqBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const mcq = await updateMcq(id, {
			name: parsed.data.name,
			question: parsed.data.question,
			choices: parsed.data.choices,
		});
		return NextResponse.json(mcq);
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}
		if (error instanceof McqValidationError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}

export async function DELETE(_request: Request, context: RouteContext) {
	const { id } = await context.params;

	try {
		await deleteMcq(id);
		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ error: error.message }, { status: 404 });
		}
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
