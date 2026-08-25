// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/hash-password";

describe("hashPassword", () => {
	it("returns the same 64-character hex digest for the same plaintext", async () => {
		const first = await hashPassword("correct-horse-battery");
		const second = await hashPassword("correct-horse-battery");

		expect(first).toMatch(/^[a-f0-9]{64}$/);
		expect(first).toBe(second);
	});

	it("does not return the plaintext password", async () => {
		const plaintext = "correct-horse-battery";
		const digest = await hashPassword(plaintext);

		expect(digest).not.toBe(plaintext);
	});

	it("produces different digests for different passwords", async () => {
		const first = await hashPassword("correct-horse-battery");
		const second = await hashPassword("correct-horse-staple");

		expect(first).not.toBe(second);
	});
});
