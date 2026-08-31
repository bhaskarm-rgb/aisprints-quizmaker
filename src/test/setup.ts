import { beforeEach } from "vitest";

const memory = new Map<string, string>();

const localStorageMock: Storage = {
	get length() {
		return memory.size;
	},
	clear() {
		memory.clear();
	},
	getItem(key) {
		return memory.get(key) ?? null;
	},
	key(index) {
		return [...memory.keys()][index] ?? null;
	},
	removeItem(key) {
		memory.delete(key);
	},
	setItem(key, value) {
		memory.set(key, String(value));
	},
};

if (typeof window !== "undefined") {
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: localStorageMock,
	});
}

beforeEach(() => {
	memory.clear();
});
