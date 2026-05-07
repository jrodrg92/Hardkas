import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { 
  createEmptyRealAccountStore, 
  loadOrCreateRealAccountStore, 
  saveRealAccountStore, 
  importRealDevAccount, 
  removeRealDevAccount,
  getRealDevAccount,
  RealAccountStore
} from "../src/real-accounts";

describe("Real Account Store", () => {
  let tempDir: string;
  let storePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hardkas-test-"));
    storePath = path.join(tempDir, ".hardkas", "accounts.real.json");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create an empty account store", () => {
    const store = createEmptyRealAccountStore();
    expect(store.version).toBe(1);
    expect(store.networkId).toBe("simnet");
    expect(store.accounts).toHaveLength(0);
  });

  it("should load or create a store file", async () => {
    const store = await loadOrCreateRealAccountStore({ cwd: tempDir });
    expect(fs.existsSync(storePath)).toBe(true);
    expect(store.accounts).toHaveLength(0);
  });

  it("should import a valid account", () => {
    let store = createEmptyRealAccountStore();
    store = importRealDevAccount(store, {
      name: "alice",
      address: "kaspa:abc",
      privateKey: "secret"
    });

    expect(store.accounts).toHaveLength(1);
    expect(store.accounts[0].name).toBe("alice");
    expect(store.accounts[0].address).toBe("kaspa:abc");
    expect(store.accounts[0].privateKey).toBe("secret");
    expect(store.accounts[0].createdAt).toBeDefined();
  });

  it("should reject invalid account names", () => {
    const store = createEmptyRealAccountStore();
    
    expect(() => importRealDevAccount(store, { name: "", address: "kaspa:abc" }))
      .toThrow("Account name is required.");
      
    expect(() => importRealDevAccount(store, { name: "alice space", address: "kaspa:abc" }))
      .toThrow("Invalid account name 'alice space'");
      
    expect(() => importRealDevAccount(store, { name: "alice!", address: "kaspa:abc" }))
      .toThrow("Invalid account name 'alice!'");
  });

  it("should reject duplicate account names", () => {
    let store = createEmptyRealAccountStore();
    store = importRealDevAccount(store, { name: "alice", address: "kaspa:abc" });
    
    expect(() => importRealDevAccount(store, { name: "alice", address: "kaspa:def" }))
      .toThrow("Account with name 'alice' already exists.");
      
    expect(() => importRealDevAccount(store, { name: "ALICE", address: "kaspa:def" }))
      .toThrow("Account with name 'ALICE' already exists.");
  });

  it("should reject invalid address prefixes", () => {
    const store = createEmptyRealAccountStore();
    
    expect(() => importRealDevAccount(store, { name: "alice", address: "" }))
      .toThrow("Address is required.");
      
    expect(() => importRealDevAccount(store, { name: "alice", address: "invalid:abc" }))
      .toThrow("Invalid address 'invalid:abc'");
  });

  it("should get an account by name", () => {
    let store = createEmptyRealAccountStore();
    store = importRealDevAccount(store, { name: "alice", address: "kaspa:abc" });
    
    const account = getRealDevAccount(store, "alice");
    expect(account).not.toBeNull();
    expect(account?.address).toBe("kaspa:abc");
    
    expect(getRealDevAccount(store, "bob")).toBeNull();
  });

  it("should remove an account", () => {
    let store = createEmptyRealAccountStore();
    store = importRealDevAccount(store, { name: "alice", address: "kaspa:abc" });
    
    store = removeRealDevAccount(store, "alice");
    expect(store.accounts).toHaveLength(0);
    
    expect(() => removeRealDevAccount(store, "alice")).toThrow("Account with name 'alice' not found.");
  });

  it("should save and load store correctly", async () => {
    let store = createEmptyRealAccountStore();
    store = importRealDevAccount(store, { name: "alice", address: "kaspa:abc", privateKey: "secret" });
    
    await saveRealAccountStore(store, { path: storePath });
    
    const loadedStore = await loadOrCreateRealAccountStore({ path: storePath });
    expect(loadedStore.accounts).toHaveLength(1);
    expect(loadedStore.accounts[0].name).toBe("alice");
    expect(loadedStore.accounts[0].privateKey).toBe("secret");
  });
});
