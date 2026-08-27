import "fake-indexeddb/auto";
import {
  clearAssetDatabase,
  deleteAsset,
  deleteProjectAssets,
  loadAsset,
  saveAsset,
} from "./assetStore";

beforeEach(async () => clearAssetDatabase());

test("uploaded blobs round-trip by project and asset id without localStorage payloads", async () => {
  const file = new File([new Uint8Array([1, 7, 9, 255])], "pixels.png", { type: "image/png" });
  const ref = await saveAsset("project-a", file);
  const restored = await loadAsset("project-a", ref);
  expect(restored).not.toBeNull();
  expect(await loadAsset("project-b", ref)).toBeNull();
  expect(JSON.stringify(ref)).not.toContain("data:");
});

test("replacing an upload deletes the prior blob", async () => {
  const first = await saveAsset("project-a", new File([new Uint8Array([1])], "one.png", { type: "image/png" }));
  const second = await saveAsset("project-a", new File([new Uint8Array([2])], "two.png", { type: "image/png" }));
  await deleteAsset("project-a", first);
  expect(await loadAsset("project-a", first)).toBeNull();
  expect(await loadAsset("project-a", second)).not.toBeNull();
});

test("closing a project deletes every blob for that project only", async () => {
  const mine1 = await saveAsset("project-a", new File([new Uint8Array([1])], "a1.png", { type: "image/png" }));
  const mine2 = await saveAsset("project-a", new File([new Uint8Array([2])], "a2.png", { type: "image/png" }));
  const other = await saveAsset("project-b", new File([new Uint8Array([3])], "b1.png", { type: "image/png" }));
  await deleteProjectAssets("project-a");
  expect(await loadAsset("project-a", mine1)).toBeNull();
  expect(await loadAsset("project-a", mine2)).toBeNull();
  expect(await loadAsset("project-b", other)).not.toBeNull();
});

test("demo refs are ignored by deletion helpers", async () => {
  await expect(
    deleteAsset("project-a", { id: "bundled-demo", name: "Demo tile", type: "image/jpeg", kind: "demo" }),
  ).resolves.toBeUndefined();
});