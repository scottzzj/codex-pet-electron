const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { app, BrowserWindow, dialog, ipcMain, Menu, screen } = require("electron");

let petWindow = null;
let focusDetailWindow = null;
let focusDetailState = null;
let isFixingFocusDetailBounds = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const WINDOW_WIDTH = 356;
const COLLAPSED_WINDOW_HEIGHT = 320;
const EXPANDED_WINDOW_HEIGHT = 520;
const DETAIL_WINDOW_WIDTH = 320;
const DETAIL_WINDOW_HEIGHT = 272;
const DEFAULT_FOCUS_SOUND_DIR = path.join(__dirname, "..", "assets", "sounds");
const BUNDLED_PETS_DIR = path.join(__dirname, "..", "assets", "pets");
const DEFAULT_FOCUS_SOUND_NAMES = [
  "focus-default.wav",
  "focus-default.mp3",
  "focus-default.ogg",
  "focus-default.m4a"
];
const SETTINGS_FILE_NAME = "pet-settings.json";
const PET_LIBRARY_DIR_NAME = "pets";
const CODEX_ROOT_DIR = path.join(os.homedir(), ".codex");
const CODEX_SESSION_INDEX_PATH = path.join(CODEX_ROOT_DIR, "session_index.jsonl");
const CODEX_SESSIONS_DIR = path.join(CODEX_ROOT_DIR, "sessions");
const CODEX_STATE_DB_PATH = path.join(CODEX_ROOT_DIR, "state_5.sqlite");
const MAX_CODEX_ACTIVITIES = 8;

if (!gotSingleInstanceLock) {
  app.quit();
}

function readCodexGlobalState() {
  try {
    const statePath = path.join(os.homedir(), ".codex", ".codex-global-state.json");
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function getPetLibraryRoot() {
  return path.join(app.getPath("userData"), PET_LIBRARY_DIR_NAME);
}

function readAppSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf8"));
  } catch (_error) {
    return {};
  }
}

function writeAppSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
  } catch (_error) {
    return;
  }
}

function writeDebugSnapshot(fileName, payload) {
  try {
    const debugPath = path.join(app.getPath("userData"), fileName);
    fs.writeFileSync(debugPath, JSON.stringify(payload, null, 2), "utf8");
  } catch (_error) {
    return;
  }
}

