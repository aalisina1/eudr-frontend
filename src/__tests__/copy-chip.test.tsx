import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyChip } from "@/components/copy-chip";

describe("CopyChip", () => {
  it("renders the label and value", () => {
    render(<CopyChip label="Reference Number" value="26FREQVKTA7K2V" />);
    expect(screen.getByText("Reference Number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Reference Number" })).toHaveTextContent(
      "26FREQVKTA7K2V",
    );
  });

  it("writes the value to the clipboard on click", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyChip label="Verification Number" value="VERIF-123" />);
    await userEvent.click(screen.getByRole("button", { name: "Copy Verification Number" }));
    expect(writeText).toHaveBeenCalledWith("VERIF-123");
  });
});
