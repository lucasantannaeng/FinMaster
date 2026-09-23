const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');

// Blindagem de Instância Única: previne múltiplas instâncias concorrentes disputando sessão e portas locais
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'FinMaster — Controle Financeiro Pessoal e Inteligência de Ativos',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  // Intercepta e normaliza headers de CORS para comunicação transparente com Supabase e APIs
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (!headers['Origin'] || headers['Origin'] === 'file://' || headers['Origin'] === 'null') {
      headers['Origin'] = 'http://localhost';
    }
    callback({ cancel: false, requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['access-control-allow-origin'] = ['*'];
    responseHeaders['access-control-allow-headers'] = ['*'];
    responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
    callback({ cancel: false, responseHeaders });
  });

  // Carrega a build estática do Vite
  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Redireciona links externos para o navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Recarregar Painel', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        { label: 'Sair', role: isMac ? 'close' : 'quit', accelerator: 'CmdOrCtrl+Q' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar Tudo' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Recarregamento Forçado' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Padrão' },
        { role: 'zoomIn', label: 'Aumentar Zoom' },
        { role: 'zoomOut', label: 'Diminuir Zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela Cheia' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o FinMaster',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Sobre o FinMaster',
              message: 'FinMaster Desktop v1.1.0',
              detail: 'Suíte Autônoma de Gestão Financeira Pessoal, Cartões e Criptoativos.\nSincronização em Nuvem Supabase Postgres.\nAutor: Luca Rodrigues Gomes de Sant\'Anna',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  let activeOAuthServer = null;

  ipcMain.handle('start-desktop-oauth', async (_event, authUrl) => {
    return new Promise((resolve) => {
      if (activeOAuthServer) {
        try { activeOAuthServer.close(); } catch (_) {}
        activeOAuthServer = null;
      }

      const port = 54321;
      let resolved = false;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        if (activeOAuthServer) {
          try { activeOAuthServer.close(); } catch (_) {}
          activeOAuthServer = null;
        }
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        resolve(result);
      };

      const timeout = setTimeout(() => {
        finish({ error: 'Tempo limite de login no navegador esgotado. Tente novamente.' });
      }, 180000);

      activeOAuthServer = http.createServer((req, res) => {
        try {
          const reqUrl = new URL(req.url, `http://127.0.0.1:${port}`);

          if (reqUrl.pathname === '/callback') {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinMaster — Login Concluído</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #07101e; color: #ffffff; }
    .card { background: #0d1b2e; border: 1px solid #1e3656; padding: 40px; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.6); max-width: 420px; text-align: center; }
    .logo { font-weight: 800; font-size: 24px; color: #14b8a6; margin-bottom: 8px; letter-spacing: -0.5px; }
    .badge { display: inline-block; background: rgba(20, 184, 166, 0.15); color: #14b8a6; padding: 5px 14px; border-radius: 9999px; font-weight: 600; margin-bottom: 20px; font-size: 12px; }
    h2 { color: #f8fafc; margin: 0 0 12px 0; font-size: 20px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0; }
    .spinner { border: 3px solid rgba(255,255,255,0.08); border-top: 3px solid #14b8a6; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; margin: 24px auto 0; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">FinMaster</div>
    <div class="badge">Desktop • Supabase Cloud</div>
    <h2>Autenticado com Sucesso!</h2>
    <p>Sua conta foi validada com sucesso.<br>Você já pode fechar esta aba e retornar ao aplicativo FinMaster no seu computador.</p>
    <div class="spinner"></div>
  </div>
  <script>
    const hash = window.location.hash ? window.location.hash.substring(1) : '';
    const search = window.location.search ? window.location.search.substring(1) : '';
    const payload = hash || search;
    fetch('/exchange?' + payload)
      .then(() => {
        setTimeout(() => { try { window.close(); } catch (_) {} }, 1500);
      })
      .catch(() => {});
  </script>
</body>
</html>`);
            return;
          }

          if (reqUrl.pathname === '/exchange') {
            clearTimeout(timeout);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ ok: true }));

            const params = Object.fromEntries(reqUrl.searchParams.entries());
            finish({
              access_token: params.access_token,
              refresh_token: params.refresh_token,
              code: params.code,
              error: params.error || params.error_description,
            });
            return;
          }

          res.writeHead(404);
          res.end();
        } catch (e) {
          res.writeHead(500);
          res.end();
        }
      });

      activeOAuthServer.on('error', (err) => {
        clearTimeout(timeout);
        finish({ error: `Erro no servidor local de autenticação: ${err.message}` });
      });

      activeOAuthServer.listen(port, '127.0.0.1', () => {
        shell.openExternal(authUrl);
      });
    });
  });

  ipcMain.handle('open-oauth-window', async (_event, authUrl) => {
    return ipcRenderer?.invoke ? ipcRenderer.invoke('start-desktop-oauth', authUrl) : null;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
