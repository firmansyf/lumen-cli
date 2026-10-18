import path from "node:path";

import { collectIssues } from "./scan.command.js";
import { saveBaseline } from "../services/baseline.service.js";

export async function createBaselineCommand(
  projectPath = "."
) {
  const absolutePath = path.resolve(projectPath);
  const issues = await collectIssues(absolutePath);
  const baselinePath = saveBaseline(
    absolutePath,
    issues
  );

  console.log(`Baseline saved: ${baselinePath}`);
  console.log(`Issues recorded: ${issues.length}`);
}