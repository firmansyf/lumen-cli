import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scanCommand } from "../commands/scan.command.js";
import { getChangedFiles } from "../services/git.service.js";

describe("git-aware changed scanning integration", () => {
  let tempRoot: string;
  const tempDirs: string[] = [];

  function createTempGitRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-git-integ-"));
    tempDirs.push(dir);

    execSync("git init", { cwd: dir, stdio: "ignore" });
    execSync("git config user.name test && git config user.email test@test.com", {
      cwd: dir,
      stdio: "ignore"
    });

    return dir;
  }

  function commitAll(repoDir: string, message = "commit"): void {
    execSync("git add .", { cwd: repoDir, stdio: "ignore" });
    execSync(`git commit -m "${message}"`, { cwd: repoDir, stdio: "ignore" });
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
        // ignore cleanup errors
      }
    }
    tempDirs.length = 0;
    vi.restoreAllMocks();
  });

  it("detects untracked files and modified tracked files", () => {
    const repo = createTempGitRepo();

    fs.writeFileSync(path.join(repo, "tracked.ts"), "const a = 1;");
    commitAll(repo, "initial");

    // Modify tracked file
    fs.writeFileSync(path.join(repo, "tracked.ts"), "const a = 2;");

    // Create untracked file
    fs.writeFileSync(path.join(repo, "untracked.ts"), "const b = 3;");

    const changed = getChangedFiles(repo);
    expect(changed).toContain("tracked.ts");
    expect(changed).toContain("untracked.ts");
  });

  it("excludes deleted files without crashing", () => {
    const repo = createTempGitRepo();

    fs.writeFileSync(path.join(repo, "delete-me.ts"), "content");
    commitAll(repo, "add file");

    fs.unlinkSync(path.join(repo, "delete-me.ts"));

    const changed = getChangedFiles(repo);
    expect(changed).toEqual([]);
    expect(changed).not.toContain("delete-me.ts");
  });

  it("handles renamed files with spaces and special characters", () => {
    const repo = createTempGitRepo();

    const oldName = "old [source] name.ts";
    const newName = "new [destination] with spaces.ts";

    fs.writeFileSync(path.join(repo, oldName), "const secret = 123;");
    commitAll(repo, "initial");

    execSync(`git mv "${oldName}" "${newName}"`, { cwd: repo, stdio: "ignore" });

    const changed = getChangedFiles(repo);
    expect(changed).toContain(newName);
    expect(changed).not.toContain(oldName);
  });

  it("handles nested directories and special symbols safely", () => {
    const repo = createTempGitRepo();

    const nestedDir = path.join(repo, "src", "nested (dir)", "deep");
    fs.mkdirSync(nestedDir, { recursive: true });

    const nestedFile = path.join(nestedDir, "file#1$special.ts");
    fs.writeFileSync(nestedFile, "const x = 1;");

    const changed = getChangedFiles(repo);
    expect(changed).toContain("src/nested (dir)/deep/file#1$special.ts");
  });

  it("ignores files matching .lumenignore", () => {
    const repo = createTempGitRepo();

    fs.writeFileSync(path.join(repo, ".lumenignore"), "ignored-dir/\n*.ignored.ts\n");
    fs.writeFileSync(path.join(repo, "valid.ts"), "const initial = 1;");
    commitAll(repo, "initial");

    const ignoredDir = path.join(repo, "ignored-dir");
    fs.mkdirSync(ignoredDir, { recursive: true });
    fs.writeFileSync(path.join(ignoredDir, "secret.ts"), "const apiKey = 'test';");
    fs.writeFileSync(path.join(repo, "sample.ignored.ts"), "const token = 'test';");
    fs.writeFileSync(path.join(repo, "valid.ts"), "const normal = 2;");

    const changed = getChangedFiles(repo, ["ignored-dir/", "*.ignored.ts"]);
    expect(changed).toEqual(["valid.ts"]);
  });

  it("throws clear and actionable error when target is not a Git repo", () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-non-git-"));
    tempDirs.push(nonGitDir);

    expect(() => getChangedFiles(nonGitDir)).toThrow(
      /Make sure Git is installed and the target directory is inside a Git repository/
    );
  });

  it("outputs valid JSON when outside Git repository with --changed --json", async () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-non-git-json-"));
    tempDirs.push(nonGitDir);

    let loggedOutput = "";
    vi.spyOn(console, "log").mockImplementation((msg) => {
      loggedOutput += String(msg);
    });

    await scanCommand(nonGitDir, { changed: true, json: true });

    expect(process.exitCode).toBe(1);
    expect(() => JSON.parse(loggedOutput)).not.toThrow();

    const parsed = JSON.parse(loggedOutput);
    expect(parsed.tool).toBe("lumen");
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.issues[0].title).toBe("Git changes unavailable");
  });

  it("prevents symlink path traversal to outside root project", () => {
    const repo = createTempGitRepo();

    // Create a target file outside the git repository
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "lumen-outside-"));
    tempDirs.push(outsideDir);
    const outsideSecret = path.join(outsideDir, "outside-secret.txt");
    fs.writeFileSync(outsideSecret, "super-secret");

    // Create a symlink inside the repo pointing outside
    const linkPath = path.join(repo, "link-to-outside.txt");
    try {
      fs.symlinkSync(outsideSecret, linkPath);
    } catch {
      // In case OS doesn't permit symlinks in test environment
      return;
    }

    const changed = getChangedFiles(repo);
    // The symlink pointing outside should NOT be allowed as an eligible file
    expect(changed).not.toContain("link-to-outside.txt");
  });

  it("resolves changed files correctly when scanning a subdirectory of a Git repository", () => {
    const repo = createTempGitRepo();

    const packageDir = path.join(repo, "packages", "web");
    fs.mkdirSync(packageDir, { recursive: true });

    fs.writeFileSync(path.join(repo, "root-file.ts"), "root");
    fs.writeFileSync(path.join(packageDir, "package-file.ts"), "package");
    commitAll(repo, "init");

    // Modify both
    fs.writeFileSync(path.join(repo, "root-file.ts"), "modified root");
    fs.writeFileSync(path.join(packageDir, "package-file.ts"), "modified package");

    // Scan from subdirectory
    const changed = getChangedFiles(packageDir);
    expect(changed).toContain("package-file.ts");
    expect(changed).not.toContain("root-file.ts");
  });

  it("compares commits against a base branch ref using git diff", () => {
    const repo = createTempGitRepo();

    fs.writeFileSync(path.join(repo, "base-file.ts"), "const base = 1;");
    fs.writeFileSync(path.join(repo, "to-remove.ts"), "remove");
    commitAll(repo, "initial on default branch");

    // Get current branch name
    const defaultBranch = execSync("git branch --show-current", {
      cwd: repo,
      encoding: "utf8"
    }).trim();

    // Create feature branch
    execSync("git checkout -b feature-ci", { cwd: repo, stdio: "ignore" });

    // Add and modify on feature branch
    fs.writeFileSync(path.join(repo, "feature-new.ts"), "const newFeature = true;");
    fs.writeFileSync(path.join(repo, "base-file.ts"), "const base = 2;");
    fs.unlinkSync(path.join(repo, "to-remove.ts"));
    commitAll(repo, "feature commit");

    const changed = getChangedFiles(repo, [], defaultBranch);
    expect(changed).toContain("feature-new.ts");
    expect(changed).toContain("base-file.ts");
    expect(changed).not.toContain("to-remove.ts");
  });

  it("throws actionable error when base branch does not exist", () => {
    const repo = createTempGitRepo();
    fs.writeFileSync(path.join(repo, "init.txt"), "hello");
    commitAll(repo, "init");

    expect(() =>
      getChangedFiles(repo, [], "non-existent-base-ref")
    ).toThrow(
      /Cannot compare against base 'non-existent-base-ref'/
    );
  });
});
