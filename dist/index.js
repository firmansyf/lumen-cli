#!/usr/bin/env node

// src/index.ts
import { Command } from "commander";

// src/commands/init.command.ts
import fs from "fs";
import path from "path";
import pc from "picocolors";
var CONFIG_FILES = [
  "lumen.config.ts",
  "lumen.config.mts",
  "lumen.config.js",
  "lumen.config.mjs",
  "lumen.config.json"
];
var CONFIG_TEMPLATE = {
  ignore: [
    "dist/**",
    "coverage/**",
    "node_modules/**"
  ],
  failOn: "error",
  dependency: {
    checkUpdates: true
  },
  security: {
    enabled: true
  },
  environment: {
    enabled: true
  }
};
function initCommand(projectPath = ".") {
  const absolutePath = path.resolve(projectPath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    console.error(
      pc.red(
        `Project directory does not exist: ${absolutePath}`
      )
    );
    process.exitCode = 1;
    return;
  }
  const existingConfig = CONFIG_FILES.find(
    (fileName) => fs.existsSync(
      path.join(absolutePath, fileName)
    )
  );
  if (existingConfig) {
    console.log(
      pc.yellow(
        `Configuration already exists: ${existingConfig}`
      )
    );
    console.log("No files were changed.");
    return;
  }
  const configPath = path.join(
    absolutePath,
    "lumen.config.json"
  );
  try {
    fs.writeFileSync(
      configPath,
      `${JSON.stringify(CONFIG_TEMPLATE, null, 2)}
`,
      {
        encoding: "utf8",
        flag: "wx"
      }
    );
    console.log(
      pc.green("\u2713 Created lumen.config.json")
    );
    console.log(
      pc.dim(
        "You can now customize your Lumen scan settings."
      )
    );
  } catch (error) {
    console.error(
      pc.red("Failed to create Lumen configuration.")
    );
    if (error instanceof Error) {
      console.error(pc.dim(error.message));
    }
    process.exitCode = 1;
  }
}

// src/commands/scan.command.ts
import fs12 from "fs";
import path11 from "path";
import pc4 from "picocolors";

// src/analyzers/project.analyzer.ts
import fs2 from "fs";
import path2 from "path";
function analyzeProject(projectPath) {
  const issues = [];
  const packageJsonPath = path2.join(projectPath, "package.json");
  const gitPath = path2.join(projectPath, ".git");
  const tsconfigPath = path2.join(projectPath, "tsconfig.json");
  if (fs2.existsSync(packageJsonPath)) {
    issues.push({
      severity: "info",
      category: "project",
      title: "package.json detected",
      message: "Node.js project detected.",
      file: "package.json"
    });
  } else {
    issues.push({
      severity: "error",
      category: "project",
      title: "package.json not found",
      message: "Lumen could not find a package.json file.",
      file: "package.json",
      suggestion: "Run `npm init` or `pnpm init`."
    });
  }
  if (fs2.existsSync(gitPath)) {
    issues.push({
      severity: "info",
      category: "project",
      title: "Git repository detected",
      message: "Git repository is configured."
    });
  } else {
    issues.push({
      severity: "warning",
      category: "project",
      title: "Git repository not found",
      message: "This project does not appear to be a Git repository.",
      suggestion: "Run `git init` to initialize Git."
    });
  }
  if (fs2.existsSync(tsconfigPath)) {
    issues.push({
      severity: "info",
      category: "project",
      title: "TypeScript detected",
      message: "TypeScript configuration found.",
      file: "tsconfig.json"
    });
  }
  return issues;
}

// src/analyzers/dependency.analyzer.ts
import fs4 from "fs";
import path4 from "path";
import semver2 from "semver";

// src/services/npm-registry.service.ts
var NPM_REGISTRY_TIMEOUT_MS = 5e3;
async function getLatestVersion(packageName) {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      {
        signal: AbortSignal.timeout(NPM_REGISTRY_TIMEOUT_MS)
      }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data["dist-tags"]?.latest ?? null;
  } catch {
    return null;
  }
}

// src/services/package.service.ts
import fs3 from "fs";
import path3 from "path";
function getInstalledVersion(projectPath, packageName) {
  const packageJsonPath = path3.join(
    projectPath,
    "node_modules",
    packageName,
    "package.json"
  );
  if (!fs3.existsSync(packageJsonPath)) {
    return null;
  }
  try {
    const packageJson = JSON.parse(
      fs3.readFileSync(packageJsonPath, "utf-8")
    );
    return packageJson.version ?? null;
  } catch {
    return null;
  }
}

// src/utils/dependency.utils.ts
import semver from "semver";
function getDependencyUpdateType(currentVersion, latestVersion) {
  const diff = semver.diff(
    currentVersion,
    latestVersion
  );
  switch (diff) {
    case "major":
      return "major";
    case "minor":
      return "minor";
    case "patch":
      return "patch";
    case "premajor":
    case "preminor":
    case "prepatch":
    case "prerelease":
      return "prerelease";
    default:
      return "unknown";
  }
}
function isVersionInRange(version, range) {
  try {
    return semver.satisfies(
      version,
      range
    );
  } catch {
    return false;
  }
}

