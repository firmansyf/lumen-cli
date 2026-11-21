
import { Command } from "commander";

import {
  initCommand
} from "./commands/init.command.js";

import {
  VERSION
} from "./version.js";

import {
  scanCommand
} from "./commands/scan.command.js";

const program = new Command();

program
  .name("lumen")
  .description("Illuminate your code.")
  .version(VERSION, "-v, --version", "Output the current version");

program
  .command("init")
  .description("Create a Lumen configuration file")
  .argument("[path]", "Project path", ".")
  .action((projectPath: string) => {
    initCommand(projectPath);
  });

program
  .command("scan")
  .description("Analyze your project")
  .argument("[path]", "Project path", ".")
  .option("--json", "Output scan results as JSON")
  .option(
    "--changed",
    "Scan changed Git files for hardcoded secrets only"
  )
  .option(
    "--base <ref>",
    "Base Git branch or reference to compare against (e.g. origin/main)"
  )
  .action(async (projectPath, options) => {
    await scanCommand(
      projectPath,
      options
    );
  });

if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  program.parseAsync().catch((error: unknown) => {
    console.error(
      "Lumen CLI failed:",
      error instanceof Error
        ? error.message
        : error
    );

    process.exitCode = 1;
  });
}

