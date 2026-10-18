
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

const CONFIG_FILES = [
  "lumen.config.ts",
  "lumen.config.mts",
  "lumen.config.js",
  "lumen.config.mjs",
  "lumen.config.json"
];

const CONFIG_TEMPLATE = {
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

export function initCommand(
  projectPath = "."
): void {
  const absolutePath = path.resolve(projectPath);

  if (
    !fs.existsSync(absolutePath) ||
    !fs.statSync(absolutePath).isDirectory()
  ) {
    console.error(
      pc.red(
        `Project directory does not exist: ${absolutePath}`
      )
    );

    process.exitCode = 1;
    return;
  }

  const existingConfig = CONFIG_FILES.find(
    (fileName) =>
      fs.existsSync(
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
      `${JSON.stringify(CONFIG_TEMPLATE, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx"
      }
    );

    console.log(
      pc.green("✓ Created lumen.config.json")
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
