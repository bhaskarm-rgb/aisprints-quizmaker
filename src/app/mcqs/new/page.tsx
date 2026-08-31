import { McqForm } from "@/components/mcq-form";

export default function Page() {
	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<main className="flex w-full max-w-2xl flex-col gap-6">
				<h1 className="text-2xl font-medium tracking-tight">Create question</h1>
				<McqForm />
			</main>
		</div>
	);
}
