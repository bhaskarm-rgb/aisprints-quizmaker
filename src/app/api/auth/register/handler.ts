import { NextResponse } from "next/server";
import { registerBodySchema } from "@/lib/auth/schemas";
import { createUser, UserConflictError } from "@/lib/services/user";

export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	const parsed = registerBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const user = await createUser({
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			username: parsed.data.username,
			email: parsed.data.email,
			passwordHash: parsed.data.password,
		});
		return NextResponse.json(user, { status: 201 });
	} catch (error) {
		if (error instanceof UserConflictError) {
			return NextResponse.json({ error: error.message }, { status: 409 });
		}
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
