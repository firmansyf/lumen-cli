
import { Command } from "commander";

import {
  initCommand
} from "./commands/init.command.js";

import {
  scanCommand
} from "./commands/scan.command.js";

const program = new Command();

program
  .name("lumen")
  .description("Illuminate your code.")
  .version("0.1.4");

program
  .command("init")
  .description("Create a Lumen configuration file")
  .argument(
    "[path]",
    "Project path",
    "."
  )
  .action((projectPath: string) => {
    initCommand(projectPath);
  });

program
  .command("scan")
  .description("Analyze your project")
  .argument(
    "[path]",
    "Project path",
    "."
  )
  .option(
    "--json",
    "Output scan results as JSON"
  )
  .action(async (projectPath, options) => {
    await scanCommand(projectPath, options);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(
    "Lumen CLI failed:",
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});
