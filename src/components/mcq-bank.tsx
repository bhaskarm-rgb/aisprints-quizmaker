"use client";

import { useEffect, useState } from "react";
import { McqTable, type McqTableRow } from "@/components/mcq-table";

export function McqBank() {
	const [questions, setQuestions] = useState<McqTableRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			try {
				const response = await fetch("/api/mcqs");
				if (!response.ok) {
					throw new Error("Failed to load questions");
				}
				const body = (await response.json()) as { mcqs?: McqTableRow[] };
				if (!cancelled) {
					setQuestions(body.mcqs ?? []);
				}
			} catch {
				if (!cancelled) {
					setError("Could not load questions.");
					setQuestions([]);
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	if (questions === null) {
		return <p className="text-sm text-muted-foreground">Loading questions…</p>;
	}

	if (error) {
		return <p className="text-sm text-destructive">{error}</p>;
	}

	return (
		<McqTable
			questions={questions}
			onDeleted={(id) =>
				setQuestions((current) =>
					(current ?? []).filter((question) => question.id !== id),
				)
			}
		/>
	);
}