// src/analyzers/dependency.analyzer.ts
function isNonSemverRange(range) {
  return range.startsWith("workspace:") || range.startsWith("file:") || range.startsWith("link:") || range.startsWith("git") || range.startsWith("http:") || range.startsWith("https:") || range.startsWith("npm:");
}
var DEPENDENCY_CONCURRENCY = 8;
async function mapConcurrent(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
async function analyzeDependencies(projectPath) {
  const issues = [];
  const packageJsonPath = path4.join(
    projectPath,
    "package.json"
  );
  if (!fs4.existsSync(packageJsonPath)) {
    return issues;
  }
  let packageJson;
  try {
    packageJson = JSON.parse(
      fs4.readFileSync(
        packageJsonPath,
        "utf-8"
      )
    );
  } catch {
    issues.push({
      severity: "error",
      category: "dependency",
      title: "Invalid package.json",
      message: "Lumen could not parse package.json.",
      file: "package.json",
      suggestion: "Check the JSON syntax in package.json."
    });
    return issues;
  }
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const dependencyEntries = Object.entries(dependencies);
  if (dependencyEntries.length === 0) {
    issues.push({
      severity: "info",
      category: "dependency",
      title: "No dependencies found",
      message: "This project does not have any npm dependencies.",
      file: "package.json"
    });
    return issues;
  }
  issues.push({
    severity: "info",
    category: "dependency",
    title: "Dependencies detected",
    message: `${dependencyEntries.length} dependencies found.`,
    file: "package.json"
  });
  const results = await mapConcurrent(
    dependencyEntries,
    DEPENDENCY_CONCURRENCY,
    async ([packageName, declaredVersion]) => {
      const installedVersion = getInstalledVersion(
        projectPath,
        packageName
      );
      if (!installedVersion) {
        return {
          severity: "warning",
          category: "dependency",
          title: `${packageName} is not installed`,
          message: `Declared: ${declaredVersion}`,
          file: "package.json",
          suggestion: "Run your package manager install command.",
          metadata: {
            declaredVersion
          }
        };
      }
      const latestVersion = await getLatestVersion(
        packageName
      );
      if (!latestVersion) {
        return {
          severity: "warning",
          category: "dependency",
          title: `Unable to check ${packageName}`,
          message: `Declared: ${declaredVersion} \xB7 Installed: ${installedVersion}`,
          file: "package.json",
          suggestion: "Check your internet connection or npm registry availability.",
          metadata: {
            declaredVersion,
            installedVersion
          }
        };
      }
      const parsedInstalledVersion = semver2.valid(
        installedVersion
      );
      const parsedLatestVersion = semver2.valid(
        latestVersion
      );
      if (!parsedInstalledVersion || !parsedLatestVersion) {
        return {
          severity: "warning",
          category: "dependency",
          title: `Unable to compare ${packageName}`,
          message: `Declared: ${declaredVersion} \xB7 Installed: ${installedVersion} \xB7 Latest: ${latestVersion}`,
          file: "package.json",
          suggestion: "Check the dependency version format.",
          metadata: {
            declaredVersion,
            installedVersion,
            latestVersion
          }
        };
      }
      const installedMatchesDeclared = isNonSemverRange(declaredVersion) || isVersionInRange(
        parsedInstalledVersion,
        declaredVersion
      );
      if (!installedMatchesDeclared) {
        return {
          severity: "warning",
          category: "dependency",
          title: `${packageName} does not match declared version range`,
          message: `Declared: ${declaredVersion} \xB7 Installed: ${parsedInstalledVersion}`,
          file: "package.json",
          suggestion: `Run your package manager install command to restore ${packageName} to the declared range.`,
          metadata: {
            declaredVersion,
            installedVersion: parsedInstalledVersion
          }
        };
      }
      const isLatestInDeclaredRange = isNonSemverRange(declaredVersion) || isVersionInRange(
        parsedLatestVersion,
        declaredVersion
      );
      const isOutdated = semver2.lt(
        parsedInstalledVersion,
        parsedLatestVersion
      );
      if (isOutdated) {
        const updateType = getDependencyUpdateType(
          parsedInstalledVersion,
          parsedLatestVersion
        );
        if (!isLatestInDeclaredRange) {
          return {
            severity: updateType === "major" ? "warning" : "info",
            category: "dependency",
            title: `${packageName} has a ${updateType} update outside declared range`,
            message: `Declared: ${declaredVersion} \xB7 Installed: ${parsedInstalledVersion} \xB7 Latest: ${parsedLatestVersion}`,
            file: "package.json",
            suggestion: `Review the ${updateType} upgrade before changing the declared version.`,
            metadata: {
              declaredVersion,
              installedVersion: parsedInstalledVersion,
              latestVersion: parsedLatestVersion,
              updateType
            }
          };
        }
        return {
          severity: "warning",
          category: "dependency",
          title: `${packageName} has a ${updateType} update available`,
          message: `Declared: ${declaredVersion} \xB7 Installed: ${parsedInstalledVersion} \xB7 Latest: ${parsedLatestVersion}`,
          file: "package.json",
          suggestion: `Update ${packageName} to ${parsedLatestVersion}.`,
          metadata: {
            declaredVersion,
            installedVersion: parsedInstalledVersion,
            latestVersion: parsedLatestVersion,
            updateType
          }
        };
      }
      return {
        severity: "info",
        category: "dependency",
        title: `${packageName} is up to date`,
        message: `Declared: ${declaredVersion} \xB7 Installed: ${parsedInstalledVersion} \xB7 Latest: ${parsedLatestVersion}`,
        file: "package.json",
        metadata: {
          declaredVersion,
          installedVersion: parsedInstalledVersion,
          latestVersion: parsedLatestVersion
        }
      };
    }
  );
  issues.push(...results);
  return issues;
}

// src/analyzers/security.analyzer.ts
import fs5 from "fs";
import path5 from "path";

// src/services/osv.service.ts
var OSV_TIMEOUT_MS = 5e3;
var MAX_RETRIES = 1;
var RETRY_DELAY_MS = 500;
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function queryOsv(packageName, version) {
  const query = {
    package: {
      ecosystem: "npm",
      name: packageName
    },
    version
  };
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        "https://api.osv.dev/v1/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(query),
          signal: AbortSignal.timeout(OSV_TIMEOUT_MS)
        }
      );
      if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
        await wait(RETRY_DELAY_MS);
        continue;
      }
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      if (!data || typeof data !== "object" || !Array.isArray(data.vulns)) {
        return [];
      }
      return data.vulns;
    } catch {
      if (attempt < MAX_RETRIES) {
        await wait(RETRY_DELAY_MS);
        continue;
      }
      return [];
    }
  }
  return [];
}

// src/utils/security.utils.ts
function getCvssScore(vulnerability) {
  const cvss = vulnerability.severity?.find(
    (item) => item.type === "CVSS_V3" || item.type === "CVSS_V4"
  );
  if (!cvss?.score) {
    return void 0;
  }
  const directScore = Number(cvss.score);
  if (!Number.isNaN(directScore) && directScore >= 0 && directScore <= 10) {
    return directScore;
  }
  const match = cvss.score.match(
    /CVSS:(?:3\.\d|4\.0)\/.*?\/(\d+(?:\.\d+)?)$/
  );
  if (!match) {
    return void 0;
  }
  const score = Number(match[1]);
  return Number.isNaN(score) ? void 0 : score;
}
function getCve(vulnerability) {
  return vulnerability.aliases?.find(
    (alias) => alias.startsWith("CVE-")
  );
}
function getFixedVersion(vulnerability) {
  for (const affected of vulnerability.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {
          return event.fixed;
        }
      }
    }
  }
  return void 0;
}
function getSecuritySeverity(score, databaseSeverity) {
  if (score !== void 0) {
    if (score >= 7) {
      return "error";
    }
    if (score >= 4) {
      return "warning";
    }
    return "info";
  }
  if (databaseSeverity) {
    const normalized = databaseSeverity.toUpperCase();
    if (normalized === "CRITICAL" || normalized === "HIGH") {
      return "error";
    }
    if (normalized === "MODERATE" || normalized === "MEDIUM") {
      return "warning";
    }
    if (normalized === "LOW") {
      return "info";
    }
  }
  return "warning";
}

