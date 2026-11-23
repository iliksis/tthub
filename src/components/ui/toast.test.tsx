import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "./toast";

describe("toast facade", () => {
	beforeAll(() => {
		Element.prototype.getAnimations = () => [];
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => act(() => toast.dismiss()));

	it("shows success toasts with their message", async () => {
		render(<Toaster />);

		act(() => {
			toast.success("Gespeichert");
		});

		expect(await screen.findByText("Gespeichert")).toBeTruthy();
		expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
	});

	it("shows error toasts with their message", async () => {
		render(<Toaster />);

		act(() => {
			toast.error("Fehlgeschlagen");
		});

		expect(await screen.findByText("Fehlgeschlagen")).toBeTruthy();
	});
});
