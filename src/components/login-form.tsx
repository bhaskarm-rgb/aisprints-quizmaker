"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hashPassword } from "@/lib/hash-password";
import { loginFormSchema } from "@/lib/auth/schemas";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const form = new FormData(event.currentTarget);
		const parsed = loginFormSchema.safeParse({
			username: String(form.get("username") ?? ""),
			password: String(form.get("password") ?? ""),
		});

		if (!parsed.success) {
			setFormError("Please check your username and password.");
			return;
		}

		setPending(true);
		try {
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: parsed.data.username,
					password: await hashPassword(parsed.data.password),
				}),
			});

			if (response.status === 200) {
				router.push("/mcqs");
				return;
			}

			if (response.status === 401) {
				setFormError("Invalid username or password");
				return;
			}

			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			setFormError(body?.error ?? "Something went wrong");
		} finally {
			setPending(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>
						Enter your username below to login to your account
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							{formError ? <FieldError errors={[{ message: formError }]} /> : null}
							<Field>
								<FieldLabel htmlFor="username">Username</FieldLabel>
								<Input
									id="username"
									name="username"
									type="text"
									placeholder="jane@school.edu"
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input id="password" name="password" type="password" required />
							</Field>
							<Field>
								<Button type="submit" disabled={pending}>
									Login
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account? <Link href="/register">Sign up</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
