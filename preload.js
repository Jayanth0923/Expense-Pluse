const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  checkForUpdates: () => ipcRenderer.send("check-for-updates")
});

window.addEventListener("DOMContentLoaded", () => {
  console.log("Expense Pulse — Native Windows Desktop App Loaded Successfully");
});
