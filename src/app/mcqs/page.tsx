import { LogoutButton } from "@/components/logout-button";

export default function Page() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<main className="flex w-full max-w-lg flex-col gap-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-medium tracking-tight">Question Bank</h1>
						<p className="text-sm text-muted-foreground">
							The shared multiple-choice question bank will live here in the next
							sprint.
						</p>
					</div>
					<LogoutButton />
				</div>
			</main>
		</div>
	);
}
