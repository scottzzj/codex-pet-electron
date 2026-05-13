const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const packageDirName = "CodexPetReplica-win32-x64";
const packageDir = path.join(distDir, packageDirName);
const zipPath = path.join(distDir, packageDirName + ".zip");

if (!fs.existsSync(packageDir)) {
  throw new Error("未找到打包目录: " + packageDir);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const compressScript = [
  "Compress-Archive",
  "-LiteralPath",
  "'" + packageDir + "'",
  "-DestinationPath",
  "'" + zipPath + "'",
  "-Force"
].join(" ");

execFileSync(
  "powershell.exe",
  ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", compressScript],
  {
    cwd: repoRoot,
    stdio: "inherit"
  }
);

console.log("ZIP 已生成: " + zipPath);
