const simpleGit = require("simple-git");
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");
const os = require("os");

const git = simpleGit();

const repos = {
  api: "git@github.com:tr2ge/api.git",
  client: "git@github.com:tr2ge/client.git",
  admin: "git@github.com:tr2ge/admin.git",
};
const startCommands = {
  api: "npm start",
  client: "npm run dev",
  admin: "npm run dev",
};
const urls = ["http://localhost:5173", "http://localhost:8000"];

const basePath = path.resolve(__dirname, "projects");

const getProjects = async () => {
  try {
    await mapThroughProjects();
    console.log("All repos cloned successfully.");
  } catch (error) {
    console.error("Error cloning repositories:", error.message || error);
  }
};

const getProject = async (name, repoUrl) => {
  try {
    const targetDir = path.join(basePath, name);
    const exists = fs.existsSync(targetDir);

    if (exists) {
      console.log(`🔄 ${name} exists. Pulling latest changes...`);
      git.pull("origin", "main");
    } else {
      console.log(`📥 Cloning ${name} into ${targetDir}`);
      await git.clone(repoUrl, targetDir);
    }
  } catch (error) {
    console.error("Error cloning into repository:", error.message || error);
  }
};

const mapThroughProjects = () => {
  return Promise.all(
    Object.entries(repos).map(async ([name, repoUrl]) =>
      getProject(name, repoUrl)
    )
  );
};

const getProjectFolders = () => {
  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((dir) => dir.name);

  return directories;
};

const runProjects = () => {
  const projects = getProjectFolders();
  projects.map((project) => {
    runCmd(project);
  });
};

const runCmd = (name) => {
  const projectPath = path.join(basePath, name);
  const cmd = startCommands[name];
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("osascript", [
      "-e",
      `tell application "Terminal" to do script "cd '${projectPath}' && ${cmd}"`,
    ]);
  } else if (platform === "linux") {
    spawn("gnome-terminal", [
      "--",
      "bash",
      "-c",
      `cd '${projectPath}' && ${cmd}; exec bash`,
    ]);
  } else if (platform === "win32") {
    spawn("cmd.exe", ["/c", `start cmd /k "cd /d ${projectPath} && ${cmd}"`]);
  } else {
    console.error("Unsupported platform:", platform);
  }
};

const installDependencies = () => {
  const projects = getProjectFolders();
  projects.forEach((project) => {
    const projectPath = path.join(basePath, project);
    console.log(`📦 Installing dependencies in ${projectPath}...`);

    const result = spawnSync("npm", ["install", "-f"], {
      cwd: projectPath,
      stdio: "inherit",
      shell: true,
    });

    if (result.status !== 0) {
      console.error(`❌ npm install failed in ${project}`);
    } else {
      console.log(`✅ npm install complete in ${project}`);
    }
  });
};

const exec = (cmd, options = {}) => {
  const result = spawnSync(cmd, {
    shell: true,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd}`);
  }
};

const ensureGlobalCLIs = () => {
  try {
    exec("npm list -g vite");
  } catch {
    console.log("Installing Vite globally...");
    exec("npm install -g vite");
  }

  try {
    exec("npm list -g @nestjs/cli");
  } catch {
    console.log("Installing NestJS CLI globally...");
    exec("npm install -g @nestjs/cli");
  }
};

const checkDockerAccess = () => {
  const result = spawnSync("docker", ["info"], {
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error("❌ You don't have permission to run Docker. Try:");
    console.error("   sudo usermod -aG docker $USER && newgrp docker");
    process.exit(1);
  }
};

const startDatabase = () => {
  console.log("🚀 Starting database with Docker...");

  const result = spawnSync("docker compose", ["up", "-d"], {
    cwd: path.join(__dirname, ""),
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    console.error("❌ Failed to start database with Docker Compose.");
    console.error("Error output:", result);
    throw new Error("Failed to start Docker Compose.");
  }
};

function getOpenCommand(url) {
  const platform = os.platform();

  if (platform === "darwin") return `open "${url}"`;
  if (platform === "win32") return `start "" "${url}"`;
  return `xdg-open "${url}"`;
}

const openAll = () => {
  urls.forEach((url) => {
    const command = getOpenCommand(url);
    exec(command, (err) => {
      if (err) {
        console.error(`❌ Failed to open ${url}:`, err);
      } else {
        console.log(`✅ Opened ${url}`);
      }
    });
  });
};

const setup = () => {
  return new Promise((resolve, reject) => {
    resolve();
  });
};

setup()
  .then(checkDockerAccess)
  .then(ensureGlobalCLIs)
  .then(startDatabase)
  .then(getProjects)
  .then(installDependencies)
  .then(runProjects)
  .then(openAll)
  .catch((err) => console.error("❌ Setup failed:", err));
