// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readWranglerConfig(): {
	d1_databases?: Array<{ binding?: string }>;
} {
	const raw = readFileSync(join(root, "wrangler.jsonc"), "utf8");
	const withoutComments = raw
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
	return JSON.parse(withoutComments) as {
		d1_databases?: Array<{ binding?: string }>;
	};
}

function readMigrationSql(): string {
	const dir = join(root, "migrations");
	if (!existsSync(dir)) {
		throw new Error("migrations directory does not exist");
	}

	const files = readdirSync(dir)
		.filter((file) => file.endsWith(".sql"))
		.sort();

	if (files.length === 0) {
		throw new Error("no SQL migrations found");
	}

	return files.map((file) => readFileSync(join(dir, file), "utf8")).join("\n");
}

describe("users schema", () => {
	it("declares a D1 database binding named DB", () => {
		const config = readWranglerConfig();
		const bindings = config.d1_databases ?? [];

		expect(bindings.some((database) => database.binding === "DB")).toBe(true);
	});

	it("creates a users table with the required columns", () => {
		const sql = readMigrationSql();

		expect(sql).toMatch(/CREATE TABLE\s+users\s*\(/i);

		for (const column of [
			"id",
			"first_name",
			"last_name",
			"username",
			"email",
			"password_hash",
			"created_at",
			"updated_at",
		]) {
			expect(sql, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}
	});

	it("enforces unique username and email", () => {
		const sql = readMigrationSql();

		expect(sql).toMatch(/username\s+TEXT\s+NOT NULL\s+UNIQUE/i);
		expect(sql).toMatch(/email\s+TEXT\s+NOT NULL\s+UNIQUE/i);
	});

	it("stores password_hash instead of a plaintext password column", () => {
		const sql = readMigrationSql();

		expect(sql).toMatch(/\bpassword_hash\b/);
		expect(sql).not.toMatch(/(^|[^\w])password([^\w]|$)/);
	});
});
