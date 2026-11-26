import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no modal <dialog>; these are enough for component tests.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
  this.querySelector<HTMLElement>("button")?.focus();
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
};