function sanitizePetId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonLinesFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(function (line) {
      return line.trim().length > 0;
    })
    .map(function (line) {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter(Boolean);
}

function writeJsonFile(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function decodePossiblyGarbledText(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  try {
    if (/[鎴戜綘鐨勪簡鏄悗鍓嶄笓娉ㄥ姩鎬乧r]/.test(value)) {
      return Buffer.from(value, "latin1").toString("utf8");
    }
  } catch (_error) {
    return value;
  }

  return value;
}

function normalizeChatTitle(value) {
  const decoded = decodePossiblyGarbledText(String(value || "").trim());
  return decoded.length > 0 ? decoded : "未命名会话";
}

function deriveDisplayTitle(title, firstUserMessage) {
  const rawTitle = decodePossiblyGarbledText(String(title || "").trim()).replace(/\s+/g, " ");
  const rawFirstUser = decodePossiblyGarbledText(String(firstUserMessage || "").trim()).replace(/\s+/g, " ");
  const sourceText = rawTitle || rawFirstUser;

  if (!sourceText) {
    return "未命名会话";
  }

  const lines = sourceText
    .split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean);

  let displayTitle = lines.length > 1 ? lines[lines.length - 1] : sourceText;
  displayTitle = displayTitle.replace(/^https?:\/\/\S+\s*/i, "").trim();

  if (/^我安装了这个网站的pet 我想给codex pet增加右击操作$/i.test(displayTitle)) {
    return "添加 Codex Pet 右键操作";
  }

  if (displayTitle.length > 36 && /codex pet.*右击操作/i.test(displayTitle)) {
    return "添加 Codex Pet 右键操作";
  }

  return displayTitle || "未命名会话";
}

function scoreDecodedTextCandidate(text) {
  const cjkMatches = text.match(/[\u4e00-\u9fff]/g);
  const asciiMatches = text.match(/[A-Za-z0-9]/g);
  const suspiciousMatches = text.match(/[鍚嶄細璇濇渶杩戞病鏈夊彲灞曠ず鎻愮ず闊虫嫨瀹犵墿鍘嬬缉鍖煎叆澶辫触褰㈣薄涓撴敞]/g);
  const replacementMatches = text.match(/[�]/g);

  return (
    (cjkMatches ? cjkMatches.length * 2 : 0) +
    (asciiMatches ? asciiMatches.length : 0) -
    (suspiciousMatches ? suspiciousMatches.length * 3 : 0) -
    (replacementMatches ? replacementMatches.length * 6 : 0)
  );
}

function decodePossiblyGarbledText(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  try {
    const decoded = Buffer.from(value, "latin1").toString("utf8").replace(/\u0000/g, "");
    if (scoreDecodedTextCandidate(decoded) > scoreDecodedTextCandidate(value)) {
      return decoded;
    }
  } catch (_error) {
    return value;
  }

  return value;
}

function parseCodexTimestamp(value) {
  const parsedMs = Date.parse(String(value || ""));
  return Number.isFinite(parsedMs) ? parsedMs : 0;
}

function normalizeRolloutPath(value) {
  const rawPath = String(value || "").trim();
  if (rawPath.length === 0) {
    return null;
  }

  return rawPath.startsWith("\\\\?\\") ? rawPath.slice(4) : rawPath;
}

function findSessionFilePathById(sessionId) {
  if (!sessionId || !fs.existsSync(CODEX_SESSIONS_DIR)) {
    return null;
  }

  const yearDirectories = listPetDirectories(CODEX_SESSIONS_DIR);
  for (const yearDir of yearDirectories) {
    const monthDirectories = listPetDirectories(yearDir);
    for (const monthDir of monthDirectories) {
      const files = fs.readdirSync(monthDir, { withFileTypes: true })
        .filter(function (entry) {
          return entry.isFile() && entry.name.endsWith(".jsonl") && entry.name.indexOf(sessionId) !== -1;
        })
        .map(function (entry) {
          return path.join(monthDir, entry.name);
        });

      if (files.length > 0) {
        files.sort(function (left, right) {
          return fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs;
        });
        return files[0];
      }
    }
  }

  return null;
}

function runPythonJson(script) {
  try {
    const output = execFileSync("python", ["-",], {
      env: Object.assign({}, process.env, {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1"
      }),
      input: script,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8"
    });
    return JSON.parse(output);
  } catch (_error) {
    return null;
  }
}

function readThreadsRowsFromDb() {
  if (!fs.existsSync(CODEX_STATE_DB_PATH)) {
    return [];
  }

  const tempJsonPath = path.join(app.getPath("temp"), "codex-pet-threads.json");
  const pythonScript = [
    "import json, sqlite3",
    "from pathlib import Path",
    "conn = sqlite3.connect(r'" + CODEX_STATE_DB_PATH.replace(/\\/g, "\\\\") + "')",
    "conn.row_factory = sqlite3.Row",
    "cur = conn.cursor()",
    "query = '''",
    "SELECT t.id, t.title, t.first_user_message, t.updated_at_ms, t.cwd, t.thread_source, t.rollout_path,",
    "       tse.status AS spawn_status",
    "FROM threads t",
    "LEFT JOIN thread_spawn_edges tse ON tse.child_thread_id = t.id",
    "WHERE t.archived = 0",
    "ORDER BY t.updated_at_ms DESC, t.id DESC",
    "LIMIT ?",
    "'''",
    "cur.execute(query, (" + String(MAX_CODEX_ACTIVITIES * 4) + ",))",
    "rows = [dict(row) for row in cur.fetchall()]",
    "Path(r'" + tempJsonPath.replace(/\\/g, "\\\\") + "').write_text(json.dumps(rows, ensure_ascii=False), encoding='utf-8')"
  ].join("\n");

  try {
    execFileSync("python", ["-",], {
      env: Object.assign({}, process.env, {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1"
      }),
      input: pythonScript,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8"
    });

    return JSON.parse(fs.readFileSync(tempJsonPath, "utf8"));
  } catch (_error) {
    return [];
  }
}

function extractLatestAssistantTextFromSessionFile(sessionFilePath) {
  if (!sessionFilePath || !fs.existsSync(sessionFilePath)) {
    return "";
  }

  try {
    const rows = readJsonLinesFile(sessionFilePath);
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const row = rows[index];
      if (!row || !row.payload) {
        continue;
      }

      if (
        row.type === "response_item" &&
        row.payload.type === "message" &&
        row.payload.role === "assistant" &&
        Array.isArray(row.payload.content)
      ) {
        const textItem = row.payload.content.find(function (item) {
          return item && (item.type === "output_text" || item.type === "text") && typeof item.text === "string";
        });

        if (textItem && textItem.text.trim().length > 0) {
          return textItem.text.trim().replace(/\s+/g, " ").slice(0, 120);
        }
      }

      if (
        row.type === "event_msg" &&
        row.payload.type === "agent_message" &&
        typeof row.payload.message === "string" &&
        row.payload.message.trim().length > 0
      ) {
        return row.payload.message.trim().replace(/\s+/g, " ").slice(0, 120);
      }
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function extractFirstUserTextFromSessionFile(sessionFilePath) {
  if (!sessionFilePath || !fs.existsSync(sessionFilePath)) {
    return "";
  }

  try {
    const rows = readJsonLinesFile(sessionFilePath);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row || !row.payload) {
        continue;
      }

      if (
        row.type === "response_item" &&
        row.payload.type === "message" &&
        row.payload.role === "user" &&
        Array.isArray(row.payload.content)
      ) {
        const textItem = row.payload.content.find(function (item) {
          return item && (item.type === "input_text" || item.type === "text") && typeof item.text === "string";
        });

        if (textItem && textItem.text.trim().length > 0) {
          return textItem.text.trim().replace(/\s+/g, " ").slice(0, 120);
        }
      }
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function buildCodexActivityState(updatedAtMs) {
  const ageMs = Date.now() - updatedAtMs;
  if (ageMs <= 10 * 60 * 1000) {
    return "running";
  }
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return "review";
  }
  return "idle";
}

function readCodexActivitiesFromThreadsDb() {
  const rows = readThreadsRowsFromDb();
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(function (row) {
      return row && row.thread_source !== "subagent";
    })
    .slice(0, MAX_CODEX_ACTIVITIES)
    .map(function (row) {
      const sessionFilePath = normalizeRolloutPath(row.rollout_path);
      const summary = extractLatestAssistantTextFromSessionFile(sessionFilePath);
      const titleText = deriveDisplayTitle(row.title, row.first_user_message);
      const firstUserText = String(row.first_user_message || "").trim().replace(/\s+/g, " ");
      const workspaceLabel = normalizeRolloutPath(row.cwd || "").replace(/^.*[\\\\/]/, "") || "Codex";
      return {
        id: row.id,
        title: titleText || "未命名会话",
        body: summary || firstUserText || "该会话最近没有可展示的助手回复摘要。",
        source: workspaceLabel,
        state: row.spawn_status === "open"
          ? "running"
          : buildCodexActivityState(Number(row.updated_at_ms) || 0),
        updatedAtMs: Number(row.updated_at_ms) || 0
      };
    });
}

function readCodexActivities() {
  const dbActivities = readCodexActivitiesFromThreadsDb();
  if (dbActivities.length > 0) {
    return dbActivities;
  }

  if (!fs.existsSync(CODEX_SESSION_INDEX_PATH)) {
    return [];
  }

  const rows = readJsonLinesFile(CODEX_SESSION_INDEX_PATH);
  const latestById = new Map();

  for (const row of rows) {
    if (!row || typeof row.id !== "string") {
      continue;
    }

    const updatedAtMs = parseCodexTimestamp(row.updated_at);
    const previous = latestById.get(row.id);
    if (!previous || updatedAtMs >= previous.updatedAtMs) {
      latestById.set(row.id, {
        id: row.id,
        title: normalizeChatTitle(row.thread_name),
        updatedAtMs: updatedAtMs
      });
    }
  }

  return Array.from(latestById.values())
    .sort(function (left, right) {
      return right.updatedAtMs - left.updatedAtMs;
    })
    .slice(0, MAX_CODEX_ACTIVITIES)
    .map(function (item) {
      const sessionFilePath = normalizeRolloutPath(findSessionFilePathById(item.id));
      const summary = extractLatestAssistantTextFromSessionFile(sessionFilePath);
      const fallbackTitle = extractFirstUserTextFromSessionFile(sessionFilePath);

      return {
        id: item.id,
        title: fallbackTitle || "未命名会话",
        body: summary || "该会话最近没有可展示的助手回复摘要。",
        source: "Codex 会话",
        state: buildCodexActivityState(item.updatedAtMs),
        updatedAtMs: item.updatedAtMs
      };
    });
}

function buildBundledFallbackPet() {
  const petDir = path.join(BUNDLED_PETS_DIR, "codex-default");
  const spritePath = path.join(petDir, "spritesheet.webp");
  if (!fs.existsSync(spritePath)) {
    return null;
  }

  return {
    key: "bundled:codex-default",
    id: "codex-default",
    displayName: "默认宠物",
    description: "应用内置宠物形象",
    spritesheetPath: spritePath,
    source: "bundled",
    petDir: petDir,
    manifestPath: path.join(petDir, "pet.json")
  };
}

function normalizePetManifest(manifest, options) {
  if (!manifest || typeof manifest !== "object") {
    return null;
  }

  const id = sanitizePetId(manifest.id || options.fallbackId);
  if (!id) {
    return null;
  }

  const spriteRelativePath = typeof manifest.spritesheetPath === "string" && manifest.spritesheetPath.trim().length > 0
    ? manifest.spritesheetPath.trim()
    : "spritesheet.webp";
  const spritePath = path.resolve(options.petDir, spriteRelativePath);
  if (!fs.existsSync(spritePath)) {
    return null;
  }

  return {
    key: options.source + ":" + id,
    id: id,
    displayName: typeof manifest.displayName === "string" && manifest.displayName.trim().length > 0
      ? manifest.displayName.trim()
      : id,
    description: typeof manifest.description === "string" ? manifest.description.trim() : "",
    spritesheetPath: spritePath,
    source: options.source,
    petDir: options.petDir,
    manifestPath: path.join(options.petDir, "pet.json")
  };
}

function readPetManifestFromDirectory(petDir, source) {
  try {
    const manifestPath = path.join(petDir, "pet.json");
    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    return normalizePetManifest(readJsonFile(manifestPath), {
      source: source,
      petDir: petDir,
      fallbackId: path.basename(petDir)
    });
  } catch (_error) {
    return null;
  }
}

function listPetDirectories(rootDir) {
  try {
    return fs.readdirSync(rootDir, { withFileTypes: true })
      .filter(function (entry) {
        return entry.isDirectory();
      })
      .map(function (entry) {
        return path.join(rootDir, entry.name);
      });
  } catch (_error) {
    return [];
  }
}

function listBundledPets() {
  const pets = listPetDirectories(BUNDLED_PETS_DIR)
    .map(function (petDir) {
      return readPetManifestFromDirectory(petDir, "bundled");
    })
    .filter(Boolean);

  if (pets.length > 0) {
    return pets;
  }

  const fallbackPet = buildBundledFallbackPet();
  return fallbackPet ? [fallbackPet] : [];
}

function listLocalPets() {
  const localRoot = ensureDirectory(getPetLibraryRoot());
  return listPetDirectories(localRoot)
    .map(function (petDir) {
      return readPetManifestFromDirectory(petDir, "local");
    })
    .filter(Boolean);
}

function listCodexPets() {
  const codexRoot = path.join(os.homedir(), ".codex", "pets");
  return listPetDirectories(codexRoot)
    .map(function (petDir) {
      return readPetManifestFromDirectory(petDir, "codex");
    })
    .filter(Boolean);
}

function buildPetIndex() {
  const pets = []
    .concat(listLocalPets())
    .concat(listBundledPets())
    .concat(listCodexPets());
  const index = new Map();

  for (const pet of pets) {
    if (!index.has(pet.key)) {
      index.set(pet.key, pet);
    }
  }

  return index;
}

function listAvailablePets() {
  return Array.from(buildPetIndex().values()).map(function (pet) {
    return {
      key: pet.key,
      id: pet.id,
      displayName: pet.displayName,
      description: pet.description,
      source: pet.source
    };
  });
}

function petToRendererPayload(pet) {
  if (!pet || !fs.existsSync(pet.spritesheetPath)) {
    return null;
  }

  const spriteBuffer = fs.readFileSync(pet.spritesheetPath);
  const spriteExt = path.extname(pet.spritesheetPath).slice(1).toLowerCase() || "webp";

  return {
    key: pet.key,
    id: pet.id,
    displayName: pet.displayName,
    description: pet.description,
    source: pet.source,
    spritesheetDataUrl: "data:image/" + spriteExt + ";base64," + spriteBuffer.toString("base64")
  };
}

function readSelectedPetConfig() {
  const settings = readAppSettings();
  if (typeof settings.selectedPetKey === "string" && settings.selectedPetKey.trim().length > 0) {
    return settings.selectedPetKey.trim();
  }

  return null;
}

function writeSelectedPetConfig(selectedPetKey) {
  const settings = readAppSettings();
  settings.selectedPetKey = selectedPetKey;
  writeAppSettings(settings);
}

function resolveCodexSelectedPetKey() {
  const state = readCodexGlobalState();
  const selectedAvatarId = state?.["electron-persisted-atom-state"]?.["selected-avatar-id"];
  if (typeof selectedAvatarId !== "string" || !selectedAvatarId.startsWith("custom:")) {
    return null;
  }

  const petId = sanitizePetId(selectedAvatarId.slice("custom:".length));
  return petId ? "codex:" + petId : null;
}

function resolveSelectedPet() {
  const petIndex = buildPetIndex();
  const configuredKey = readSelectedPetConfig();
  if (configuredKey && petIndex.has(configuredKey)) {
    return petIndex.get(configuredKey);
  }

  const codexKey = resolveCodexSelectedPetKey();
  if (codexKey && petIndex.has(codexKey)) {
    return petIndex.get(codexKey);
  }

  if (petIndex.has("bundled:codex-default")) {
    return petIndex.get("bundled:codex-default");
  }

  return Array.from(petIndex.values())[0] || null;
}

function setSelectedPetByKey(selectedPetKey) {
  const petIndex = buildPetIndex();
  if (!petIndex.has(selectedPetKey)) {
    return null;
  }

  writeSelectedPetConfig(selectedPetKey);
  return petIndex.get(selectedPetKey);
}

function ensureUniqueDirectoryName(rootDir, baseName) {
  let suffix = 0;
  let candidateName = baseName;

  while (fs.existsSync(path.join(rootDir, candidateName))) {
    suffix += 1;
    candidateName = baseName + "-" + String(suffix);
  }

  return candidateName;
}

function resolveImportablePetDirectory(inputPath) {
  const directManifestPath = path.join(inputPath, "pet.json");
  if (fs.existsSync(directManifestPath)) {
    return inputPath;
  }

  const childDirectories = listPetDirectories(inputPath);
  if (childDirectories.length === 1) {
    const nestedManifestPath = path.join(childDirectories[0], "pet.json");
    if (fs.existsSync(nestedManifestPath)) {
      return childDirectories[0];
    }
  }

  return null;
}

function importPetPackageFromPath(sourceDir) {
  const importableDir = resolveImportablePetDirectory(sourceDir);
  if (!importableDir) {
    return null;
  }

  const sourceManifestPath = path.join(importableDir, "pet.json");
  if (!fs.existsSync(sourceManifestPath)) {
    return null;
  }

  const sourceManifest = readJsonFile(sourceManifestPath);
  const petId = sanitizePetId(sourceManifest.id || path.basename(importableDir));
  if (!petId) {
    return null;
  }

  const targetRoot = ensureDirectory(getPetLibraryRoot());
  const targetDirName = ensureUniqueDirectoryName(targetRoot, petId);
  const targetDir = path.join(targetRoot, targetDirName);
  fs.cpSync(importableDir, targetDir, { recursive: true });

  const targetManifestPath = path.join(targetDir, "pet.json");
  const targetManifest = readJsonFile(targetManifestPath);
  targetManifest.id = sanitizePetId(targetManifest.id || targetDirName) || targetDirName;
  if (!targetManifest.displayName) {
    targetManifest.displayName = targetManifest.id;
  }
  if (!targetManifest.spritesheetPath) {
    targetManifest.spritesheetPath = "spritesheet.webp";
  }
  writeJsonFile(targetManifestPath, targetManifest);

  return readPetManifestFromDirectory(targetDir, "local");
}

function importPetPackageFromZip(zipPath) {
  const tempRoot = ensureDirectory(path.join(app.getPath("temp"), "codex-pet-import"));
  const extractDir = path.join(tempRoot, "pet-" + String(Date.now()));
  ensureDirectory(extractDir);

  try {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force",
      zipPath,
      extractDir
    ], { stdio: "pipe" });
  } catch (_error) {
    return null;
  }

  return importPetPackageFromPath(extractDir);
}

async function showPetImportError(message) {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  await dialog.showMessageBox(petWindow, {
    type: "error",
    title: "导入失败",
    message: message
  });
}

function setCustomFocusSoundPath(soundPath) {
  const nextSettings = readAppSettings();

  if (typeof soundPath === "string" && soundPath.length > 0) {
    nextSettings.customFocusSoundPath = soundPath;
  } else {
    delete nextSettings.customFocusSoundPath;
  }

  writeAppSettings(nextSettings);
}

function resolveFocusSoundPath() {
  const settings = readAppSettings();
  const customPath = settings.customFocusSoundPath;

  if (typeof customPath === "string" && customPath.length > 0 && fs.existsSync(customPath)) {
    return customPath;
  }

  for (const fileName of DEFAULT_FOCUS_SOUND_NAMES) {
    const candidatePath = path.join(DEFAULT_FOCUS_SOUND_DIR, fileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function readFocusSoundDataUrl() {
  try {
    const focusSoundPath = resolveFocusSoundPath();
    if (!focusSoundPath) {
      return null;
    }

    const soundBuffer = fs.readFileSync(focusSoundPath);
    const soundExt = path.extname(focusSoundPath).slice(1).toLowerCase() || "wav";
    const mimeType = soundExt === "mp3"
      ? "audio/mpeg"
      : (soundExt === "ogg" ? "audio/ogg" : (soundExt === "m4a" ? "audio/mp4" : "audio/wav"));

    return "data:" + mimeType + ";base64," + soundBuffer.toString("base64");
  } catch (_error) {
    return null;
  }
}

function clampBoundsToWorkArea(bounds, workArea) {
  const maxX = workArea.x + workArea.width - WINDOW_WIDTH;
  const maxY = workArea.y + workArea.height - EXPANDED_WINDOW_HEIGHT;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY)
  };
}

function clampWindowRectToDisplay(bounds, workArea, width, height) {
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.min(Math.max(bounds.x, workArea.x), maxX),
    y: Math.min(Math.max(bounds.y, workArea.y), maxY)
  };
}

function resolveInitialBounds() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const state = readCodexGlobalState();
  const overlayBounds = state?.["electron-avatar-overlay-bounds"];

  if (
    overlayBounds &&
    typeof overlayBounds.x === "number" &&
    typeof overlayBounds.y === "number"
  ) {
    return clampBoundsToWorkArea(
      {
        x: Math.round(overlayBounds.x),
        y: Math.round(overlayBounds.y)
      },
      workArea
    );
  }

  return clampBoundsToWorkArea(
    {
      x: workArea.x + workArea.width - WINDOW_WIDTH - 32,
      y: workArea.y + 32
    },
    workArea
  );
}

