import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNuExternalCommand,
  isNushellHost,
  quoteNuArg,
} from "./index.ts";

describe("isNushellHost", () => {
  it("accepts NU_VERSION", () => {
    assert.equal(isNushellHost({ NU_VERSION: "0.99.0" }), true);
  });

  it("rejects empty env", () => {
    assert.equal(isNushellHost({}), false);
  });
});

describe("quoteNuArg / buildNuExternalCommand", () => {
  it("quotes spaces and builds an external command", () => {
    assert.equal(quoteNuArg(`C:\\Program Files\\node.exe`), `"C:\\\\Program Files\\\\node.exe"`);
    const cmd = buildNuExternalCommand([
      "C:\\Program Files\\nodejs\\node.exe",
      "D:\\tools\\mycli\\cli.js",
      "hello world",
    ]);
    assert.match(cmd, /^\^"/);
    assert.match(cmd, /hello world/);
  });
});
