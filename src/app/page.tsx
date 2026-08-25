import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<main className="flex w-full max-w-sm flex-col gap-6 text-center">
				<div className="flex flex-col gap-2">
					<h1 className="text-2xl font-medium tracking-tight">QuizMaker</h1>
					<p className="text-sm text-muted-foreground">
						A shared question bank for teachers to collaborate on multiple-choice tests.
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<Link href="/register" className={buttonVariants()}>
						Create an account
					</Link>
					<Link href="/login" className={buttonVariants({ variant: "outline" })}>
						Log in
					</Link>
				</div>
			</main>
		</div>
	);
}
