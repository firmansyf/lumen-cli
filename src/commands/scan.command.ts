
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

import {
  analyzeProject,
  analyzeDependencies,
  analyzeSecurity,
  analyzeSecrets,
  analyzeEnvironment
} from "../analyzers/index.js";

import {
  printIssue,
  printSummary
} from "../formatters/terminal.formatter.js";

import {
  formatJsonResult
} from "../formatters/json.formatter.js";

import {
  deduplicateIssues,
  groupIssuesByCategory
} from "../utils/issue.utils.js";

import {
  loadLumenIgnore,
  mergeIgnorePatterns
} from "../utils/ignore.utils.js";

import {
  loadLumenConfig
} from "../services/config.service.js";

import {
  getChangedFiles
} from "../services/git.service.js";

import type {
  Issue
} from "../types/issue.js";

export interface ScanOptions {
  json?: boolean;
  changed?: boolean;
  base?: string;
}

async function runAnalyzerSafely(
  name: string,
  category: Issue["category"],
  fn: () => Promise<Issue[]> | Issue[]
): Promise<Issue[]> {
  try {
    return await fn();
  } catch (error) {
    return [
      {
        severity: "error",
        category,
        title: `${name} failed`,
        message:
          error instanceof Error
            ? error.message
            : `An unexpected error occurred in ${name}.`,
        suggestion: `Check your project files or configuration for ${name}.`
      }
    ];
  }
}

export async function collectIssues(projectPath = "."): Promise<Issue[]> {
  const absolutePath = path.resolve(projectPath);
  const config = await loadLumenConfig(absolutePath);

  const projectIssues = await runAnalyzerSafely(
    "Project analyzer",
    "project",
    () => analyzeProject(absolutePath)
  );

  const dependencyIssues =
    config.dependency?.checkUpdates === false
      ? []
      : await runAnalyzerSafely(
          "Dependency analyzer",
          "dependency",
          () => analyzeDependencies(absolutePath)
        );

  const securityIssues =
    config.security?.enabled === false
      ? []
      : await runAnalyzerSafely(
          "Security analyzer",
          "security",
          () => analyzeSecurity(absolutePath)
        );

  const secretIssues =
    config.security?.enabled === false
      ? []
      : await runAnalyzerSafely(
          "Secret analyzer",
          "security",
          () =>
            analyzeSecrets(
              absolutePath,
              {
                ignore: config.ignore
              }
            )
        );

  const environmentIssues =
    config.environment?.enabled === false
      ? []
      : await runAnalyzerSafely(
          "Environment analyzer",
          "environment",
          () =>
            analyzeEnvironment(
              absolutePath,
              {
                ignore: config.ignore
              }
            )
        );

  return deduplicateIssues([
    ...projectIssues,
    ...dependencyIssues,
    ...securityIssues,
    ...secretIssues,
    ...environmentIssues
  ]);
}

export async function scanCommand(
  projectPath = ".",
  options: ScanOptions = {}
) {
  const absolutePath = path.resolve(projectPath);

  if (
    !fs.existsSync(absolutePath) ||
    !fs.statSync(absolutePath).isDirectory()
  ) {
    const errorIssue: Issue = {
      severity: "error",
      category: "project",
      title: "Project directory not found",
      message: `The project directory does not exist: ${absolutePath}`,
      suggestion: "Please verify that the target directory exists and is accessible."
    };

    if (options.json) {
      console.log(
        formatJsonResult([errorIssue], absolutePath)
      );
    } else {
      console.error(
        pc.red(`Error: Project directory does not exist: ${absolutePath}`)
      );
      console.error(
        pc.dim("Please verify that the target directory exists and is accessible.")
      );
    }

    process.exitCode = 1;
    return;
  }

  const config = await loadLumenConfig(
    absolutePath
  );

  let rawIssues: Issue[] = [];

  let changedFileCount: number | undefined;

  const isChangedMode = Boolean(options.changed || options.base);

  if (isChangedMode) {
    const ignorePatterns = mergeIgnorePatterns(
      loadLumenIgnore(absolutePath),
      config.ignore ?? []
    );

    let changedFiles: string[];

    try {
      changedFiles = getChangedFiles(
        absolutePath,
        ignorePatterns,
        options.base
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to read Git changes.";

      if (options.json) {
        const errorIssue: Issue = {
          severity: "error",
          category: "project",
          title: "Git changes unavailable",
          message: errorMessage,
          suggestion:
            "Make sure Git is installed and the target directory is inside a Git repository."
        };

        console.log(
          formatJsonResult([errorIssue], absolutePath)
        );
      } else {
        console.error(pc.red(errorMessage));
      }

      process.exitCode = 1;
      return;
    }

    changedFileCount = changedFiles.length;

    if (config.security?.enabled === false) {
      rawIssues = [
        {
          severity: "info",
          category: "security",
          title: "Secret scanning is disabled",
          message:
            "Enable security scanning in lumen.config.ts to scan changed files for secrets."
        }
      ];
    } else if (changedFiles.length === 0) {
      rawIssues = [
        {
          severity: "info",
          category: "security",
          title: "No changed files to scan",
          message:
            "Git did not report any eligible changed files."
        }
      ];
    } else {
      rawIssues = await runAnalyzerSafely(
        "Secret analyzer",
        "security",
        () =>
          analyzeSecrets(
            absolutePath,
            {
              ignore: config.ignore,
              changedFiles
            }
          )
      );
    }
  } else {
    rawIssues = await collectIssues(absolutePath);
  }

  const issues = deduplicateIssues(rawIssues);

  if (options.json) {
    console.log(
      formatJsonResult(
        issues,
        absolutePath
      )
    );

    if (shouldFail(issues, config.failOn ?? "error")) {
      process.exitCode = 1;
    }

    return;
  }

  console.log();
  console.log(pc.bold("Lumen"));
  console.log(pc.dim("Illuminate your code."));
  console.log();
  console.log(pc.dim(`Scanning: ${absolutePath}`));

  if (isChangedMode) {
    const modeLabel = options.base
      ? `Mode: changed files compared against ${options.base} (secret scanning only)`
      : "Mode: changed files (secret scanning only)";

    console.log(pc.cyan(modeLabel));

    console.log(
      pc.dim(
        `Eligible changed files: ${changedFileCount ?? 0}`
      )
    );
  }

  console.log();

  const grouped = groupIssuesByCategory(issues);

  printCategory("Project", grouped.project);
  printCategory("Dependencies", grouped.dependency);
  printCategory("Security", grouped.security);
  printCategory("Environment", grouped.environment);
  printCategory("Code", grouped.code);
  printCategory("Configuration", grouped.configuration);

  printSummary(issues);

  if (shouldFail(issues, config.failOn ?? "error")) {
    process.exitCode = 1;
  }
}

function shouldFail(
  issues: Issue[],
  failOn: "error" | "warning" | "none"
): boolean {
  switch (failOn) {
    case "none":
      return false;

    case "warning":
      return issues.some(
        (issue) =>
          issue.severity === "warning" ||
          issue.severity === "error"
      );

    case "error":
    default:
      return issues.some(
        (issue) => issue.severity === "error"
      );
  }
}

function printCategory(
  title: string,
  issues: Issue[]
) {
  if (issues.length === 0) {
    return;
  }

  console.log(pc.bold(title));
  console.log(
    pc.dim("──────────────────────────────")
  );

  for (const issue of issues) {
    printIssue(issue);
  }
}