function createPetWindow() {
  const initialBounds = resolveInitialBounds();

  petWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: COLLAPSED_WINDOW_HEIGHT,
    x: initialBounds.x,
    y: initialBounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  petWindow.on("move", function () {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-window-bounds-changed", petWindow.getBounds());
    }
  });

  petWindow.on("closed", function () {
    closeFocusDetailWindow();
    petWindow = null;
  });
}

function mapMenuItem(item) {
  if (item.type === "separator") {
    return { type: "separator" };
  }

  const mapped = {
    id: item.id,
    label: item.label,
    enabled: item.enabled !== false
  };

  if (Array.isArray(item.submenu) && item.submenu.length > 0) {
    mapped.submenu = item.submenu.map(mapMenuItem);
    return mapped;
  }

  mapped.click = function () {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.webContents.send("pet-menu-action", { id: item.id });
    }
  };

  return mapped;
}

function buildPetMenu(items) {
  return Menu.buildFromTemplate(items.map(mapMenuItem));
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeContextMenuItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce(function (result, item) {
    if (!item || typeof item !== "object") {
      return result;
    }

    if (item.type === "separator") {
      result.push({ type: "separator" });
      return result;
    }

    if (typeof item.id !== "string" || typeof item.label !== "string") {
      return result;
    }

    const sanitized = {
      id: item.id,
      label: item.label,
      enabled: item.enabled !== false
    };

    if (Array.isArray(item.submenu) && item.submenu.length > 0) {
      sanitized.submenu = sanitizeContextMenuItems(item.submenu);
    }

    result.push(sanitized);
    return result;
  }, []);
}

