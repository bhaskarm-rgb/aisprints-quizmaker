import { NextResponse } from "next/server";
import { loginBodySchema } from "@/lib/auth/schemas";
import { findUserByUsername } from "@/lib/services/user";

const invalidCredentials = { error: "Invalid username or password" };

export async function POST(request: Request) {
	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	const parsed = loginBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Validation failed" }, { status: 400 });
	}

	try {
		const user = await findUserByUsername(parsed.data.username);
		if (!user || user.passwordHash !== parsed.data.password) {
			return NextResponse.json(invalidCredentials, { status: 401 });
		}

		return NextResponse.json({
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			username: user.username,
			email: user.email,
		});
	} catch {
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
