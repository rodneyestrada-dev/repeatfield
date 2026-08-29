import { fireEvent, render, screen } from "@testing-library/react";
import { App, demoAssetUrl, demoImageUrl, repeatfieldAssetUrl, chooseHeroTurnTargets } from "./App";
import { STORAGE_KEY } from "./state";

beforeEach(() => localStorage.clear());

test("resolves the demo image beneath the deployed base path", () => {
  expect(demoImageUrl("./")).toBe("./demo-tile-field.png");
  expect(demoImageUrl("/repeatfield/")).toBe("/repeatfield/demo-tile-field.png");
});

test("resolves the bundled demo image for each workflow role", () => {
  expect(demoAssetUrl("/repeatfield/", "bundled-demo-edge")).toBe("/repeatfield/demo-tile-edge.png");
  expect(demoAssetUrl("/repeatfield/", "bundled-demo-corner")).toBe("/repeatfield/demo-tile-corner.png");
  expect(demoAssetUrl("/repeatfield/", "bundled-demo-petal")).toBe("/repeatfield/demo-shape-petal.png");
});

test("resolves original brand assets beneath the deployed base path", () => {
  expect(repeatfieldAssetUrl("/repeatfield/", "repeatfield-tile-logo.svg")).toBe(
    "/repeatfield/repeatfield-tile-logo.svg",
  );
});

test("hero turn scheduler chooses one tile or a diagonal pair, never adjacent tiles", () => {
  const sequence = (...values: number[]) => () => values.shift()!;
  expect(chooseHeroTurnTargets(sequence(0, 0))).toEqual([0]);
  expect(chooseHeroTurnTargets(sequence(0.49, 0.49))).toEqual([1]);
  expect(chooseHeroTurnTargets(sequence(0.5, 0))).toEqual([0, 3]);
  expect(chooseHeroTurnTargets(sequence(0.99, 0.99))).toEqual([1, 2]);
});

test("landing theme toggle exposes an immediate dark state", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
  fireEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
  expect(document.querySelector(".landing")).toHaveClass("landing-dark");
});

test("landing presents the Repeatfield brand and exactly three workflow choices", () => {
  render(<App />);
  expect(screen.getByRole("link", { name: "Repeatfield" })).toHaveAttribute("href", "#top");
  const cards = document.querySelectorAll(".landing-workflow");
  expect(cards).toHaveLength(3);
  expect(screen.getByRole("button", { name: /Field Tile/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Tile Set/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Tessellate/ })).toBeInTheDocument();
});

test("choosing Field Tile opens its editor with the workflow named in the header", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Field Tile");
  expect(screen.getByRole("tab", { name: "Crop" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Repeat" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Preview" })).toBeInTheDocument();
});

test("Field Tile never shows Edge/Corner roles or Tessellate controls", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Tile Set/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Tile Set/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Tessellate/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Tile Set/ }));
  expect(localStorage.getItem(STORAGE_KEY)).toContain('"tile-set"');
  first.unmount();
  render(<App />);
  expect(screen.getByTestId("workflow-name")).toHaveTextContent("Tile Set");
});

test("back to workflows returns to the entry screen and clears the stored project", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(
    screen.getByRole("heading", { name: /what are\s*you making/i }),
  ).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});

test("untouched fresh project exits immediately without confirmation", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /what are\s*you making/i })).toBeVisible();
});

test("meaningful edits require custom exit confirmation and cancel preserves the project", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  fireEvent.change(screen.getByRole("slider", { name: "Gap" }), { target: { value: "18" } });
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  expect(screen.getByRole("dialog", { name: /leave this project/i })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));
  expect(screen.getByRole("slider", { name: "Gap" })).toHaveValue("18");
  fireEvent.click(screen.getByRole("button", { name: /Workflows/ }));
  fireEvent.click(screen.getByRole("button", { name: /discard and leave/i }));
  expect(screen.getByRole("heading", { name: /what are\s*you making/i })).toBeVisible();
});

test("Field Tile repeat exposes undo/redo controls that track edits", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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

test("crop tools are unnumbered icon buttons with a concise Repeat CTA", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  const dock = screen.getByRole("toolbar", { name: "Crop tools" });
  const buttons = Array.from(dock.querySelectorAll("button"));
  expect(buttons.length).toBeGreaterThanOrEqual(7);
  for (const button of buttons) {
    expect(button.getAttribute("aria-label")).not.toMatch(/^\d/);
    expect(button).toHaveAttribute("title");
  }
  for (const tool of ["Select tile", "Warp to square", "Remove background"]) {
    fireEvent.click(screen.getByRole("button", { name: tool }));
    expect(screen.getByRole("button", { name: "Repeat" })).toBeVisible();
  }
});

test("clicking the active tool opens its options; Escape closes them", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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

test("tile turn exposes accessible per-cell reflection and reset controls", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
  const cell = screen.getByRole("button", {
    name: /Top left tile — 0° — not reflected horizontally — not reflected vertically/,
  });
  expect(cell).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reflect Top left horizontally" }));
  expect(screen.getByRole("button", {
    name: /Top left tile — 0° — reflected horizontally — not reflected vertically/,
  })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset Top left transform" }));
  expect(screen.getByRole("button", {
    name: /Top left tile — 0° — not reflected horizontally — not reflected vertically/,
  })).toBeInTheDocument();
});

test("tile turn rotates a single cell and updates its angle label", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Field Tile/ }));
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
  fireEvent.click(screen.getByRole("button", { name: /Tessellate/ }));
  // jump to assemble stage
  fireEvent.click(screen.getByRole("tab", { name: "Repeat" }));
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