function resolveFocusDetailBounds() {
  const petBounds = petWindow ? petWindow.getBounds() : { x: 0, y: 0, width: WINDOW_WIDTH, height: COLLAPSED_WINDOW_HEIGHT };
  const display = screen.getDisplayMatching(petBounds);
  const workArea = display.workArea;
  const detailBounds = focusDetailWindow && !focusDetailWindow.isDestroyed()
    ? focusDetailWindow.getBounds()
    : { width: DETAIL_WINDOW_WIDTH, height: DETAIL_WINDOW_HEIGHT };
  const rightX = petBounds.x + petBounds.width + 12;
  const leftX = petBounds.x - detailBounds.width - 12;
  const canPlaceRight = rightX + detailBounds.width <= workArea.x + workArea.width;
  const targetX = canPlaceRight ? rightX : Math.max(workArea.x, leftX);
  const targetY = Math.min(
    Math.max(workArea.y + 32, petBounds.y + 92),
    workArea.y + workArea.height - detailBounds.height - 24
  );

  return {
    x: targetX,
    y: targetY,
    width: detailBounds.width,
    height: detailBounds.height
  };
}

function enforceFocusDetailSize() {
  return;
}

function syncFocusDetailState() {
  if (!focusDetailWindow || focusDetailWindow.isDestroyed() || !focusDetailState) {
    return;
  }

  focusDetailWindow.webContents.send("focus-detail-state", focusDetailState);
}

