import "fake-indexeddb/auto";
import { clearAssetDatabase, loadAsset, saveAsset } from "./assetStore";

beforeEach(async () => clearAssetDatabase());

test("uploaded blobs round-trip by project and asset id without localStorage payloads", async () => {
  const file = new File([new Uint8Array([1, 7, 9, 255])], "pixels.png", { type: "image/png" });
  const ref = await saveAsset("project-a", file);
  const restored = await loadAsset("project-a", ref);
  expect(restored).not.toBeNull();
  expect(await loadAsset("project-b", ref)).toBeNull();
  expect(JSON.stringify(ref)).not.toContain("data:");
});