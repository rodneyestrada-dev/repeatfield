import { fireEvent, render, screen } from "@testing-library/react";
import { App, demoImageUrl } from "./App";
import { STORAGE_KEY } from "./state";

beforeEach(() => localStorage.clear());

test("resolves the demo image beneath the deployed base path", () => {
  expect(demoImageUrl("./")).toBe("./source-tile.jpg");
  expect(demoImageUrl("/repeatfield/")).toBe("/repeatfield/source-tile.jpg");
});

test("the entry screen asks what you are making with exactly three choices", () => {
  render(<App />);
  expect(
    screen.getByRole("heading", { name: /what are you making/i }),
  ).toBeInTheDocument();
  const cards = screen.getAllByRole("button");
  expect(cards).toHaveLength(3);
  expect(screen.getByText("Field Tile")).toBeInTheDocument();
  expect(screen.getByText("Tile Set")).toBeInTheDocument();
  expect(screen.getByText("Tessellate")).toBeInTheDocument();
});

test("choosing Field Tile opens its editor with the workflow named in the header", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Field Tile");
  expect(screen.getByRole("tab", { name: "Crop" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Repeat" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
});

test("Field Tile never shows Edge/Corner roles or Tessellate controls", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  // Tile Turn and Field Layout are present
  expect(screen.getByText("Tile Turn")).toBeInTheDocument();
  expect(screen.getByText("Field Layout")).toBeInTheDocument();
  // Tile Set / Tessellate concepts are absent
  expect(screen.queryByText(/edge run/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/corner join/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/primary/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/infill/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/repeat cell/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/coverage/i)).not.toBeInTheDocument();
});

test("Tile Set opens with Field/Edge/Corner roles and no Tessellate or Tile Turn controls", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Tile Set"));
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Tile Set");
  const roles = screen.getByRole("group", { name: "Tile Set roles" });
  expect(roles).toHaveTextContent("Field");
  expect(roles).toHaveTextContent("Edge");
  expect(roles).toHaveTextContent("Corner");
  expect(screen.queryByText("Tile Turn")).not.toBeInTheDocument();
  expect(screen.queryByText(/primary/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/infill/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/coverage/i)).not.toBeInTheDocument();
});

test("Tile Set role switching preserves each role's state", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Tile Set"));
  const edge = screen.getByRole("button", { name: /Edge/ });
  fireEvent.click(edge);
  expect(edge).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByLabelText("Upload Edge image"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Corner/ }));
  expect(
    screen.getByLabelText("Upload Corner image"),
  ).toBeInTheDocument();
});

test("Tessellate opens with Primary/Infill and no Tile Turn or Field/Edge/Corner roles", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Tessellate"));
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Tessellate");
  const shapes = screen.getByRole("group", { name: "Shapes" });
  expect(shapes).toHaveTextContent("Primary");
  expect(shapes).toHaveTextContent("Infill");
  expect(screen.queryByText("Tile Turn")).not.toBeInTheDocument();
  expect(screen.queryByText("Field Layout")).not.toBeInTheDocument();
  expect(screen.queryByText(/edge run/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/corner join/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/brick/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/half-drop/i)).not.toBeInTheDocument();
});

test("the workflow choice persists across reload", () => {
  const first = render(<App />);
  fireEvent.click(screen.getByText("Tile Set"));
  expect(localStorage.getItem(STORAGE_KEY)).toContain('"tile-set"');
  first.unmount();
  render(<App />);
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Tile Set");
});

test("back to workflows returns to the entry screen and clears the stored project", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(
    screen.getByRole("heading", { name: /what are you making/i }),
  ).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

test("untouched fresh project exits immediately without confirmation", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /what are you making/i })).toBeVisible();
});

test("meaningful edits require custom exit confirmation and cancel preserves the project", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  fireEvent.change(screen.getByRole("slider", { name: "Gap" }), { target: { value: "18" } });
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(screen.getByRole("dialog", { name: /leave this project/i })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));
  expect(screen.getByRole("slider", { name: "Gap" })).toHaveValue("18");
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  fireEvent.click(screen.getByRole("button", { name: /discard and leave/i }));
  expect(screen.getByRole("heading", { name: /what are you making/i })).toBeVisible();
});

test("Field Tile repeat exposes undo/redo controls that track edits", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
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

test("keyboard undo/redo works but ignores editable focus", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
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

test("crop tools are unnumbered icon buttons with Continue always present", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  const dock = screen.getByRole("toolbar", { name: "Crop tools" });
  const buttons = Array.from(dock.querySelectorAll("button"));
  expect(buttons.length).toBeGreaterThanOrEqual(7);
  for (const button of buttons) {
    expect(button.getAttribute("aria-label")).not.toMatch(/^\d/);
    expect(button).toHaveAttribute("title");
  }
  for (const tool of ["Select tile", "Warp to square", "Remove background"]) {
    fireEvent.click(screen.getByRole("button", { name: tool }));
    expect(
      screen.getByRole("button", { name: /Continue to Repeat/ }),
    ).toBeVisible();
  }
});

test("clicking the active tool opens its options; Escape closes them", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  const select = screen.getByRole("button", { name: "Select tile" });
  expect(select).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(select);
  expect(screen.getByTestId("tool-options")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByTestId("tool-options")).not.toBeInTheDocument();
  // command tools execute without opening options
  fireEvent.click(screen.getByRole("button", { name: "Rotate 90°" }));
  expect(screen.queryByTestId("tool-options")).not.toBeInTheDocument();
});

test("tile turn rotates a single cell and updates its angle label", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  const cell = screen.getByRole("button", { name: /Top right tile — 0°/ });
  fireEvent.click(cell);
  expect(
    screen.getByRole("button", { name: /Top right tile — 90°/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Top left tile — 0°/ }),
  ).toBeInTheDocument();
  // shift-click rotates backward
  fireEvent.click(
    screen.getByRole("button", { name: /Top right tile — 90°/ }),
    { shiftKey: true },
  );
  expect(
    screen.getByRole("button", { name: /Top right tile — 0°/ }),
  ).toBeInTheDocument();
});

test("field layout options live under Field Layout, symmetry under Advanced", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Field Tile"));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  const layout = screen.getByRole("group", { name: "Field Layout options" });
  expect(layout).toHaveTextContent("Straight");
  expect(layout).toHaveTextContent("Brick");
  expect(layout).toHaveTextContent("Half-Drop");
  const advanced = screen.getByTestId("advanced-symmetry");
  expect(advanced).toHaveTextContent("Advanced Symmetry");
  expect(advanced).toHaveTextContent("Mirror Grid");
  expect(advanced).toHaveTextContent("Radial Kaleidoscope");
});

test("tessellate coverage panel reports honestly when nothing is placed", () => {
  render(<App />);
  fireEvent.click(screen.getByText("Tessellate"));
  // jump to assemble stage
  fireEvent.click(screen.getByRole("tab", { name: "Assemble" }));
  expect(screen.getByTestId("coverage-status")).toHaveTextContent(
    /place at least one shape/i,
  );
  expect(screen.getByRole("group", { name: "Output mode" })).toHaveTextContent(
    "Medallion",
  );
  expect(
    screen.getByRole("group", { name: "Spacing mode" }),
  ).toHaveTextContent("Touching");
});