function closeFocusDetailWindow() {
  if (focusDetailWindow && !focusDetailWindow.isDestroyed()) {
    focusDetailWindow.close();
  }
  focusDetailWindow = null;
}

function openFocusDetailWindow(payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  focusDetailState = payload;
  const bounds = resolveFocusDetailBounds();

  if (!focusDetailWindow || focusDetailWindow.isDestroyed()) {
    focusDetailWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    focusDetailWindow.setMinimumSize(DETAIL_WINDOW_WIDTH, DETAIL_WINDOW_HEIGHT);
    focusDetailWindow.setMaximumSize(DETAIL_WINDOW_WIDTH, DETAIL_WINDOW_HEIGHT);
    focusDetailWindow.loadFile(path.join(__dirname, "renderer", "focus-detail.html"));
    focusDetailWindow.webContents.on("did-finish-load", syncFocusDetailState);
    focusDetailWindow.on("closed", function () {
      focusDetailWindow = null;
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.webContents.send("focus-detail-action", { id: "focus-detail-closed" });
      }
    });
  } else {
    focusDetailWindow.setPosition(bounds.x, bounds.y);
    syncFocusDetailState();
  }

  focusDetailWindow.show();
  return focusDetailWindow.getBounds();
}

app.whenReady().then(function () {
  if (!gotSingleInstanceLock) {
    return;
  }

  createPetWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPetWindow();
    }
  });
});

