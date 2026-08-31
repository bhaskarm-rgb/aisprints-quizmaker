import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { McqBank } from "@/components/mcq-bank";
import { buttonVariants } from "@/components/ui/button";

export default function Page() {
	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<main className="flex w-full max-w-5xl flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-medium tracking-tight">Question Bank</h1>
						<p className="text-sm text-muted-foreground">
							Create, edit, preview, and delete multiple-choice questions.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Link href="/mcqs/new" className={buttonVariants()}>
							Create question
						</Link>
						<LogoutButton />
					</div>
				</div>
				<McqBank />
			</main>
		</div>
	);
}
