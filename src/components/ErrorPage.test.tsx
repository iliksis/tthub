import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorPage } from "./ErrorPage";

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

describe("ErrorPage", () => {
	const writeText = vi.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		toastSuccess.mockClear();
		writeText.mockClear();
		Object.assign(navigator, { clipboard: { writeText } });
	});

	it("shows the error message", () => {
		render(<ErrorPage error={new Error("Something broke")} />);

		expect(screen.getByText("Something broke")).toBeTruthy();
	});

	it("copies error details to the clipboard and shows a confirmation toast", () => {
		const error = new Error("Something broke");
		error.stack = "Error: Something broke\n    at somewhere.tsx:1:1";
		render(<ErrorPage error={error} />);

		fireEvent.click(
			screen.getByRole("button", { name: "Fehlerdetails kopieren" }),
		);

		expect(writeText).toHaveBeenCalledTimes(1);
		const copied = writeText.mock.calls[0][0] as string;
		expect(copied).toContain("Message: Something broke");
		expect(copied).toContain("Stack:\nError: Something broke");
		expect(copied).toMatch(/^URL: /m);
		expect(copied).toMatch(/^Time: /m);
		expect(toastSuccess).toHaveBeenCalledWith("Fehlerdetails kopiert");
	});
});
