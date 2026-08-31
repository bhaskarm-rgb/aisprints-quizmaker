"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { McqForm, type McqFormInitial } from "@/components/mcq-form";

type LoadedMcq = {
	id: string;
	name: string;
	question: string;
	choices: Array<{ text: string; isCorrect: boolean }>;
};

export default function Page() {
	const params = useParams<{ id: string }>();
	const id = String(params.id);
	const [initial, setInitial] = useState<McqFormInitial | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const response = await fetch(`/api/mcqs/${id}`);
				if (!response.ok) {
					throw new Error("Question not found");
				}
				const body = (await response.json()) as LoadedMcq;
				if (!cancelled) {
					setInitial({
						name: body.name,
						question: body.question,
						choices: body.choices,
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
				<h1 className="text-2xl font-medium tracking-tight">Edit question</h1>
				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				{initial ? <McqForm mcqId={id} initial={initial} /> : null}
				{!initial && !error ? (
					<p className="text-sm text-muted-foreground">Loading question…</p>
				) : null}
			</main>
		</div>
	);
}
