
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  shouldIgnorePath
} from "../utils/ignore.utils.js";

export function getChangedFiles(
  projectPath: string,
  ignorePatterns: string[] = [],
  baseRef?: string
): string[] {
  let output: string;
  let repoRoot: string;

  try {
    const revParseOutput = execFileSync(
      "git",
      ["rev-parse", "--is-inside-work-tree", "--show-toplevel"],
      {
        cwd: projectPath,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }
    ).trim();

    const [insideWorkTree, toplevel] = revParseOutput.split(/\r?\n/);

    if (insideWorkTree !== "true") {
      throw new Error("Not a Git repository.");
    }

    repoRoot = toplevel
      ? path.resolve(toplevel)
      : path.resolve(projectPath);

    if (baseRef) {
      const diffRevision = baseRef.includes("..")
        ? baseRef
        : `${baseRef}...HEAD`;

      try {
        output = execFileSync(
          "git",
          [
            "diff",
            "--name-only",
            "-z",
            "--diff-filter=d",
            diffRevision
          ],
          {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
          }
        );
      } catch {
        throw new Error(
          `Cannot compare against base '${baseRef}'. Make sure the base reference exists (e.g. run 'git fetch origin ${baseRef}').`
        );
      }
    } else {
      output = execFileSync(
        "git",
        [
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all"
        ],
        {
          cwd: projectPath,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"]
        }
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Cannot compare against base")
    ) {
      throw error;
    }

    throw new Error(
      "Cannot read Git changes. Make sure Git is installed and the target directory is inside a Git repository."
    );
  }

  const entries = output.split("\0");
  const changedFiles = new Set<string>();

  if (baseRef) {
    for (const relativePath of entries) {
      if (!relativePath) {
        continue;
      }

      const absolutePath = path.resolve(
        repoRoot,
        relativePath
      );

      const resolvedRelativePath = path.relative(
        projectPath,
        absolutePath
      );

      if (
        resolvedRelativePath === "" ||
        resolvedRelativePath === ".." ||
        resolvedRelativePath.startsWith(`..${path.sep}`) ||
        resolvedRelativePath.startsWith("../") ||
        path.isAbsolute(resolvedRelativePath)
      ) {
        continue;
      }

      if (
        shouldIgnorePath(
          projectPath,
          absolutePath,
          ignorePatterns
        )
      ) {
        continue;
      }

      try {
        if (!fs.statSync(absolutePath).isFile()) {
          continue;
        }

        const realProjectPath = fs.realpathSync(projectPath);
        const realFilePath = fs.realpathSync(absolutePath);
        const realRel = path.relative(realProjectPath, realFilePath);

        if (
          realRel === "" ||
          realRel === ".." ||
          realRel.startsWith(`..${path.sep}`) ||
          realRel.startsWith("../") ||
          path.isAbsolute(realRel)
        ) {
          continue;
        }
      } catch {
        continue;
      }

      changedFiles.add(
        resolvedRelativePath.split(path.sep).join("/")
      );
    }

    return [...changedFiles].sort();
  }

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];

    if (!entry || entry.length < 4 || entry[2] !== " ") {
      continue;
    }

    const status = entry.slice(0, 2);
    const relativePath = entry.slice(3);

    // A renamed or copied file may have an additional
    // original-path entry in Git's NUL-delimited output.
    if (status.includes("R") || status.includes("C")) {
      index++;
    }

    // Deleted files cannot be scanned.
    if (status.includes("D")) {
      continue;
    }

    const absolutePath = path.resolve(
      repoRoot,
      relativePath
    );

    const resolvedRelativePath = path.relative(
      projectPath,
      absolutePath
    );

    // Do not allow paths outside the project.
    if (
      resolvedRelativePath === "" ||
      resolvedRelativePath === ".." ||
      resolvedRelativePath.startsWith(`..${path.sep}`) ||
      resolvedRelativePath.startsWith("../") ||
      path.isAbsolute(resolvedRelativePath)
    ) {
      continue;
    }

    if (
      shouldIgnorePath(
        projectPath,
        absolutePath,
        ignorePatterns
      )
    ) {
      continue;
    }

    try {
      if (!fs.statSync(absolutePath).isFile()) {
        continue;
      }

      const realProjectPath = fs.realpathSync(projectPath);
      const realFilePath = fs.realpathSync(absolutePath);
      const realRel = path.relative(realProjectPath, realFilePath);

      if (
        realRel === "" ||
        realRel === ".." ||
        realRel.startsWith(`..${path.sep}`) ||
        realRel.startsWith("../") ||
        path.isAbsolute(realRel)
      ) {
        continue;
      }
    } catch {
      continue;
    }

    changedFiles.add(
      resolvedRelativePath.split(path.sep).join("/")
    );
  }

  return [...changedFiles].sort();
}
