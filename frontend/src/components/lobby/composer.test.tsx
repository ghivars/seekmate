import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { mockMessage } from "@/lib/mock";
import { Composer } from "./composer";

function setup(editing = false) {
  const props = {
    placeholder: "Tulis pesan",
    editing: editing ? mockMessage({ body: "asli" }) : null,
    onSend: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onEditLast: vi.fn(),
    onTyping: vi.fn(),
  };
  render(<Composer {...props} />);
  return { ...props, user: userEvent.setup(), box: screen.getByRole("textbox", { name: "Tulis pesan" }) };
}

describe("Composer", () => {
  it("sends with Enter and adds a line with Shift+Enter", async () => {
    const { user, box, onSend } = setup();
    await user.type(box, "baris 1{Shift>}{Enter}{/Shift}baris 2{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith("baris 1\nbaris 2");
    expect(box).toHaveValue("");
  });

  it("does not send blank or oversized text", async () => {
    const { user, box, onSend } = setup();
    await user.type(box, "   {Enter}");
    await user.clear(box);
    await user.click(box);
    await user.paste("x".repeat(1001));
    await user.keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
  });

  it("edits the last message with ArrowUp only when the draft is empty", async () => {
    const { user, box, onEditLast } = setup();
    await user.type(box, "{ArrowUp}");
    expect(onEditLast).toHaveBeenCalledTimes(1);
    await user.type(box, "draf{ArrowUp}");
    expect(onEditLast).toHaveBeenCalledTimes(1);
  });

  it("saves and cancels edits", async () => {
    const { user, box, onSaveEdit, onCancelEdit, onSend } = setup(true);
    expect(box).toHaveValue("asli");
    await user.type(box, " baru{Enter}");
    expect(onSaveEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }), "asli baru");
    await user.type(box, "{Escape}");
    expect(onCancelEdit).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });
});
