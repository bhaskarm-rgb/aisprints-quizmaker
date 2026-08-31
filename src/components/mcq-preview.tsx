"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getCurrentUser } from "@/lib/current-user";

export type McqPreviewChoice = {
	id: string;
	text: string;
};

export type McqPreviewData = {
	id: string;
	question: string;
	choices: McqPreviewChoice[];
};

type McqPreviewProps = {
	mcq: McqPreviewData;
};

export function McqPreview({ mcq }: McqPreviewProps) {
	const router = useRouter();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [submittedChoiceId, setSubmittedChoiceId] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [result, setResult] = useState<boolean | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);

		if (!selectedId) {
			return;
		}

		const user = getCurrentUser();
		if (!user) {
			setFormError("You need to log in before previewing a question.");
			return;
		}

		setPending(true);
		try {
			const response = await fetch(`/api/mcqs/${mcq.id}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					choiceId: selectedId,
				}),
			});
			const body = (await response.json().catch(() => null)) as
				| { isCorrect?: boolean; error?: string }
				| null;

			if (!response.ok) {
				setFormError(body?.error ?? "Something went wrong");
				return;
			}

			setSubmittedChoiceId(selectedId);
			setResult(Boolean(body?.isCorrect));
		} finally {
			setPending(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-6">
			<p className="text-lg font-medium">{mcq.question}</p>
			{formError ? <FieldError errors={[{ message: formError }]} /> : null}
			<RadioGroup
				value={selectedId ?? ""}
				onValueChange={(value) => {
					if (!value) {
						return;
					}
					setSelectedId(value);
					if (value !== submittedChoiceId) {
						setResult(null);
					}
				}}
				disabled={pending}
			>
				{mcq.choices.map((choice) => (
					<label key={choice.id} className="flex items-center gap-2 text-sm">
						<RadioGroupItem value={choice.id} />
						{choice.text}
					</label>
				))}
			</RadioGroup>
			{result !== null ? (
				<p className="text-sm font-medium">{result ? "Correct" : "Incorrect"}</p>
			) : null}
			<div className="flex gap-2">
				<Button
					type="submit"
					disabled={!selectedId || pending || selectedId === submittedChoiceId}
				>
					Submit
				</Button>
				<Button type="button" variant="outline" onClick={() => router.push("/mcqs")}>
					Back to questions
				</Button>
			</div>
		</form>
	);
}
