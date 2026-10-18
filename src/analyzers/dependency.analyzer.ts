import fs from "node:fs";
import path from "node:path";

import semver from "semver";

import type { Issue } from "../types/issue.js";

import { getLatestVersion } from "../services/npm-registry.service.js";

import { getInstalledVersion } from "../services/package.service.js";

import {
  getDependencyUpdateType,
  isVersionInRange
} from "../utils/dependency.utils.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function isNonSemverRange(range: string): boolean {
  return (
    range.startsWith("workspace:") ||
    range.startsWith("file:") ||
    range.startsWith("link:") ||
    range.startsWith("git") ||
    range.startsWith("http:") ||
    range.startsWith("https:") ||
    range.startsWith("npm:")
  );
}

const DEPENDENCY_CONCURRENCY = 8;

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

export async function analyzeDependencies(
  projectPath: string
): Promise<Issue[]> {
  const issues: Issue[] = [];

  const packageJsonPath = path.join(
    projectPath,
    "package.json"
  );

  if (!fs.existsSync(packageJsonPath)) {
    return issues;
  }

  let packageJson: PackageJson;

  try {
    packageJson = JSON.parse(
      fs.readFileSync(
        packageJsonPath,
        "utf-8"
      )
    ) as PackageJson;
  } catch {
    issues.push({
      severity: "error",
      category: "dependency",
      title: "Invalid package.json",
      message:
        "Lumen could not parse package.json.",
      file: "package.json",
      suggestion:
        "Check the JSON syntax in package.json."
    });

    return issues;
  }

  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  const dependencyEntries =
    Object.entries(dependencies);

  if (dependencyEntries.length === 0) {
    issues.push({
      severity: "info",
      category: "dependency",
      title: "No dependencies found",
      message:
        "This project does not have any npm dependencies.",
      file: "package.json"
    });

    return issues;
  }

  issues.push({
    severity: "info",
    category: "dependency",
    title: "Dependencies detected",
    message:
      `${dependencyEntries.length} dependencies found.`,
    file: "package.json"
  });

  const results = await mapConcurrent(
    dependencyEntries,
    DEPENDENCY_CONCURRENCY,
    async ([packageName, declaredVersion]) => {
        const installedVersion =
          getInstalledVersion(
            projectPath,
            packageName
          );

        if (!installedVersion) {
          return {
            severity: "warning" as const,
            category: "dependency" as const,
            title:
              `${packageName} is not installed`,
            message:
              `Declared: ${declaredVersion}`,
            file: "package.json",
            suggestion:
              "Run your package manager install command.",
            metadata: {
              declaredVersion
            }
          };
        }

        const latestVersion =
          await getLatestVersion(
            packageName
          );

        if (!latestVersion) {
          return {
            severity: "warning" as const,
            category: "dependency" as const,
            title:
              `Unable to check ${packageName}`,
            message:
              `Declared: ${declaredVersion} · Installed: ${installedVersion}`,
            file: "package.json",
            suggestion:
              "Check your internet connection or npm registry availability.",
            metadata: {
              declaredVersion,
              installedVersion
            }
          };
        }

        const parsedInstalledVersion =
          semver.valid(
            installedVersion
          );

        const parsedLatestVersion =
          semver.valid(
            latestVersion
          );

        if (
          !parsedInstalledVersion ||
          !parsedLatestVersion
        ) {
          return {
            severity: "warning" as const,
            category: "dependency" as const,
            title:
              `Unable to compare ${packageName}`,
            message:
              `Declared: ${declaredVersion} · Installed: ${installedVersion} · Latest: ${latestVersion}`,
            file: "package.json",
            suggestion:
              "Check the dependency version format.",
            metadata: {
              declaredVersion,
              installedVersion,
              latestVersion
            }
          };
        }

        const installedMatchesDeclared =
          isNonSemverRange(declaredVersion) ||
          isVersionInRange(
            parsedInstalledVersion,
            declaredVersion
          );

        if (!installedMatchesDeclared) {
          return {
            severity: "warning" as const,
            category: "dependency" as const,
            title:
              `${packageName} does not match declared version range`,
            message:
              `Declared: ${declaredVersion} · Installed: ${parsedInstalledVersion}`,
            file: "package.json",
            suggestion:
              `Run your package manager install command to restore ${packageName} to the declared range.`,
            metadata: {
              declaredVersion,
              installedVersion:
                parsedInstalledVersion
            }
          };
        }

        const isLatestInDeclaredRange =
          isNonSemverRange(declaredVersion) ||
          isVersionInRange(
            parsedLatestVersion,
            declaredVersion
          );

        const isOutdated =
          semver.lt(
            parsedInstalledVersion,
            parsedLatestVersion
          );

        if (isOutdated) {
          const updateType =
            getDependencyUpdateType(
              parsedInstalledVersion,
              parsedLatestVersion
            );

          if (!isLatestInDeclaredRange) {
            return {
              severity:
                updateType === "major"
                  ? ("warning" as const)
                  : ("info" as const),

              category: "dependency" as const,

              title:
                `${packageName} has a ${updateType} update outside declared range`,

              message:
                `Declared: ${declaredVersion} · Installed: ${parsedInstalledVersion} · Latest: ${parsedLatestVersion}`,

              file: "package.json",

              suggestion:
                `Review the ${updateType} upgrade before changing the declared version.`,

              metadata: {
                declaredVersion,
                installedVersion:
                  parsedInstalledVersion,
                latestVersion:
                  parsedLatestVersion,
                updateType
              }
            };
          }

          return {
            severity: "warning" as const,

            category: "dependency" as const,

            title:
              `${packageName} has a ${updateType} update available`,

            message:
              `Declared: ${declaredVersion} · Installed: ${parsedInstalledVersion} · Latest: ${parsedLatestVersion}`,

            file: "package.json",

            suggestion:
              `Update ${packageName} to ${parsedLatestVersion}.`,

            metadata: {
              declaredVersion,
              installedVersion:
                parsedInstalledVersion,
              latestVersion:
                parsedLatestVersion,
              updateType
            }
          };
        }

        return {
          severity: "info" as const,

          category: "dependency" as const,

          title:
            `${packageName} is up to date`,

          message:
            `Declared: ${declaredVersion} · Installed: ${parsedInstalledVersion} · Latest: ${parsedLatestVersion}`,

          file: "package.json",

          metadata: {
            declaredVersion,
            installedVersion:
              parsedInstalledVersion,
            latestVersion:
              parsedLatestVersion
          }
        };
      }
    );

  issues.push(...results);

  return issues;
}