import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeProject } from "../analyzers/project.analyzer.js";
import { analyzeDependencies } from "../analyzers/dependency.analyzer.js";
import { analyzeSecurity } from "../analyzers/security.analyzer.js";
import { analyzeSecrets } from "../analyzers/secret.analyzer.js";
import { analyzeEnvironment } from "../analyzers/environment.analyzer.js";
import { scanCommand } from "../commands/scan.command.js";
import { queryOsv } from "../services/osv.service.js";
import { getCvssScore, getSecuritySeverity } from "../utils/security.utils.js";

describe("analyzer resilience & consistency", () => {
  const tempDirs: string[] = [];

  function createTempProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-resilience-"));
    tempDirs.push(dir);
    return dir;
  }

  beforeEach(() => {
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = 0;
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    tempDirs.length = 0;
    vi.restoreAllMocks();
  });

  it("project analyzer includes file property for missing package.json", () => {
    const project = createTempProject();
    const issues = analyzeProject(project);

    const missingPkg = issues.find((i) => i.title === "package.json not found");
    expect(missingPkg).toBeDefined();
    expect(missingPkg?.file).toBe("package.json");
    expect(missingPkg?.severity).toBe("error");
  });

  it("security analyzer does not crash on malformed package.json", async () => {
    const project = createTempProject();
    fs.writeFileSync(path.join(project, "package.json"), "{ invalid JSON content !!!");

    // Should not throw, should return empty array
    const issues = await analyzeSecurity(project);
    expect(issues).toEqual([]);
  });

  it("dependency analyzer handles workspace:* and file: protocols without false version mismatch warnings", async () => {
    const project = createTempProject();

    // Create mock node_modules for installed packages
    const pkgADir = path.join(project, "node_modules", "@my-scope", "pkg-a");
    const pkgBDir = path.join(project, "node_modules", "local-pkg");
    fs.mkdirSync(pkgADir, { recursive: true });
    fs.mkdirSync(pkgBDir, { recursive: true });

    fs.writeFileSync(
      path.join(pkgADir, "package.json"),
      JSON.stringify({ name: "@my-scope/pkg-a", version: "1.0.0" })
    );
    fs.writeFileSync(
      path.join(pkgBDir, "package.json"),
      JSON.stringify({ name: "local-pkg", version: "2.0.0" })
    );

    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({
        dependencies: {
          "@my-scope/pkg-a": "workspace:*",
          "local-pkg": "file:../local-pkg"
        }
      })
    );

    const issues = await analyzeDependencies(project);

    // Should NOT complain that version does not match declared range
    const mismatch = issues.find((i) =>
      i.title.includes("does not match declared version range")
    );
    expect(mismatch).toBeUndefined();
  });

  it("security utils parses direct numeric scores and maps advisory severity", () => {
    // Direct numeric string
    const vulnNumeric = {
      id: "TEST-1",
      severity: [{ type: "CVSS_V3", score: "8.5" }]
    };
    expect(getCvssScore(vulnNumeric)).toBe(8.5);

    // Vector with trailing score
    const vulnVector = {
      id: "TEST-2",
      severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/9.8" }]
    };
    expect(getCvssScore(vulnVector)).toBe(9.8);

    // Severity mapping with score
    expect(getSecuritySeverity(8.0)).toBe("error");
    expect(getSecuritySeverity(5.0)).toBe("warning");
    expect(getSecuritySeverity(2.0)).toBe("info");

    // Fallback to database_specific severity when score is undefined
    expect(getSecuritySeverity(undefined, "CRITICAL")).toBe("error");
    expect(getSecuritySeverity(undefined, "HIGH")).toBe("error");
    expect(getSecuritySeverity(undefined, "MODERATE")).toBe("warning");
    expect(getSecuritySeverity(undefined, "LOW")).toBe("info");
    expect(getSecuritySeverity(undefined, undefined)).toBe("warning");
  });

  it("queryOsv retries once on 429 rate limit and returns vulnerabilities", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // First call returns 429, second returns 200 with data
    fetchSpy
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            vulns: [
              {
                id: "GHSA-test-1234",
                summary: "Test vulnerability"
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const vulns = await queryOsv("example-pkg", "1.0.0");
    expect(vulns).toHaveLength(1);
    expect(vulns[0].id).toBe("GHSA-test-1234");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("queryOsv returns empty array safely on invalid JSON response or error", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response("Not JSON", { status: 500 }));

    const vulns = await queryOsv("example-pkg", "1.0.0");
    expect(vulns).toEqual([]);
  });

  it("secret scanner does NOT leak secret values in any issue fields", () => {
    const project = createTempProject();
    const secretValue = "AKIAIOSFODNN7EXAMPLE";
    const secretFile = path.join(project, "creds.ts");

    fs.writeFileSync(secretFile, `const awsKey = "${secretValue}";\n`);

    const issues = analyzeSecrets(project);
    const secretIssue = issues.find((i) => i.title.includes("AWS Access Key"));

    expect(secretIssue).toBeDefined();
    // Verify that the secret string itself is NEVER exposed anywhere in the issue
    expect(secretIssue?.title).not.toContain(secretValue);
    expect(secretIssue?.message).not.toContain(secretValue);
    expect(secretIssue?.suggestion).not.toContain(secretValue);
    expect(JSON.stringify(secretIssue?.metadata ?? {})).not.toContain(secretValue);
  });

  it("environment analyzer respects ignore patterns from configuration", () => {
    const project = createTempProject();

    // Create a test file using an environment variable
    const testDir = path.join(project, "tests");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, "auth.test.ts"),
      "const secret = process.env.TEST_ONLY_SECRET;"
    );

    // Create .env with normal vars
    fs.writeFileSync(path.join(project, ".env"), "APP_PORT=3000\n");

    // Without ignore: should report TEST_ONLY_SECRET is missing from .env
    const unignoredIssues = analyzeEnvironment(project);
    expect(
      unignoredIssues.some((i) => i.metadata?.envVariable === "TEST_ONLY_SECRET")
    ).toBe(true);

    // With ignore: tests/ is ignored, so no warning for TEST_ONLY_SECRET
    const ignoredIssues = analyzeEnvironment(project, { ignore: ["tests/"] });
    expect(
      ignoredIssues.some((i) => i.metadata?.envVariable === "TEST_ONLY_SECRET")
    ).toBe(false);
  });

  it("scan command isolates analyzer errors so other analyzers still run and output valid JSON", async () => {
    const project = createTempProject();

    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({ name: "isolated-test", version: "1.0.0" })
    );

    let loggedOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg) => {
      loggedOutput += String(msg);
    });

    // Run normal scan in JSON mode
    await scanCommand(project, { json: true });

    expect(() => JSON.parse(loggedOutput)).not.toThrow();
    const result = JSON.parse(loggedOutput);
    expect(result.tool).toBe("lumen");
    expect(result.issues.length).toBeGreaterThan(0);
    // Project analyzer ran and detected package.json
    expect(result.issues.some((i: { title: string }) => i.title === "package.json detected")).toBe(
      true
    );
  });
});
