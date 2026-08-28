const { app, BrowserWindow, Menu, Tray, Notification, shell, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow;
let tray = null;

// Sets AppUserModelId for Windows Action Center Toast Notifications
app.setAppUserModelId("com.ferrypotstudios.expensepulse");

// Configure Auto-Updater Settings
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    minWidth: 380,
    minHeight: 600,
    title: "Expense Pulse — Google Sheets Tracker",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#F4F0EA",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.loadFile("index.html");

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:") || url.startsWith("mailto:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for Expense Pulse updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
    if (Notification.isSupported()) {
      new Notification({
        title: "⚡ Expense Pulse Update Available",
        body: `Version ${info.version} is downloading in the background...`,
        icon: path.join(__dirname, "icon.png"),
      }).show();
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("Expense Pulse is up to date.");
    if (Notification.isSupported()) {
      new Notification({
        title: "✨ Expense Pulse is Up to Date",
        body: "You are running the latest version (v1.0.0).",
        icon: path.join(__dirname, "icon.png"),
      }).show();
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (Notification.isSupported()) {
      new Notification({
        title: "✅ Expense Pulse Update Ready",
        body: `Version ${info.version} is ready! Restarting app to install update...`,
        icon: path.join(__dirname, "icon.png"),
      }).show();
    }
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 4000);
  });

  autoUpdater.on("error", (err) => {
    console.warn("Auto-updater status:", err ? err.message : "No update server configured yet");
  });
}

ipcMain.on("check-for-updates", () => {
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (e) {
    console.warn("Update check error:", e);
  }
});

function createTray() {
  tray = new Tray(path.join(__dirname, "icon.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "📊 Open Expense Pulse",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "🔄 Check for App Updates",
      click: () => {
        try {
          autoUpdater.checkForUpdatesAndNotify();
        } catch (e) {}
      },
    },
    {
      label: "🔔 Test Windows Notification",
      click: () => {
        if (Notification.isSupported()) {
          new Notification({
            title: "📊 Expense Pulse — Monthly Summary",
            body: "Month-end spending notifications will appear here automatically!",
            icon: path.join(__dirname, "icon.png"),
          }).show();
        }
      },
    },
    { type: "separator" },
    {
      label: "❌ Exit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Expense Pulse — Windows Desktop Tracker");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();

  // Check for updates 5 seconds after launch
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (e) {}
  }, 5000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