app.on("second-instance", function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  if (petWindow.isMinimized()) {
    petWindow.restore();
  }

  petWindow.focus();
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("pet:showContextMenu", function (_event, payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return false;
  }

  const items = sanitizeContextMenuItems(payload && payload.items);
  if (items.length === 0) {
    return false;
  }

  const menu = buildPetMenu(items);
  menu.popup({
    window: petWindow,
    x: isFiniteNumber(payload && payload.x) ? Math.round(payload.x) : undefined,
    y: isFiniteNumber(payload && payload.y) ? Math.round(payload.y) : undefined
  });
  return true;
});

ipcMain.on("pet:setPosition", function (_event, position) {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  if (!position || !isFiniteNumber(position.x) || !isFiniteNumber(position.y)) {
    return;
  }

  const currentBounds = petWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(position.x),
    y: Math.round(position.y)
  });
  const clamped = clampWindowRectToDisplay(
    {
      x: Math.round(position.x),
      y: Math.round(position.y)
    },
    display.workArea,
    currentBounds.width,
    currentBounds.height
  );

  petWindow.setPosition(
    clamped.x,
    clamped.y
  );
});

ipcMain.on("pet:setDraggingState", function (_event, payload) {
  return Boolean(payload && payload.dragging);
});

ipcMain.handle("pet:setExpanded", function (_event, payload) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = petWindow.getBounds();
  const targetHeight = payload && payload.expanded === true
    ? EXPANDED_WINDOW_HEIGHT
    : COLLAPSED_WINDOW_HEIGHT;
  const display = screen.getDisplayMatching(currentBounds);
  const clamped = clampWindowRectToDisplay(
    {
      x: currentBounds.x,
      y: currentBounds.y
    },
    display.workArea,
    WINDOW_WIDTH,
    targetHeight
  );

  petWindow.setBounds({
    x: clamped.x,
    y: clamped.y,
    width: WINDOW_WIDTH,
    height: targetHeight
  });

  return petWindow.getBounds();
});

