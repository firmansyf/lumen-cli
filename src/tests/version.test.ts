import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { formatJsonResult } from "../formatters/json.formatter.js";
import { VERSION } from "../version.js";

const root = path.resolve(import.meta.dirname, "../..");
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
).version as string;

describe("version", () => {
  it("comes from package.json", () => {
    expect(VERSION).toBe(packageVersion);
  });

  it("is printed by `lumen --version` and `lumen -v`", () => {
    const tsx = path.join(root, "node_modules", ".bin", "tsx");
    const entry = path.join(root, "src", "index.ts");

    for (const flag of ["--version", "-v"]) {
      const output = execFileSync(tsx, [entry, flag], { encoding: "utf8" }).trim();
      expect(output).toBe(packageVersion);
    }
  });

  it("is reported in the JSON output", () => {
    const result = JSON.parse(formatJsonResult([], "."));
    expect(result.version).toBe(packageVersion);
  });
});
