"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { registerFormSchema } from "@/lib/auth/schemas";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [formError, setFormError] = useState<string | null>(null);
	const [confirmError, setConfirmError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		setConfirmError(null);

		const form = new FormData(event.currentTarget);
		const parsed = registerFormSchema.safeParse({
			firstName: String(form.get("firstName") ?? ""),
			lastName: String(form.get("lastName") ?? ""),
			username: String(form.get("username") ?? ""),
			email: String(form.get("email") ?? ""),
			password: String(form.get("password") ?? ""),
			confirmPassword: String(form.get("confirmPassword") ?? ""),
		});

		if (!parsed.success) {
			const confirmIssue = parsed.error.issues.find(
				(issue) => issue.path[0] === "confirmPassword",
			);
			setConfirmError(confirmIssue?.message ?? "Please check the form fields.");
			return;
		}

		setPending(true);
		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: parsed.data.firstName,
					lastName: parsed.data.lastName,
					username: parsed.data.username,
					email: parsed.data.email,
					password: await hashPassword(parsed.data.password),
				}),
			});

			if (response.status === 201) {
				router.push("/mcqs");
				return;
			}

			const body = (await response.json().catch(() => null)) as { error?: string } | null;
			setFormError(body?.error ?? "Something went wrong");
		} finally {
			setPending(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>
					Enter your information below to create your account
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						{formError ? <FieldError errors={[{ message: formError }]} /> : null}
						<Field>
							<FieldLabel htmlFor="first-name">First Name</FieldLabel>
							<Input
								id="first-name"
								name="firstName"
								type="text"
								placeholder="Jane"
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="last-name">Last Name</FieldLabel>
							<Input
								id="last-name"
								name="lastName"
								type="text"
								placeholder="Doe"
								required
							/>
						</Field>
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
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="m@example.com"
								required
							/>
							<FieldDescription>
								We&apos;ll use this to contact you. We will not share your email
								with anyone else.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input id="password" name="password" type="password" required />
							<FieldDescription>Must be at least 8 characters long.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
							<Input
								id="confirm-password"
								name="confirmPassword"
								type="password"
								required
							/>
							<FieldDescription>Please confirm your password.</FieldDescription>
							{confirmError ? <FieldError errors={[{ message: confirmError }]} /> : null}
						</Field>
						<FieldGroup>
							<Field>
								<Button type="submit" disabled={pending}>
									Create Account
								</Button>
								<FieldDescription className="px-6 text-center">
									Already have an account? <Link href="/login">Sign in</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