ipcMain.handle("focus:openDetail", function (_event, payload) {
  return openFocusDetailWindow(payload);
});

ipcMain.handle("focus:updateDetail", function (_event, payload) {
  if (!payload || typeof payload !== "object") {
    return focusDetailState;
  }

  focusDetailState = payload;
  syncFocusDetailState();
  return focusDetailState;
});

ipcMain.handle("focus:closeDetail", function () {
  closeFocusDetailWindow();
  return true;
});

ipcMain.handle("focus:readSound", function () {
  return readFocusSoundDataUrl();
});

ipcMain.handle("focus:selectSound", async function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const result = await dialog.showOpenDialog(petWindow, {
    title: "选择提示音",
    properties: ["openFile"],
    filters: [
      { name: "音频文件", extensions: ["wav", "mp3", "ogg", "m4a"] }
    ]
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }

  setCustomFocusSoundPath(result.filePaths[0]);
  return readFocusSoundDataUrl();
});

ipcMain.handle("pet:listAvailable", function () {
  return listAvailablePets();
});

ipcMain.handle("pet:readCodexActivities", function () {
  const activities = readCodexActivities();
  writeDebugSnapshot("pet-activities-debug.json", {
    capturedAt: new Date().toISOString(),
    activities: activities.map(function (activity) {
      return {
        id: activity.id,
        title: activity.title,
        body: activity.body,
        source: activity.source,
        updatedAtMs: activity.updatedAtMs
      };
    })
  });
  return activities;
});