// src/analyzers/security.analyzer.ts
var OSV_CONCURRENCY = 5;
async function mapConcurrent2(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
async function analyzeSecurity(projectPath) {
  const packageJsonPath = path5.join(
    projectPath,
    "package.json"
  );
  if (!fs5.existsSync(packageJsonPath)) {
    return [];
  }
  let packageJson;
  try {
    packageJson = JSON.parse(
      fs5.readFileSync(packageJsonPath, "utf-8")
    );
  } catch {
    return [];
  }
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const entries = Object.entries(dependencies);
  const results = await mapConcurrent2(
    entries,
    OSV_CONCURRENCY,
    async ([packageName]) => {
      try {
        const installedVersion = getInstalledVersion(
          projectPath,
          packageName
        );
        if (!installedVersion) {
          return [];
        }
        const vulnerabilities = await queryOsv(
          packageName,
          installedVersion
        );
        return vulnerabilities.map(
          (vulnerability) => {
            const cvss = getCvssScore(vulnerability);
            const cve = getCve(vulnerability);
            const fixedVersion = getFixedVersion(vulnerability);
            const severity = getSecuritySeverity(
              cvss,
              vulnerability.database_specific?.severity
            );
            const identifier = cve ?? vulnerability.id;
            return {
              severity,
              category: "security",
              title: `${packageName} has a security vulnerability`,
              message: vulnerability.summary ?? vulnerability.details ?? `Security advisory ${identifier}`,
              file: "package.json",
              suggestion: fixedVersion ? `Update ${packageName} to ${fixedVersion}.` : `Review ${identifier} and update ${packageName}.`,
              metadata: {
                advisoryId: vulnerability.id,
                cve,
                cvss,
                installedVersion,
                fixedVersion
              }
            };
          }
        );
      } catch {
        return [];
      }
    }
  );
  const issues = results.flat();
  if (issues.length === 0) {
    return [
      {
        severity: "info",
        category: "security",
        title: "No vulnerabilities found",
        message: "No known vulnerabilities were found in the installed dependencies."
      }
    ];
  }
  return issues;
}

// src/analyzers/secret.analyzer.ts
import fs7 from "fs";
import path7 from "path";

// src/utils/secret.utils.ts
var SECRET_PATTERNS = [
  {
    type: "private-key",
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i
  },
  {
    type: "aws-access-key",
    name: "AWS Access Key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/i
  },
  {
    type: "github-token",
    name: "GitHub Token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/
  },
  {
    type: "jwt",
    name: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
  },
  {
    type: "database-url",
    name: "Database URL",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'`]+/i
  },
  {
    type: "api-key",
    name: "API Key",
    pattern: /\b[A-Za-z_$]*api[_-]?key\b\s*[:=]\s*["'`][^"'`]{12,}["'`]/i
  },
  {
    type: "generic-secret",
    name: "Generic Secret",
    pattern: /\b(?:secret|token|password|passwd|auth[_-]?token)\s*[:=]\s*["'`][^"'`]{8,}["'`]/i
  }
];

// src/utils/ignore.utils.ts
import fs6 from "fs";
import path6 from "path";
var DEFAULT_IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".expo",
  "coverage",
  ".cache"
]);
var DEFAULT_IGNORED_FILES = /* @__PURE__ */ new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);
function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}
function loadLumenIgnore(projectPath) {
  const ignorePath = path6.join(
    projectPath,
    ".lumenignore"
  );
  if (!fs6.existsSync(
    ignorePath
  )) {
    return [];
  }
  try {
    return fs6.readFileSync(
      ignorePath,
      "utf-8"
    ).split(/\r?\n/).map(
      (line) => line.trim()
    ).filter(
      (line) => line.length > 0 && !line.startsWith("#")
    );
  } catch {
    return [];
  }
}
function mergeIgnorePatterns(lumenIgnore, configIgnore) {
  return [
    .../* @__PURE__ */ new Set([
      ...lumenIgnore,
      ...configIgnore
    ])
  ];
}
function globToRegExp(pattern) {
  let regex = "";
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        regex += ".*";
        index += 2;
        continue;
      }
      regex += "[^/]*";
      index++;
      continue;
    }
    if (char === "?") {
      regex += "[^/]";
      index++;
      continue;
    }
    regex += char.replace(
      /[.+^${}()|[\]\\]/g,
      "\\$&"
    );
    index++;
  }
  return new RegExp(
    `^${regex}$`
  );
}
function matchesPattern(relativePath, pattern) {
  const normalizedPath = normalizePath(
    relativePath
  );
  let normalizedPattern = normalizePath(
    pattern
  );
  const isDirectoryPattern = normalizedPattern.endsWith(
    "/"
  );
  if (isDirectoryPattern) {
    normalizedPattern = normalizedPattern.replace(
      /\/+$/,
      ""
    );
  }
  if (isDirectoryPattern) {
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(
      `${normalizedPattern}/`
    );
  }
  if (!normalizedPattern.includes(
    "/"
  )) {
    const parts = normalizedPath.split(
      "/"
    );
    const regex = globToRegExp(
      normalizedPattern
    );
    return parts.some(
      (part) => regex.test(part)
    );
  }
  return globToRegExp(
    normalizedPattern
  ).test(
    normalizedPath
  );
}
function shouldIgnorePath(projectPath, filePath, ignorePatterns = []) {
  const relativePath = normalizePath(
    path6.relative(
      projectPath,
      filePath
    )
  );
  if (relativePath === "" || relativePath.startsWith(
    "../"
  )) {
    return true;
  }
  const parts = relativePath.split(
    "/"
  );
  if (parts.some(
    (part) => DEFAULT_IGNORED_DIRECTORIES.has(
      part
    )
  )) {
    return true;
  }
  const fileName = path6.basename(
    relativePath
  );
  if (DEFAULT_IGNORED_FILES.has(
    fileName
  )) {
    return true;
  }
  return ignorePatterns.some(
    (pattern) => matchesPattern(
      relativePath,
      pattern
    )
  );
}

