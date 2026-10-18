import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scanCommand } from "../commands/scan.command.js";
import { formatJsonResult } from "../formatters/json.formatter.js";
import { printIssue, printSummary } from "../formatters/terminal.formatter.js";
import { loadLumenConfig } from "../services/config.service.js";
import type { Issue } from "../types/issue.js";

describe("developer experience (DX) enhancements", () => {
  const tempDirs: string[] = [];

  function createTempProject(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-dx-"));
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

  describe("error handling for non-existent directories", () => {
    it("reports an actionable error in terminal mode and sets exitCode to 1", async () => {
      const nonExistentPath = path.join(os.tmpdir(), "does-not-exist-" + Date.now());

      let stderrOutput = "";
      vi.spyOn(console, "error").mockImplementation((msg) => {
        stderrOutput += String(msg);
      });

      await scanCommand(nonExistentPath, {});

      expect(process.exitCode).toBe(1);
      expect(stderrOutput).toContain(nonExistentPath);
      expect(stderrOutput).toContain("Please verify that the target directory exists");
    });

    it("outputs valid JSON with success: false in --json mode and sets exitCode to 1", async () => {
      const nonExistentPath = path.join(os.tmpdir(), "does-not-exist-" + Date.now());

      let stdoutOutput = "";
      vi.spyOn(console, "log").mockImplementation((msg) => {
        stdoutOutput += String(msg);
      });

      await scanCommand(nonExistentPath, { json: true });

      expect(process.exitCode).toBe(1);
      expect(() => JSON.parse(stdoutOutput)).not.toThrow();

      const parsed = JSON.parse(stdoutOutput);
      expect(parsed.tool).toBe("lumen");
      expect(parsed.success).toBe(false);
      expect(parsed.scannedPath).toBe(nonExistentPath);
      expect(parsed.issues[0]?.severity).toBe("error");
      expect(parsed.issues[0]?.title).toBe("Project directory not found");
      expect(parsed.issues[0]?.suggestion).toContain("Please verify that the target directory exists");
    });
  });

  describe("JSON output structure and consistency", () => {
    it("includes valid ISO timestamp and accurate success flag", () => {
      const sampleIssues: Issue[] = [
        {
          title: "Test Warning",
          message: "A test warning",
          category: "project",
          severity: "warning",
          suggestion: "Fix it"
        }
      ];

      const jsonStr = formatJsonResult(sampleIssues, "/sample/path");
      const parsed = JSON.parse(jsonStr);

      expect(parsed.tool).toBe("lumen");
      expect(parsed.scannedPath).toBe("/sample/path");
      expect(parsed.success).toBe(true); // 0 errors means success: true
      expect(parsed.summary.total).toBe(1);
      expect(parsed.summary.warnings).toBe(1);
      expect(parsed.summary.errors).toBe(0);

      // Verify ISO timestamp
      expect(parsed.timestamp).toBeDefined();
      const date = new Date(parsed.timestamp);
      expect(Number.isNaN(date.getTime())).toBe(false);

      // When there is an error, success must be false
      const withError: Issue[] = [
        ...sampleIssues,
        {
          title: "Test Error",
          message: "A test error",
          category: "security",
          severity: "error",
          suggestion: "Fix error"
        }
      ];

      const jsonWithError = JSON.parse(formatJsonResult(withError, "/sample/path"));
      expect(jsonWithError.success).toBe(false);
      expect(jsonWithError.summary.errors).toBe(1);
      expect(jsonWithError.summary.total).toBe(2);
    });
  });

  describe("terminal formatting DX", () => {
    it("formats clickable file:line locations and suggestion arrows", () => {
      const logs: string[] = [];
      vi.spyOn(console, "log").mockImplementation((msg) => {
        logs.push(String(msg));
      });

      const issues: Issue[] = [
        {
          title: "Hardcoded secret detected",
          message: "Potential AWS Access Key found",
          category: "security",
          severity: "error",
          file: "src/config/aws.ts",
          metadata: {
            line: 42,
            secretType: "aws-access-key"
          },
          suggestion: "Store secrets in environment variables."
        }
      ];

      printIssue(issues[0]!);
      printSummary(issues);

      const combinedLogs = logs.join("\n");
      // Must contain file:line combined for clickable terminal navigation
      expect(combinedLogs).toContain("src/config/aws.ts:42");
      // Must contain suggestion
      expect(combinedLogs).toContain("Store secrets in environment variables.");
    });
  });

  describe("configuration validation warnings", () => {
    it("logs a clear warning when failOn has an invalid value and defaults to error", async () => {
      const project = createTempProject();
      fs.writeFileSync(
        path.join(project, "lumen.config.json"),
        JSON.stringify({ failOn: "catastrophic" })
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = await loadLumenConfig(project);

      expect(config.failOn).toBe("error");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid failOn 'catastrophic'")
      );
    });

    it("logs a clear warning when ignore array contains non-string items", async () => {
      const project = createTempProject();
      fs.writeFileSync(
        path.join(project, "lumen.config.json"),
        JSON.stringify({ ignore: ["dist/", 42, null, true] })
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const config = await loadLumenConfig(project);

      expect(config.ignore).toEqual(["dist/"]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("contains non-string items")
      );
    });
  });
});
