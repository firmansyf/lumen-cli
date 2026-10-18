
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import type { Issue } from "../types/issue.js";

const BASELINE_FILE = ".lumenbaseline.json";
const BASELINE_VERSION = 1;

interface BaselineEntry {
  fingerprint: string;
}

interface BaselineFile {
  version: number;
  generatedAt: string;
  entries: BaselineEntry[];
}

export interface BaselineComparison {
  existing: Issue[];
  newIssues: Issue[];
}

export function getIssueFingerprint(
  issue: Issue
): string {
  const identity = {
    category: issue.category,
    title: issue.title,
    file: issue.file ?? null,
    message: issue.message
  };

  return createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
}

export function saveBaseline(
  projectPath: string,
  issues: Issue[]
): string {
  const baselinePath = path.join(
    projectPath,
    BASELINE_FILE
  );

  const fingerprints = [
    ...new Set(
      issues.map(getIssueFingerprint)
    )
  ];

  const baseline: BaselineFile = {
    version: BASELINE_VERSION,
    generatedAt: new Date().toISOString(),
    entries: fingerprints.map(
      (fingerprint) => ({ fingerprint })
    )
  };

  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf-8"
  );

  return baselinePath;
}

export function loadBaseline(
  projectPath: string
): BaselineFile | null {
  const baselinePath = path.join(
    projectPath,
    BASELINE_FILE
  );

  if (!fs.existsSync(baselinePath)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      fs.readFileSync(baselinePath, "utf-8")
    );

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== BASELINE_VERSION ||
      !("entries" in parsed) ||
      !Array.isArray(parsed.entries)
    ) {
      return null;
    }

    const entries = parsed.entries as unknown[];

    if (
      !entries.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "fingerprint" in entry &&
          typeof entry.fingerprint === "string"
      )
    ) {
      return null;
    }

    return parsed as BaselineFile;
  } catch {
    return null;
  }
}

export function compareWithBaseline(
  issues: Issue[],
  baseline: BaselineFile
): BaselineComparison {
  const known = new Set(
    baseline.entries.map(
      (entry) => entry.fingerprint
    )
  );

  const existing: Issue[] = [];
  const newIssues: Issue[] = [];

  for (const issue of issues) {
    if (known.has(getIssueFingerprint(issue))) {
      existing.push(issue);
    } else {
      newIssues.push(issue);
    }
  }

  return {
    existing,
    newIssues
  };
}
