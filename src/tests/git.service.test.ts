
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  execFileSync
} from "node:child_process";

import {
  getChangedFiles
} from "../services/git.service.js";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn()
}));

describe("git.service", () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "lumen-git-test-")
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(projectPath, {
      recursive: true,
      force: true
    });
  });

  function mockGitStatus(status: string) {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("true" as never)
      .mockReturnValueOnce(status as never);
  }

  it("returns modified and untracked files", () => {
    fs.mkdirSync(
      path.join(projectPath, "src"),
      { recursive: true }
    );

    fs.writeFileSync(
      path.join(projectPath, "src", "app.ts"),
      "console.log('updated');"
    );

    fs.writeFileSync(
      path.join(projectPath, "new.ts"),
      "console.log('new');"
    );

    mockGitStatus(
      " M src/app.ts\0?? new.ts\0"
    );

    expect(
      getChangedFiles(projectPath)
    ).toEqual([
      "new.ts",
      "src/app.ts"
    ]);
  });

  it("excludes deleted files", () => {
    mockGitStatus(
      " D deleted.ts\0"
    );

    expect(
      getChangedFiles(projectPath)
    ).toEqual([]);
  });

  it("ignores files matching ignore rules", () => {
    fs.mkdirSync(
      path.join(projectPath, "fixtures"),
      { recursive: true }
    );

    fs.writeFileSync(
      path.join(projectPath, "fixtures", "example.ts"),
      "const value = true;"
    );

    mockGitStatus(
      "?? fixtures/example.ts\0"
    );

    expect(
      getChangedFiles(
        projectPath,
        ["fixtures/"]
      )
    ).toEqual([]);
  });

  it("throws when Git is unavailable or the directory is not a repository", () => {
    vi.mocked(execFileSync).mockImplementation(
      () => {
        throw new Error("Git failed");
      }
    );

    expect(() =>
      getChangedFiles(projectPath)
    ).toThrow(/Git changes/);
  });
});
