import { beforeEach, describe, expect, it } from "vitest";
import { clearCurrentUser, getCurrentUser, setCurrentUser } from "./current-user";

const jane = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Doe",
	username: "jane@school.edu",
	email: "jane@school.edu",
};

describe("current user", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("stores a user and reads it back", () => {
		setCurrentUser(jane);

		expect(getCurrentUser()).toEqual(jane);
	});

	it("returns null when nothing is stored", () => {
		expect(getCurrentUser()).toBeNull();
	});

	it("clears the stored user", () => {
		setCurrentUser(jane);
		clearCurrentUser();

		expect(getCurrentUser()).toBeNull();
	});

	it("returns null when stored JSON is invalid", () => {
		window.localStorage.setItem("quizmaker.currentUser", "{not-json");

		expect(getCurrentUser()).toBeNull();
	});
});