// src/analyzers/secret.analyzer.ts
function getFiles(projectPath, ignorePatterns) {
  const files = [];
  function walk(directory) {
    if (directory !== projectPath && shouldIgnorePath(
      projectPath,
      directory,
      ignorePatterns
    )) {
      return;
    }
    let entries;
    try {
      entries = fs7.readdirSync(directory, {
        withFileTypes: true
      });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path7.join(
        directory,
        entry.name
      );
      if (shouldIgnorePath(
        projectPath,
        fullPath,
        ignorePatterns
      )) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  walk(projectPath);
  return files;
}
function getChangedFilePaths(projectPath, changedFiles, ignorePatterns) {
  const files = /* @__PURE__ */ new Set();
  for (const changedFile of changedFiles) {
    const absolutePath = path7.resolve(
      projectPath,
      changedFile
    );
    const relativePath = path7.relative(
      projectPath,
      absolutePath
    );
    if (relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${path7.sep}`) || path7.isAbsolute(relativePath)) {
      continue;
    }
    if (shouldIgnorePath(
      projectPath,
      absolutePath,
      ignorePatterns
    )) {
      continue;
    }
    try {
      if (!fs7.statSync(absolutePath).isFile()) {
        continue;
      }
      const realProjectPath = fs7.realpathSync(projectPath);
      const realFilePath = fs7.realpathSync(absolutePath);
      const realRel = path7.relative(realProjectPath, realFilePath);
      if (realRel === "" || realRel === ".." || realRel.startsWith(`..${path7.sep}`) || realRel.startsWith("../") || path7.isAbsolute(realRel)) {
        continue;
      }
    } catch {
      continue;
    }
    files.add(absolutePath);
  }
  return [...files];
}
function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}
function analyzeSecrets(projectPath, options = {}) {
  const fileIgnore = loadLumenIgnore(projectPath);
  const ignorePatterns = mergeIgnorePatterns(
    fileIgnore,
    options.ignore ?? []
  );
  const files = options.changedFiles !== void 0 ? getChangedFilePaths(
    projectPath,
    options.changedFiles,
    ignorePatterns
  ) : getFiles(
    projectPath,
    ignorePatterns
  );
  if (options.changedFiles !== void 0 && files.length === 0) {
    return [
      {
        severity: "info",
        category: "security",
        title: "No changed files to scan",
        message: "No eligible changed files were found for secret scanning."
      }
    ];
  }
  const issues = [];
  for (const filePath of files) {
    let content;
    try {
      const stats = fs7.statSync(filePath);
      if (stats.size > 1024 * 1024) {
        continue;
      }
      content = fs7.readFileSync(
        filePath,
        "utf8"
      );
    } catch {
      continue;
    }
    for (const secret of SECRET_PATTERNS) {
      const regex = new RegExp(
        secret.pattern.source,
        secret.pattern.flags.includes("g") ? secret.pattern.flags : `${secret.pattern.flags}g`
      );
      let match;
      while ((match = regex.exec(content)) !== null) {
        const relativePath = path7.relative(
          projectPath,
          filePath
        ).split(path7.sep).join("/");
        const line = getLineNumber(
          content,
          match.index
        );
        issues.push({
          severity: "error",
          category: "security",
          title: `${secret.name} detected`,
          message: `Potential ${secret.name.toLowerCase()} found in ${relativePath}.`,
          file: relativePath,
          suggestion: "Remove the secret from source code and store it in environment variables or a secure secret manager.",
          metadata: {
            secretType: secret.type,
            line
          }
        });
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    }
  }
  if (issues.length === 0) {
    return [
      {
        severity: "info",
        category: "security",
        title: "No secrets detected",
        message: "No known hardcoded secrets were detected in the scanned files."
      }
    ];
  }
  return issues;
}

// src/analyzers/environment.analyzer.ts
import fs9 from "fs";
import path8 from "path";

// src/utils/environment.utils.ts
import fs8 from "fs";
function parseEnvironmentVariables(content) {
  const variables = /* @__PURE__ */ new Set();
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }
    const match = trimmedLine.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/
    );
    if (!match) {
      continue;
    }
    variables.add(match[1]);
  }
  return variables;
}
function readEnvironmentFile(filePath) {
  if (!fs8.existsSync(filePath)) {
    return /* @__PURE__ */ new Set();
  }
  try {
    const content = fs8.readFileSync(
      filePath,
      "utf-8"
    );
    return parseEnvironmentVariables(
      content
    );
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function extractEnvironmentVariables(content) {
  const variables = /* @__PURE__ */ new Set();
  const processEnvRegex = /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  let match;
  while ((match = processEnvRegex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  const importMetaEnvRegex = /\bimport\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  while ((match = importMetaEnvRegex.exec(content)) !== null) {
    variables.add(match[1]);
  }
  return variables;
}

// src/analyzers/environment.analyzer.ts
var IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".expo",
  "coverage",
  ".cache"
]);
var IGNORED_FILES = /* @__PURE__ */ new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);
var SOURCE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts"
]);
function shouldIgnore(filePath) {
  const parts = filePath.split(path8.sep);
  if (parts.some(
    (part) => IGNORED_DIRECTORIES.has(part)
  )) {
    return true;
  }
  return IGNORED_FILES.has(
    path8.basename(filePath)
  );
}
function getSourceFiles(projectPath, directory, ignorePatterns = []) {
  const files = [];
  if (shouldIgnore(directory) || directory !== projectPath && shouldIgnorePath(projectPath, directory, ignorePatterns)) {
    return files;
  }
  let entries;
  try {
    entries = fs9.readdirSync(
      directory,
      {
        withFileTypes: true
      }
    );
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path8.join(
      directory,
      entry.name
    );
    if (shouldIgnore(fullPath) || shouldIgnorePath(projectPath, fullPath, ignorePatterns)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(
        ...getSourceFiles(
          projectPath,
          fullPath,
          ignorePatterns
        )
      );
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = path8.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(
      extension
    )) {
      files.push(fullPath);
    }
  }
  return files;
}
function getLineNumber2(content, index) {
  return content.slice(0, index).split("\n").length;
}
function getReferencedVariables(projectPath, ignorePatterns = []) {
  const references = /* @__PURE__ */ new Map();
  const files = getSourceFiles(
    projectPath,
    projectPath,
    ignorePatterns
  );
  for (const filePath of files) {
    let content;
    try {
      const stats = fs9.statSync(filePath);
      if (stats.size > 1024 * 1024) {
        continue;
      }
      content = fs9.readFileSync(
        filePath,
        "utf-8"
      );
    } catch {
      continue;
    }
    const variables = extractEnvironmentVariables(
      content
    );
    for (const variable of variables) {
      if (references.has(variable)) {
        continue;
      }
      const processRegex = new RegExp(
        `\\bprocess\\.env\\.${variable}\\b`
      );
      const importMetaRegex = new RegExp(
        `\\bimport\\.meta\\.env\\.${variable}\\b`
      );
      const processMatch = processRegex.exec(content);
      const importMetaMatch = importMetaRegex.exec(content);
      const match = processMatch ?? importMetaMatch;
      if (!match) {
        continue;
      }
      const relativePath = path8.relative(
        projectPath,
        filePath
      );
      references.set(
        variable,
        {
          file: relativePath,
          line: getLineNumber2(
            content,
            match.index
          )
        }
      );
    }
  }
  return references;
}
function isGitignored(projectPath, target) {
  const gitignorePath = path8.join(
    projectPath,
    ".gitignore"
  );
  if (!fs9.existsSync(
    gitignorePath
  )) {
    return false;
  }
  let content;
  try {
    content = fs9.readFileSync(
      gitignorePath,
      "utf-8"
    );
  } catch {
    return false;
  }
  const lines = content.split("\n");
  const normalizedTarget = target.replace(
    /^\//,
    ""
  );
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.replace(
      /^\//,
      ""
    ).replace(
      /\/$/,
      ""
    );
    if (normalized === normalizedTarget) {
      return true;
    }
    if (normalized === ".env*" && normalizedTarget.startsWith(
      ".env"
    )) {
      return true;
    }
    if (normalized === "*.env" && normalizedTarget.endsWith(
      ".env"
    )) {
      return true;
    }
  }
  return false;
}
function analyzeEnvironment(projectPath, options = {}) {
  const issues = [];
  const fileIgnore = loadLumenIgnore(projectPath);
  const ignorePatterns = mergeIgnorePatterns(
    fileIgnore,
    options.ignore ?? []
  );
  const envPath = path8.join(
    projectPath,
    ".env"
  );
  const envExamplePath = path8.join(
    projectPath,
    ".env.example"
  );
  const hasEnv = fs9.existsSync(envPath);
  const hasEnvExample = fs9.existsSync(
    envExamplePath
  );
  const envVariables = readEnvironmentFile(
    envPath
  );
  const exampleVariables = readEnvironmentFile(
    envExamplePath
  );
  if (!hasEnv) {
    issues.push({
      severity: "info",
      category: "environment",
      title: ".env file not found",
      message: "No .env file was found in the project root.",
      suggestion: "Create a .env file if your project requires local environment variables.",
      metadata: {
        environmentIssueType: "missing-env-file",
        environmentFile: ".env"
      }
    });
  } else {
    issues.push({
      severity: "info",
      category: "environment",
      title: ".env file detected",
      message: `${envVariables.size} environment variables found in .env.`,
      file: ".env",
      metadata: {
        environmentFile: ".env"
      }
    });
  }
  if (!hasEnvExample) {
    issues.push({
      severity: "warning",
      category: "environment",
      title: ".env.example not found",
      message: "No .env.example file was found in the project root.",
      suggestion: "Create .env.example to document the environment variables required by the project.",
      metadata: {
        environmentFile: ".env.example"
      }
    });
  } else {
    issues.push({
      severity: "info",
      category: "environment",
      title: ".env.example detected",
      message: `${exampleVariables.size} environment variables documented.`,
      file: ".env.example",
      metadata: {
        environmentFile: ".env.example"
      }
    });
  }
  if (hasEnv && !isGitignored(
    projectPath,
    ".env"
  )) {
    issues.push({
      severity: "error",
      category: "environment",
      title: ".env is not ignored by Git",
      message: "The .env file may be committed to the repository.",
      file: ".gitignore",
      suggestion: "Add .env to .gitignore to prevent environment secrets from being committed.",
      metadata: {
        environmentIssueType: "gitignore-missing",
        environmentFile: ".env"
      }
    });
  }
  const references = getReferencedVariables(
    projectPath,
    ignorePatterns
  );
  if (references.size > 0 && !hasEnv) {
    for (const [
      variable,
      reference
    ] of references) {
      issues.push({
        severity: "warning",
        category: "environment",
        title: `${variable} requires environment configuration`,
        message: `Environment variable ${variable} is referenced by the source code, but .env was not found.`,
        file: reference.file,
        suggestion: `Define ${variable} in the appropriate environment configuration.`,
        metadata: {
          envVariable: variable,
          line: reference.line,
          environmentIssueType: "missing-variable"
        }
      });
    }
  }
  if (hasEnv) {
    for (const [
      variable,
      reference
    ] of references) {
      if (envVariables.has(variable)) {
        continue;
      }
      issues.push({
        severity: "warning",
        category: "environment",
        title: `${variable} is missing from .env`,
        message: `The source code references ${variable}, but it is not defined in .env.`,
        file: reference.file,
        suggestion: `Add ${variable} to your local environment configuration.`,
        metadata: {
          envVariable: variable,
          line: reference.line,
          environmentIssueType: "missing-variable"
        }
      });
    }
  }
  if (hasEnv && hasEnvExample) {
    for (const variable of envVariables) {
      if (exampleVariables.has(
        variable
      )) {
        continue;
      }
      issues.push({
        severity: "info",
        category: "environment",
        title: `${variable} is not documented in .env.example`,
        message: `${variable} exists in .env but is not documented in .env.example.`,
        file: ".env.example",
        suggestion: `Add ${variable}= to .env.example without exposing the actual secret value.`,
        metadata: {
          envVariable: variable,
          environmentIssueType: "undocumented-variable",
          environmentFile: ".env.example"
        }
      });
    }
  }
  if (hasEnvExample) {
    for (const [
      variable,
      reference
    ] of references) {
      if (exampleVariables.has(
        variable
      )) {
        continue;
      }
      issues.push({
        severity: "warning",
        category: "environment",
        title: `${variable} is not documented`,
        message: `The source code references ${variable}, but it is not listed in .env.example.`,
        file: ".env.example",
        suggestion: `Add ${variable}= to .env.example.`,
        metadata: {
          envVariable: variable,
          line: reference.line,
          environmentIssueType: "undocumented-variable",
          environmentFile: ".env.example"
        }
      });
    }
  }
  if (references.size === 0 && !hasEnv && !hasEnvExample) {
    issues.push({
      severity: "info",
      category: "environment",
      title: "No environment configuration detected",
      message: "Lumen did not detect environment variable usage or environment files."
    });
  }
  return issues;
}

// src/formatters/terminal.formatter.ts
import pc2 from "picocolors";
function getIcon(severity) {
  switch (severity) {
    case "info":
      return pc2.green("\u2713");
    case "warning":
      return pc2.yellow("\u26A0");
    case "error":
      return pc2.red("\u2717");
  }
}
function getUpdateLabel(updateType) {
  switch (updateType) {
    case "major":
      return pc2.red("Major update");
    case "minor":
      return pc2.yellow("Minor update");
    case "patch":
      return pc2.blue("Patch update");
    case "prerelease":
      return pc2.magenta("Prerelease update");
    default:
      return pc2.yellow("Update available");
  }
}
function printDependencyMetadata(issue) {
  if (issue.category !== "dependency" || !issue.metadata) {
    return;
  }
  const {
    declaredVersion,
    installedVersion,
    latestVersion,
    updateType
  } = issue.metadata;
  if (updateType) {
    console.log(
      `  Type: ${getUpdateLabel(updateType)}`
    );
  }
  if (!issue.message.includes("Declared:") && declaredVersion) {
    console.log(
      `  Declared: ${declaredVersion}`
    );
  }
  if (!issue.message.includes("Installed:") && installedVersion) {
    console.log(
      `  Installed: ${installedVersion}`
    );
  }
  if (!issue.message.includes("Latest:") && latestVersion) {
    console.log(
      `  Latest: ${latestVersion}`
    );
  }
}
function printSecurityMetadata(issue) {
  if (issue.category !== "security" || !issue.metadata) {
    return;
  }
  const metadata = issue.metadata;
  if (metadata.secretType) {
    console.log(
      `  Type: ${metadata.secretType}`
    );
  }
  if (metadata.cve) {
    console.log(
      `  CVE: ${metadata.cve}`
    );
  }
  if (metadata.advisoryId) {
    console.log(
      `  Advisory: ${metadata.advisoryId}`
    );
  }
  if (metadata.cvss !== void 0) {
    console.log(
      `  CVSS: ${metadata.cvss}`
    );
  }
  if (metadata.installedVersion) {
    console.log(
      `  Installed: ${metadata.installedVersion}`
    );
  }
  if (metadata.fixedVersion) {
    console.log(
      `  Fixed in: ${metadata.fixedVersion}`
    );
  }
}
function printEnvironmentMetadata(issue) {
  if (issue.category !== "environment" || !issue.metadata) {
    return;
  }
  if (issue.metadata.envVariable) {
    console.log(
      `  Variable: ${issue.metadata.envVariable}`
    );
  }
  if (issue.metadata.environmentFile && issue.metadata.environmentFile !== issue.file) {
    console.log(
      `  Environment file: ${issue.metadata.environmentFile}`
    );
  }
}
function printIssue(issue) {
  const icon = getIcon(
    issue.severity
  );
  console.log(
    `${icon} ${issue.title}`
  );
  console.log(
    `  ${issue.message}`
  );
  if (issue.file) {
    const location = issue.metadata?.line ? `${issue.file}:${issue.metadata.line}` : issue.file;
    console.log(
      `  File: ${pc2.cyan(location)}`
    );
  }
  printDependencyMetadata(issue);
  printSecurityMetadata(issue);
  printEnvironmentMetadata(issue);
  if (issue.suggestion) {
    console.log(
      `  ${pc2.cyan("\u2192")} ${pc2.dim("Suggestion:")} ${issue.suggestion}`
    );
  }
  console.log();
}
function printSummary(issues) {
  const errors = issues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning"
  ).length;
  const infos = issues.filter(
    (issue) => issue.severity === "info"
  ).length;
  console.log(
    pc2.dim(
      "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
    )
  );
  console.log(
    `${pc2.red(`${errors} errors`)} \xB7 ${pc2.yellow(`${warnings} warnings`)} \xB7 ${pc2.green(`${infos} info`)}`
  );
  console.log();
}

// package.json
var package_default = {
  name: "lumen-cli",
  version: "0.1.4",
  description: "Illuminate your code. A developer project health and diagnostics CLI.",
  type: "module",
  main: "dist/index.js",
  types: "dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      default: "./dist/index.js"
    }
  },
  bin: {
    lumen: "dist/index.js",
    "lumen-cli": "dist/index.js"
  },
  files: [
    "dist",
    "assets",
    "CHANGELOG.md"
  ],
  engines: {
    node: ">=20"
  },
  scripts: {
    dev: "tsx src/index.ts",
    build: "tsup",
    start: "node dist/index.js",
    test: "vitest run",
    "test:watch": "vitest"
  },
  keywords: [
    "cli",
    "developer-tools",
    "code-quality",
    "security",
    "dependency",
    "diagnostics",
    "developer-experience"
  ],
  author: "Yusuf Firmansyah",
  license: "MIT",
  dependencies: {
    commander: "^14.0.0",
    picocolors: "^1.1.1",
    semver: "^7.7.0"
  },
  devDependencies: {
    "@types/node": "^24.0.0",
    "@types/semver": "^7.7.0",
    tsup: "^8.0.0",
    tsx: "^4.0.0",
    typescript: "^5.0.0",
    vitest: "^3.0.0"
  },
  repository: {
    type: "git",
    url: "git+https://github.com/firmansyf/lumen-cli.git"
  },
  bugs: {
    url: "https://github.com/firmansyf/lumen-cli/issues"
  },
  homepage: "https://github.com/firmansyf/lumen-cli#readme"
};

// src/formatters/json.formatter.ts
function formatJsonResult(issues, scannedPath) {
  const errors = issues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const warnings = issues.filter(
    (issue) => issue.severity === "warning"
  ).length;
  const infos = issues.filter(
    (issue) => issue.severity === "info"
  ).length;
  const result = {
    tool: "lumen",
    version: package_default.version,
    scannedPath,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    success: errors === 0,
    summary: {
      total: issues.length,
      errors,
      warnings,
      infos
    },
    issues
  };
  return JSON.stringify(
    result,
    null,
    2
  );
}

// src/utils/issue.utils.ts
function getIssueKey(issue) {
  return [
    issue.category,
    issue.title,
    issue.file ?? "",
    issue.metadata?.line ?? "",
    issue.metadata?.envVariable ?? "",
    issue.metadata?.secretType ?? "",
    issue.metadata?.advisoryId ?? "",
    issue.metadata?.cve ?? ""
  ].join("|");
}
function deduplicateIssues(issues) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const issue of issues) {
    const key = getIssueKey(issue);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(issue);
  }
  return result;
}
function groupIssuesByCategory(issues) {
  return {
    project: issues.filter(
      (issue) => issue.category === "project"
    ),
    dependency: issues.filter(
      (issue) => issue.category === "dependency"
    ),
    code: issues.filter(
      (issue) => issue.category === "code"
    ),
    security: issues.filter(
      (issue) => issue.category === "security"
    ),
    environment: issues.filter(
      (issue) => issue.category === "environment"
    ),
    configuration: issues.filter(
      (issue) => issue.category === "configuration"
    )
  };
}

// src/services/config.service.ts
import fs10 from "fs";
import path9 from "path";
import { pathToFileURL } from "url";
import pc3 from "picocolors";
var CONFIG_FILES2 = [
  "lumen.config.ts",
  "lumen.config.mts",
  "lumen.config.js",
  "lumen.config.mjs",
  "lumen.config.json"
];
var DEFAULT_CONFIG = {
  ignore: [],
  failOn: "error",
  dependency: {
    checkUpdates: true
  },
  security: {
    enabled: true
  },
  environment: {
    enabled: true
  }
};
async function loadLumenConfig(projectPath) {
  const configPath = findConfigFile(projectPath);
  if (!configPath) {
    return createDefaultConfig();
  }
  try {
    let userConfig;
    if (configPath.endsWith(".json")) {
      userConfig = JSON.parse(
        fs10.readFileSync(configPath, "utf8")
      );
    } else {
      const module = await import(pathToFileURL(configPath).href);
      userConfig = module.default ?? module;
    }
    return normalizeConfig(userConfig);
  } catch (error) {
    console.warn(
      `Warning: Unable to load ${path9.basename(configPath)}.`
    );
    if (error instanceof Error) {
      console.warn(`  ${error.message}`);
    }
    return createDefaultConfig();
  }
}
function findConfigFile(projectPath) {
  for (const fileName of CONFIG_FILES2) {
    const configPath = path9.join(
      projectPath,
      fileName
    );
    if (fs10.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}
function createDefaultConfig() {
  return {
    ignore: [...DEFAULT_CONFIG.ignore],
    failOn: DEFAULT_CONFIG.failOn,
    dependency: {
      ...DEFAULT_CONFIG.dependency
    },
    security: {
      ...DEFAULT_CONFIG.security
    },
    environment: {
      ...DEFAULT_CONFIG.environment
    }
  };
}
function normalizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return createDefaultConfig();
  }
  const raw = config;
  let ignore;
  if (Array.isArray(raw.ignore)) {
    const hasNonString = raw.ignore.some(
      (v) => typeof v !== "string"
    );
    if (hasNonString) {
      console.warn(
        pc3.yellow(
          "Warning: 'ignore' contains non-string items that were filtered out."
        )
      );
    }
    ignore = raw.ignore.filter(
      (value) => typeof value === "string"
    );
  } else {
    ignore = [...DEFAULT_CONFIG.ignore];
  }
  const failOn = normalizeFailOn(raw.failOn);
  const dependency = normalizeDependencyConfig(
    raw.dependency
  );
  const security = normalizeSecurityConfig(
    raw.security
  );
  const environment = normalizeEnvironmentConfig(
    raw.environment
  );
  return {
    ignore,
    failOn,
    dependency,
    security,
    environment
  };
}
function normalizeFailOn(value) {
  if (value === "error" || value === "warning" || value === "none") {
    return value;
  }
  if (value !== void 0) {
    console.warn(
      pc3.yellow(
        `Warning: Invalid failOn '${String(value)}'. Expected 'error', 'warning', or 'none'. Defaulting to 'error'.`
      )
    );
  }
  return DEFAULT_CONFIG.failOn;
}
function normalizeDependencyConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_CONFIG.dependency
    };
  }
  const raw = value;
  return {
    checkUpdates: typeof raw.checkUpdates === "boolean" ? raw.checkUpdates : DEFAULT_CONFIG.dependency.checkUpdates
  };
}
function normalizeSecurityConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_CONFIG.security
    };
  }
  const raw = value;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.security.enabled
  };
}
function normalizeEnvironmentConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ...DEFAULT_CONFIG.environment
    };
  }
  const raw = value;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_CONFIG.environment.enabled
  };
}

// src/services/git.service.ts
import { execFileSync } from "child_process";
import fs11 from "fs";
import path10 from "path";
function getChangedFiles(projectPath, ignorePatterns = [], baseRef) {
  let output;
  let repoRoot;
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
    repoRoot = toplevel ? path10.resolve(toplevel) : path10.resolve(projectPath);
    if (baseRef) {
      const diffRevision = baseRef.includes("..") ? baseRef : `${baseRef}...HEAD`;
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
    if (error instanceof Error && error.message.startsWith("Cannot compare against base")) {
      throw error;
    }
    throw new Error(
      "Cannot read Git changes. Make sure Git is installed and the target directory is inside a Git repository."
    );
  }
  const entries = output.split("\0");
  const changedFiles = /* @__PURE__ */ new Set();
  if (baseRef) {
    for (const relativePath of entries) {
      if (!relativePath) {
        continue;
      }
      const absolutePath = path10.resolve(
        repoRoot,
        relativePath
      );
      const resolvedRelativePath = path10.relative(
        projectPath,
        absolutePath
      );
      if (resolvedRelativePath === "" || resolvedRelativePath === ".." || resolvedRelativePath.startsWith(`..${path10.sep}`) || resolvedRelativePath.startsWith("../") || path10.isAbsolute(resolvedRelativePath)) {
        continue;
      }
      if (shouldIgnorePath(
        projectPath,
        absolutePath,
        ignorePatterns
      )) {
        continue;
      }
      try {
        if (!fs11.statSync(absolutePath).isFile()) {
          continue;
        }
        const realProjectPath = fs11.realpathSync(projectPath);
        const realFilePath = fs11.realpathSync(absolutePath);
        const realRel = path10.relative(realProjectPath, realFilePath);
        if (realRel === "" || realRel === ".." || realRel.startsWith(`..${path10.sep}`) || realRel.startsWith("../") || path10.isAbsolute(realRel)) {
          continue;
        }
      } catch {
        continue;
      }
      changedFiles.add(
        resolvedRelativePath.split(path10.sep).join("/")
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
    if (status.includes("R") || status.includes("C")) {
      index++;
    }
    if (status.includes("D")) {
      continue;
    }
    const absolutePath = path10.resolve(
      repoRoot,
      relativePath
    );
    const resolvedRelativePath = path10.relative(
      projectPath,
      absolutePath
    );
    if (resolvedRelativePath === "" || resolvedRelativePath === ".." || resolvedRelativePath.startsWith(`..${path10.sep}`) || resolvedRelativePath.startsWith("../") || path10.isAbsolute(resolvedRelativePath)) {
      continue;
    }
    if (shouldIgnorePath(
      projectPath,
      absolutePath,
      ignorePatterns
    )) {
      continue;
    }
    try {
      if (!fs11.statSync(absolutePath).isFile()) {
        continue;
      }
      const realProjectPath = fs11.realpathSync(projectPath);
      const realFilePath = fs11.realpathSync(absolutePath);
      const realRel = path10.relative(realProjectPath, realFilePath);
      if (realRel === "" || realRel === ".." || realRel.startsWith(`..${path10.sep}`) || realRel.startsWith("../") || path10.isAbsolute(realRel)) {
        continue;
      }
    } catch {
      continue;
    }
    changedFiles.add(
      resolvedRelativePath.split(path10.sep).join("/")
    );
  }
  return [...changedFiles].sort();
}

// src/commands/scan.command.ts
async function runAnalyzerSafely(name, category, fn) {
  try {
    return await fn();
  } catch (error) {
    return [
      {
        severity: "error",
        category,
        title: `${name} failed`,
        message: error instanceof Error ? error.message : `An unexpected error occurred in ${name}.`,
        suggestion: `Check your project files or configuration for ${name}.`
      }
    ];
  }
}
async function collectIssues(projectPath = ".") {
  const absolutePath = path11.resolve(projectPath);
  const config = await loadLumenConfig(absolutePath);
  const projectIssues = await runAnalyzerSafely(
    "Project analyzer",
    "project",
    () => analyzeProject(absolutePath)
  );
  const dependencyIssues = config.dependency?.checkUpdates === false ? [] : await runAnalyzerSafely(
    "Dependency analyzer",
    "dependency",
    () => analyzeDependencies(absolutePath)
  );
  const securityIssues = config.security?.enabled === false ? [] : await runAnalyzerSafely(
    "Security analyzer",
    "security",
    () => analyzeSecurity(absolutePath)
  );
  const secretIssues = config.security?.enabled === false ? [] : await runAnalyzerSafely(
    "Secret analyzer",
    "security",
    () => analyzeSecrets(
      absolutePath,
      {
        ignore: config.ignore
      }
    )
  );
  const environmentIssues = config.environment?.enabled === false ? [] : await runAnalyzerSafely(
    "Environment analyzer",
    "environment",
    () => analyzeEnvironment(
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
async function scanCommand(projectPath = ".", options = {}) {
  const absolutePath = path11.resolve(projectPath);
  if (!fs12.existsSync(absolutePath) || !fs12.statSync(absolutePath).isDirectory()) {
    const errorIssue = {
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
        pc4.red(`Error: Project directory does not exist: ${absolutePath}`)
      );
      console.error(
        pc4.dim("Please verify that the target directory exists and is accessible.")
      );
    }
    process.exitCode = 1;
    return;
  }
  const config = await loadLumenConfig(
    absolutePath
  );
  let rawIssues = [];
  let changedFileCount;
  const isChangedMode = Boolean(options.changed || options.base);
  if (isChangedMode) {
    const ignorePatterns = mergeIgnorePatterns(
      loadLumenIgnore(absolutePath),
      config.ignore ?? []
    );
    let changedFiles;
    try {
      changedFiles = getChangedFiles(
        absolutePath,
        ignorePatterns,
        options.base
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to read Git changes.";
      if (options.json) {
        const errorIssue = {
          severity: "error",
          category: "project",
          title: "Git changes unavailable",
          message: errorMessage,
          suggestion: "Make sure Git is installed and the target directory is inside a Git repository."
        };
        console.log(
          formatJsonResult([errorIssue], absolutePath)
        );
      } else {
        console.error(pc4.red(errorMessage));
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
          message: "Enable security scanning in lumen.config.ts to scan changed files for secrets."
        }
      ];
    } else if (changedFiles.length === 0) {
      rawIssues = [
        {
          severity: "info",
          category: "security",
          title: "No changed files to scan",
          message: "Git did not report any eligible changed files."
        }
      ];
    } else {
      rawIssues = await runAnalyzerSafely(
        "Secret analyzer",
        "security",
        () => analyzeSecrets(
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
  console.log(pc4.bold("Lumen"));
  console.log(pc4.dim("Illuminate your code."));
  console.log();
  console.log(pc4.dim(`Scanning: ${absolutePath}`));
  if (isChangedMode) {
    const modeLabel = options.base ? `Mode: changed files compared against ${options.base} (secret scanning only)` : "Mode: changed files (secret scanning only)";
    console.log(pc4.cyan(modeLabel));
    console.log(
      pc4.dim(
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
function shouldFail(issues, failOn) {
  switch (failOn) {
    case "none":
      return false;
    case "warning":
      return issues.some(
        (issue) => issue.severity === "warning" || issue.severity === "error"
      );
    case "error":
    default:
      return issues.some(
        (issue) => issue.severity === "error"
      );
  }
}
function printCategory(title, issues) {
  if (issues.length === 0) {
    return;
  }
  console.log(pc4.bold(title));
  console.log(
    pc4.dim("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
  );
  for (const issue of issues) {
    printIssue(issue);
  }
}

// src/index.ts
var program = new Command();
program.name("lumen").description("Illuminate your code.").version("0.1.4", "-v, --version", "Output the current version");
program.command("init").description("Create a Lumen configuration file").argument("[path]", "Project path", ".").action((projectPath) => {
  initCommand(projectPath);
});
program.command("scan").description("Analyze your project").argument("[path]", "Project path", ".").option("--json", "Output scan results as JSON").option(
  "--changed",
  "Scan changed Git files for hardcoded secrets only"
).option(
  "--base <ref>",
  "Base Git branch or reference to compare against (e.g. origin/main)"
).action(async (projectPath, options) => {
  await scanCommand(
    projectPath,
    options
  );
});
if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  program.parseAsync().catch((error) => {
    console.error(
      "Lumen CLI failed:",
      error instanceof Error ? error.message : error
    );
    process.exitCode = 1;
  });
}