ipcMain.handle("pet:readSelected", function () {
  return petToRendererPayload(resolveSelectedPet());
});

ipcMain.handle("pet:setSelected", function (_event, payload) {
  if (!payload || typeof payload.key !== "string") {
    return null;
  }

  return petToRendererPayload(setSelectedPetByKey(payload.key));
});

ipcMain.handle("pet:importZip", async function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const result = await dialog.showOpenDialog(petWindow, {
    title: "选择宠物 ZIP 包",
    properties: ["openFile"],
    filters: [
      { name: "ZIP 压缩包", extensions: ["zip"] }
    ]
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }

  const importedPet = importPetPackageFromZip(result.filePaths[0]);
  if (!importedPet) {
    await showPetImportError("ZIP 包中没有找到可导入的宠物目录，请确认其中包含 pet.json 和 spritesheet 文件。");
    return {
      success: false,
      reason: "invalid-pet-package"
    };
  }

  writeSelectedPetConfig(importedPet.key);
  return {
    success: true,
    pet: petToRendererPayload(importedPet),
    availablePets: listAvailablePets()
  };
});


ipcMain.on("focus:detailAction", function (_event, payload) {
  if (payload && payload.id === "focus-detail-close") {
    closeFocusDetailWindow();
    return;
  }

  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send("focus-detail-action", payload);
  }
});

ipcMain.handle("pet:close", function () {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
  }
});

ipcMain.handle("pet:getBounds", function () {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  return petWindow.getBounds();
});

function scoreDecodedTextCandidate(text) {
  const cjkMatches = text.match(/[\u4e00-\u9fff]/g);
  const asciiMatches = text.match(/[A-Za-z0-9]/g);
  const suspiciousMatches = text.match(/[鍚嶄細璇濇渶杩戞病鏈夊彲灞曠ず鎻愮ず闊虫嫨瀹犵墿鍘嬬缉鍖煎叆澶辫触褰㈣薄涓撴敞]/g);
  const replacementMatches = text.match(/[�]/g);

  return (
    (cjkMatches ? cjkMatches.length * 2 : 0) +
    (asciiMatches ? asciiMatches.length : 0) -
    (suspiciousMatches ? suspiciousMatches.length * 3 : 0) -
    (replacementMatches ? replacementMatches.length * 6 : 0)
  );
}

decodePossiblyGarbledText = function (value) {
  return typeof value === "string" ? value : "";
};

normalizeChatTitle = function (value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  const decoded = decodePossiblyGarbledText(normalized);
  return decoded.length > 0 ? decoded : "未命名会话";
};
