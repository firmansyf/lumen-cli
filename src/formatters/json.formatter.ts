import type { Issue } from "../types/issue.js";
import { VERSION } from "../version.js";

interface LumenJsonResult {
  tool: string;
  version: string;
  scannedPath: string;
  timestamp: string;
  success: boolean;

  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };

  issues: Issue[];
}

export function formatJsonResult(
  issues: Issue[],
  scannedPath: string
): string {
  const errors = issues.filter(
    (issue) =>
      issue.severity === "error"
  ).length;

  const warnings = issues.filter(
    (issue) =>
      issue.severity === "warning"
  ).length;

  const infos = issues.filter(
    (issue) =>
      issue.severity === "info"
  ).length;

  const result: LumenJsonResult = {
    tool: "lumen",

    version: VERSION,

    scannedPath,

    timestamp: new Date().toISOString(),

    success: errors === 0,

    summary: {
      total: issues.length,
      errors,
      warnings,
      infos
    },

    issues
  };

  return JSON.stringify(
    result,
    null,
    2
  );
}