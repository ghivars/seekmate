import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  it("focuses the marked field instead of the close button", () => {
    render(
      <Modal open onClose={() => undefined} title="Judul">
        <input data-autofocus aria-label="Cari" />
      </Modal>,
    );
    expect(screen.getByRole("textbox", { name: "Cari" })).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Judul" })).toBeInTheDocument();
  });

  it("closes on Esc (cancel) and backdrop press, not on inner clicks", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Judul">
        <p>Isi</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseDown(screen.getByText("Isi"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Judul">
        <p>Isi</p>
      </Modal>,
    );
    expect(screen.queryByText("Isi")).not.toBeInTheDocument();
  });
});
