// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

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

function extractCreateTable(sql: string, tableName: string): string {
	const match = sql.match(
		new RegExp(`CREATE TABLE\\s+${tableName}\\s*\\(([\\s\\S]*?)\\s*\\);`, "i"),
	);

	if (!match) {
		throw new Error(`CREATE TABLE ${tableName} not found`);
	}

	return match[1];
}

describe("mcqs schema", () => {
	it("creates an mcqs table with name, question, and created_by_user_id", () => {
		const body = extractCreateTable(readMigrationSql(), "mcqs");

		for (const column of [
			"id",
			"name",
			"question",
			"created_by_user_id",
			"created_at",
			"updated_at",
		]) {
			expect(body, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}

		expect(body).toMatch(/name\s+TEXT\s+NOT NULL/i);
		expect(body).toMatch(/question\s+TEXT\s+NOT NULL/i);
		expect(body).not.toMatch(/\bdescription\b/i);
	});

	it("references users from mcqs.created_by_user_id", () => {
		const body = extractCreateTable(readMigrationSql(), "mcqs");

		expect(body).toMatch(
			/created_by_user_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+users\s*\(\s*id\s*\)/i,
		);
	});

	it("creates mcq_choices with a cascade foreign key to mcqs", () => {
		const body = extractCreateTable(readMigrationSql(), "mcq_choices");

		for (const column of ["id", "mcq_id", "choice_text", "is_correct", "position"]) {
			expect(body, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}

		expect(body).toMatch(
			/mcq_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
		expect(body).toMatch(/UNIQUE\s*\(\s*mcq_id\s*,\s*position\s*\)/i);
	});

	it("creates mcq_attempts with foreign keys to the question, user, and choice", () => {
		const body = extractCreateTable(readMigrationSql(), "mcq_attempts");

		for (const column of ["id", "mcq_id", "user_id", "choice_id", "is_correct"]) {
			expect(body, `missing column ${column}`).toMatch(new RegExp(`\\b${column}\\b`));
		}

		expect(body).toMatch(
			/mcq_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
		expect(body).toMatch(
			/user_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+users\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
		expect(body).toMatch(
			/choice_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
	});
});
