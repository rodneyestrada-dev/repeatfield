import { fireEvent, render, screen } from "@testing-library/react";
import { App, demoImageUrl } from "./App";

test("resolves the demo image beneath the deployed base path", () => {
  expect(demoImageUrl("./")).toBe("./source-tile.jpg");
  expect(demoImageUrl("/repeatfield/")).toBe("/repeatfield/source-tile.jpg");
});

test("renders the Repeatfield wordmark and three-stage workflow", () => {
  render(<App />);
  expect(screen.getByRole("banner")).toHaveTextContent("Repeatfield");
  expect(screen.getAllByRole("tab")).toHaveLength(3);
});

test("Repeat exposes disabled undo and redo controls that track edits", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: /02 Repeat/ }));
  const undo = screen.getByRole("button", { name: /Undo Repeat change/ });
  const redo = screen.getByRole("button", { name: /Redo Repeat change/ });
  expect(undo).toBeDisabled();
  expect(redo).toBeDisabled();
  const gap = screen.getByRole("slider", { name: "Gap" });
  fireEvent.change(gap, { target: { value: "24" } });
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  expect(gap).toHaveValue("0");
  expect(redo).toBeEnabled();
});

test("Repeat keyboard shortcuts undo and redo but ignore editable focus", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: /02 Repeat/ }));
  const gap = screen.getByRole("slider", { name: "Gap" });
  fireEvent.change(gap, { target: { value: "18" } });
  fireEvent.keyDown(window, { key: "z", ctrlKey: true });
  expect(gap).toHaveValue("0");
  fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
  expect(gap).toHaveValue("18");
  gap.focus();
  fireEvent.keyDown(gap, { key: "z", ctrlKey: true });
  expect(gap).toHaveValue("18");
});
