"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/current-user";

export type McqFormChoice = {
	text: string;
	isCorrect: boolean;
};

export type McqFormInitial = {
	name: string;
	question: string;
	choices: McqFormChoice[];
};

type McqFormProps = {
	mcqId?: string;
	initial?: McqFormInitial;
};

function emptyChoices(): McqFormChoice[] {
	return [
		{ text: "", isCorrect: false },
		{ text: "", isCorrect: false },
	];
}

export function McqForm({ mcqId, initial }: McqFormProps) {
	const router = useRouter();
	const [name, setName] = useState(initial?.name ?? "");
	const [question, setQuestion] = useState(initial?.question ?? "");
	const [choices, setChoices] = useState<McqFormChoice[]>(
		initial?.choices?.length ? initial.choices : emptyChoices(),
	);
	const [formError, setFormError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const correctIndex = choices.findIndex((choice) => choice.isCorrect);

	function setChoiceText(index: number, text: string) {
		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, text } : choice,
			),
		);
	}

	function setCorrect(index: number) {
		setChoices((current) =>
			current.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === index,
			})),
		);
	}

	function addChoice() {
		if (choices.length >= 6) {
			return;
		}
		setChoices((current) => [...current, { text: "", isCorrect: false }]);
	}

	function removeChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}
		setChoices((current) => current.filter((_, choiceIndex) => choiceIndex !== index));
	}

	function validate(): string | null {
		if (name.trim().length === 0) {
			return "Name is required.";
		}
		if (question.trim().length === 0) {
			return "Question is required.";
		}
		if (choices.some((choice) => choice.text.trim().length === 0)) {
			return "Every choice needs text.";
		}
		if (choices.filter((choice) => choice.isCorrect).length !== 1) {
			return "Exactly one choice must be correct.";
		}
		return null;
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		const validationError = validate();
		if (validationError) {
			setFormError(validationError);
			return;
		}

		const user = getCurrentUser();
		if (!user) {
			setFormError("You need to log in before saving a question.");
			router.push("/login");
			return;
		}

		setPending(true);
		try {
			const payload = {
				name: name.trim(),
				question: question.trim(),
				choices: choices.map((choice) => ({
					text: choice.text.trim(),
					isCorrect: choice.isCorrect,
				})),
			};

			const response = mcqId
				? await fetch(`/api/mcqs/${mcqId}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					})
				: await fetch("/api/mcqs", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ ...payload, userId: user.id }),
					});

			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				setFormError(body?.error ?? "Something went wrong");
				return;
			}

			router.push("/mcqs");
		} finally {
			setPending(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-6">
			<FieldGroup>
				{formError ? <FieldError errors={[{ message: formError }]} /> : null}
				<Field>
					<FieldLabel htmlFor="name">Name</FieldLabel>
					<Input
						id="name"
						name="name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						maxLength={200}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="question">Question</FieldLabel>
					<Textarea
						id="question"
						name="question"
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
						maxLength={1000}
					/>
				</Field>
				<RadioGroup
					value={correctIndex >= 0 ? String(correctIndex) : ""}
					onValueChange={(value) => {
						if (value) {
							setCorrect(Number(value));
						}
					}}
				>
					{choices.map((choice, index) => (
						<Field key={index} orientation="horizontal" className="items-center">
							<FieldLabel htmlFor={`choice-${index + 1}`}>Choice {index + 1}</FieldLabel>
							<Input
								id={`choice-${index + 1}`}
								name={`choice-${index + 1}`}
								value={choice.text}
								onChange={(event) => setChoiceText(index, event.target.value)}
							/>
							<RadioGroupItem
								value={String(index)}
								aria-label={`Choice ${index + 1} is correct`}
							/>
							<Button
								type="button"
								variant="ghost"
								onClick={() => removeChoice(index)}
								disabled={choices.length <= 2}
							>
								Remove choice {index + 1}
							</Button>
						</Field>
					))}
				</RadioGroup>
				<Field>
					<Button type="button" variant="outline" onClick={addChoice} disabled={choices.length >= 6}>
						Add choice
					</Button>
				</Field>
				<Field orientation="horizontal">
					<Button type="submit" disabled={pending}>
						Save
					</Button>
					<Button type="button" variant="outline" onClick={() => router.push("/mcqs")}>
						Cancel
					</Button>
				</Field>
			</FieldGroup>
		</form>
	);
}
