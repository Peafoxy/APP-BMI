const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "BMI-Gestions Boutiques",
    icon: path.join(__dirname, "..", "public", "pwa-512.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  fenetre.removeMenu();

  if (process.env.ELECTRON_DEV) {
    fenetre.loadURL("http://localhost:5173");
  } else {
    fenetre.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Les liens externes (WhatsApp, sites fournisseurs) s'ouvrent dans le
  // navigateur par défaut, pas dans l'application.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

app.whenReady().then(creerFenetre);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
});
