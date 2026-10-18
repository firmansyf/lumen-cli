
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
  initCommand
} from "../commands/init.command.js";

const directories: string[] = [];

function createTempProject(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "lumen-init-")
  );

  directories.push(directory);

  return directory;
}

describe("init.command", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.exitCode = 0;

    errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    logSpy = vi
      .spyOn(console, "log")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    for (const directory of directories) {
      fs.rmSync(directory, {
        recursive: true,
        force: true
      });
    }

    directories.length = 0;
    process.exitCode = 0;
    vi.restoreAllMocks();
  });

  it("should create a default JSON config", () => {
    const project = createTempProject();

    initCommand(project);

    const configPath = path.join(
      project,
      "lumen.config.json"
    );

    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(
      fs.readFileSync(configPath, "utf8")
    );

    expect(config.failOn).toBe("error");

    expect(config.dependency.checkUpdates).toBe(true);
    expect(config.security.enabled).toBe(true);
    expect(config.environment.enabled).toBe(true);

    expect(config.ignore).toContain("node_modules/**");
  });

  it("should not overwrite an existing JSON config", () => {
    const project = createTempProject();

    const configPath = path.join(
      project,
      "lumen.config.json"
    );

    const original = '{"failOn":"warning"}';

    fs.writeFileSync(configPath, original);

    initCommand(project);

    expect(
      fs.readFileSync(configPath, "utf8")
    ).toBe(original);
  });

  it("should not overwrite an existing TypeScript config", () => {
    const project = createTempProject();

    fs.writeFileSync(
      path.join(project, "lumen.config.ts"),
      "export default {};"
    );

    initCommand(project);

    expect(
      fs.existsSync(
        path.join(project, "lumen.config.json")
      )
    ).toBe(false);
  });

  it("should report a missing directory", () => {
    const project = path.join(
      os.tmpdir(),
      `lumen-missing-${Date.now()}`
    );

    initCommand(project);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
