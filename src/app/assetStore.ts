import type { BrowserAssetRef } from "./state";

const DB_NAME = "repeatfield-assets-v1";
const STORE = "assets";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const key = (projectId: string, assetId: string) => `${projectId}:${assetId}`;

export async function saveAsset(projectId: string, file: File): Promise<BrowserAssetRef> {
  const id = globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, key(projectId, id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return { id, name: file.name, type: file.type, kind: "indexeddb" };
}

export async function loadAsset(projectId: string, ref: BrowserAssetRef): Promise<Blob | null> {
  if (ref.kind !== "indexeddb") return null;
  const db = await openDatabase();
  const value = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key(projectId, ref.id));
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value ?? null;
}

export async function deleteAsset(projectId: string, ref: BrowserAssetRef): Promise<void> {
  if (ref.kind !== "indexeddb") return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key(projectId, ref.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const range = IDBKeyRange.bound(`${projectId}:`, `${projectId}:\uffff`);
    tx.objectStore(STORE).delete(range);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAssetDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}
