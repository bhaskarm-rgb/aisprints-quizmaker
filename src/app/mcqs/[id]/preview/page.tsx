"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { McqPreview, type McqPreviewData } from "@/components/mcq-preview";

export default function Page() {
	const params = useParams<{ id: string }>();
	const id = String(params.id);
	const [mcq, setMcq] = useState<McqPreviewData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const response = await fetch(`/api/mcqs/${id}`);
				if (!response.ok) {
					throw new Error("Question not found");
				}
				const body = (await response.json()) as {
					id: string;
					question: string;
					choices: Array<{ id: string; text: string }>;
				};
				if (!cancelled) {
					setMcq({
						id: body.id,
						question: body.question,
						choices: body.choices.map((choice) => ({
							id: choice.id,
							text: choice.text,
						})),
					});
				}
			} catch {
				if (!cancelled) {
					setError("Could not load this question.");
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [id]);

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<main className="flex w-full max-w-2xl flex-col gap-6">
				<h1 className="text-2xl font-medium tracking-tight">Preview</h1>
				<p className="text-sm text-muted-foreground">
					This is a preview. Your answer is recorded, but it is not a scored quiz.
				</p>
				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				{mcq ? <McqPreview mcq={mcq} /> : null}
				{!mcq && !error ? (
					<p className="text-sm text-muted-foreground">Loading question…</p>
				) : null}
			</main>
		</div>
	);
}
