export type CurrentUser = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
};

const STORAGE_KEY = "quizmaker.currentUser";

export function setCurrentUser(user: CurrentUser): void {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getCurrentUser(): CurrentUser | null {
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw) as Partial<CurrentUser>;
		if (typeof parsed?.id !== "string" || parsed.id.length === 0) {
			return null;
		}
		return parsed as CurrentUser;
	} catch {
		return null;
	}
}

export function clearCurrentUser(): void {
	window.localStorage.removeItem(STORAGE_KEY);
}
