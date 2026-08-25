"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function handleClick() {
		setPending(true);
		try {
			await fetch("/api/auth/logout", { method: "POST" });
			router.push("/login");
		} finally {
			setPending(false);
		}
	}

	return (
		<Button type="button" variant="outline" onClick={handleClick} disabled={pending}>
			Log out
		</Button>
	);
}
