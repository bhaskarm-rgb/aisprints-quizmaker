"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type McqTableRow = {
	id: string;
	name: string;
	question: string;
	choiceCount: number;
};

type McqTableProps = {
	questions: McqTableRow[];
	onDeleted?: (id: string) => void;
};

export function McqTable({ questions, onDeleted }: McqTableProps) {
	const [pendingDelete, setPendingDelete] = useState<McqTableRow | null>(null);
	const [deleting, setDeleting] = useState(false);

	async function confirmDelete() {
		if (!pendingDelete) {
			return;
		}

		setDeleting(true);
		try {
			await fetch(`/api/mcqs/${pendingDelete.id}`, { method: "DELETE" });
			onDeleted?.(pendingDelete.id);
			setPendingDelete(null);
		} finally {
			setDeleting(false);
		}
	}

	if (questions.length === 0) {
		return (
			<div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
				<p>No questions yet. Add the first one to the shared bank.</p>
				<Link href="/mcqs/new">Create question</Link>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Question</TableHead>
						<TableHead>Choices</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{questions.map((question) => (
						<TableRow key={question.id}>
							<TableCell className="font-medium">{question.name}</TableCell>
							<TableCell className="max-w-md whitespace-normal text-muted-foreground">
								{question.question}
							</TableCell>
							<TableCell>{question.choiceCount}</TableCell>
							<TableCell>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Actions for ${question.name}`}
											/>
										}
									>
										<MoreVertical />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											render={<Link href={`/mcqs/${question.id}/edit`} />}
										>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem
											render={<Link href={`/mcqs/${question.id}/preview`} />}
										>
											Preview
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onClick={() => setPendingDelete(question)}
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<AlertDialog
				open={pendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setPendingDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this question?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete {pendingDelete?.name} and its choices and
							attempts.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={deleting}
							onClick={confirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
