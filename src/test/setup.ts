import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test case
afterEach(() => {
	cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
	value: (query: string) => ({
		addEventListener: () => {},
		addListener: () => {},
		dispatchEvent: () => {},
		matches: false,
		media: query,
		onchange: null,
		removeEventListener: () => {},
		removeListener: () => {},
	}),
	writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
	constructor() {}
	disconnect() {}
	observe() {}
	unobserve() {}
	takeRecords() {
		return [];
	}
};

// Mock URL.createObjectURL
global.URL.createObjectURL = () => "blob:mock-url";
