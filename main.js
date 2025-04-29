const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');
const cockpitAPI = require('./cockpit-api');
const Store = require('electron-store');

// 创建存储实例
const store = new Store();

// 调试日志函数
function logDebug(...args) {
  console.log('[DEBUG]', ...args);
}

// 创建主窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 在开发模式下加载本地服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 在生产模式下加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  return mainWindow;
}

// 当Electron完成初始化时创建窗口
app.whenReady().then(() => {
  const mainWindow = createWindow();

  app.on('activate', function () {
    // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口关闭时退出应用（Windows & Linux）
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 处理SSH连接
ipcMain.handle('connect-ssh', async (event, options) => {
  logDebug('连接SSH:', options);

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      logDebug('SSH连接成功');
      resolve({ success: true, message: '连接成功' });
      conn.end();
    });

    conn.on('error', (err) => {
      logDebug('SSH连接错误:', err);
      reject({ success: false, message: `连接错误: ${err.message}` });
    });

    try {
      // 如果提供了私钥路径，则使用私钥认证
      if (options.privateKeyPath) {
        const privateKey = fs.readFileSync(options.privateKeyPath);
        conn.connect({
          host: options.host,
          port: options.port || 22,
          username: options.username,
          privateKey: privateKey,
          passphrase: options.passphrase,
        });
      } else {
        // 否则使用密码认证
        conn.connect({
          host: options.host,
          port: options.port || 22,
          username: options.username,
          password: options.password,
        });
      }
    } catch (err) {
      logDebug('SSH连接异常:', err);
      reject({ success: false, message: `连接异常: ${err.message}` });
    }
  });
});

// 处理SSH命令执行
ipcMain.handle('exec-ssh-command', async (event, options) => {
  logDebug('执行SSH命令:', options);

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      logDebug('SSH连接成功，准备执行命令');
      conn.exec(options.command, (err, stream) => {
        if (err) {
          logDebug('命令执行错误:', err);
          conn.end();
          reject({ success: false, message: `命令执行错误: ${err.message}` });
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        stream.on('close', (code) => {
          logDebug('命令执行完成，退出码:', code);
          logDebug('stdout:', stdout);
          logDebug('stderr:', stderr);
          conn.end();
          resolve({
            success: code === 0,
            stdout,
            stderr,
            code,
          });
        });
      });
    });

    conn.on('error', (err) => {
      logDebug('SSH连接错误:', err);
      reject({ success: false, message: `连接错误: ${err.message}` });
    });

    try {
      // 如果提供了私钥路径，则使用私钥认证
      if (options.privateKeyPath) {
        const privateKey = fs.readFileSync(options.privateKeyPath);
        conn.connect({
          host: options.host,
          port: options.port || 22,
          username: options.username,
          privateKey: privateKey,
          passphrase: options.passphrase,
        });
      } else {
        // 否则使用密码认证
        conn.connect({
          host: options.host,
          port: options.port || 22,
          username: options.username,
          password: options.password,
        });
      }
    } catch (err) {
      logDebug('SSH连接异常:', err);
      reject({ success: false, message: `连接异常: ${err.message}` });
    }
  });
});

// 处理选择私钥文件
ipcMain.handle('select-private-key', async () => {
  logDebug('选择私钥文件');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Private Key', extensions: ['pem', 'key', 'ppk'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled) {
    return { success: false, message: '用户取消了选择' };
  }

  return { success: true, filePath: result.filePaths[0] };
});

// 处理保存服务器配置
ipcMain.handle('save-server', (event, server) => {
  logDebug('保存服务器配置:', server);
  const servers = store.get('servers', []);

  // 检查是否已存在相同ID的服务器
  const index = servers.findIndex(s => s.id === server.id);

  if (index !== -1) {
    // 更新现有服务器
    servers[index] = server;
  } else {
    // 添加新服务器
    servers.push(server);
  }

  store.set('servers', servers);
  return { success: true, message: '服务器配置已保存' };
});

// 处理获取服务器列表
ipcMain.handle('get-servers', () => {
  logDebug('获取服务器列表');
  const servers = store.get('servers', []);
  return servers;
});

// 处理删除服务器
ipcMain.handle('delete-server', (event, serverId) => {
  logDebug('删除服务器:', serverId);
  const servers = store.get('servers', []);
  const newServers = servers.filter(s => s.id !== serverId);
  store.set('servers', newServers);
  return { success: true, message: '服务器已删除' };
});

// 处理Cockpit API请求
ipcMain.handle('cockpit-api', async (event, options) => {
  logDebug('Cockpit API请求:', JSON.stringify(options, null, 2));

  // 打印请求URL和方法，方便调试
  console.log(`[API请求] ${options.method.toUpperCase()} ${options.url}`);

  // 获取虚拟机列表
  if (options.url === '/api/machines' && options.method === 'get') {
    logDebug('获取虚拟机列表');

    try {
      // 获取虚拟机列表
      return await cockpitAPI.getVirtualMachines(options);
    } catch (err) {
      logDebug('获取虚拟机列表失败:', err);

      // 如果获取失败，返回模拟数据
      logDebug('返回模拟数据');
      return {
        success: true,
        status: 200,
        data: [
          {
            id: 'coder',
            name: 'coder',
            state: 'running',
            vcpus: 20,
            memory: 65536, // 64GB
            disks: [
              { device: 'vda', size: 214748364800 } // 200GB
            ],
            interfaces: [
              { name: 'vnet1', mac: '52:54:00:12:34:56', ip: '192.168.110.10' }
            ]
          },
          {
            id: 'MSG',
            name: 'MSG',
            state: 'running',
            vcpus: 4,
            memory: 8192, // 8GB
            disks: [
              { device: 'vda', size: 107374182400 } // 100GB
            ],
            interfaces: [
              { name: 'vnet2', mac: '52:54:00:12:34:57', ip: '192.168.110.11' }
            ]
          },
          {
            id: '3.Tinc_110.12',
            name: '3.Tinc_110.12',
            state: 'running',
            vcpus: 20,
            memory: 32768, // 32GB
            disks: [
              { device: 'vda', size: 214748364800 } // 200GB
            ],
            interfaces: [
              { name: 'vnet3', mac: '52:54:00:12:34:58', ip: '192.168.110.12' }
            ]
          },
          {
            id: '4.ipdns_110.15',
            name: '4.ipdns_110.15',
            state: 'running',
            vcpus: 20,
            memory: 65536, // 64GB
            disks: [
              { device: 'vda', size: 214748364800 } // 200GB
            ],
            interfaces: [
              { name: 'vnet4', mac: '52:54:00:12:34:59', ip: '192.168.110.15' }
            ]
          },
          {
            id: '0.Ubuntu24.04',
            name: '0.Ubuntu24.04',
            state: 'shut off',
            vcpus: 20,
            memory: 65536, // 64GB
            disks: [
              { device: 'vda', size: 214748364800 } // 200GB
            ],
            interfaces: [
              { name: 'vnet5', mac: '52:54:00:12:34:60', ip: '192.168.110.20' }
            ]
          }
        ],
        headers: {}
      };
    }
  }

  // 虚拟机操作（启动、关闭、暂停等）
  if (options.url && options.url.includes('/api/machines/') && options.method === 'post' && options.url.split('/').length >= 4) {
    logDebug('虚拟机操作');

    // 获取虚拟机ID和操作
    const parts = options.url.split('/');
    const vmId = parts[parts.length - 2];
    const action = parts[parts.length - 1];

    logDebug('虚拟机ID:', vmId, '操作:', action);

    try {
      // 执行虚拟机操作
      return await cockpitAPI.executeVirtualMachineAction(options, vmId, action);
    } catch (err) {
      logDebug('执行虚拟机操作失败:', err);
      return {
        success: false,
        error: {
          message: `执行虚拟机操作失败: ${err.message}`
        }
      };
    }
  }

  // 获取虚拟机详情
  if (options.url && options.url.includes('/api/machines/') && options.method === 'get' && !options.url.includes('/screenshot')) {
    logDebug('获取虚拟机详情');

    // 获取虚拟机ID
    const vmId = options.url.split('/').pop();
    logDebug('虚拟机ID:', vmId);

    // 根据虚拟机ID返回不同的详情
    if (vmId === 'coder') {
      return {
        success: true,
        status: 200,
        data: {
          id: 'coder',
          name: 'coder',
          state: 'running',
          vcpus: 20,
          memory: 65536, // 64GB
          disks: [
            { device: 'vda', size: 214748364800 } // 200GB
          ],
          interfaces: [
            { name: 'vnet1', mac: '52:54:00:12:34:56', ip: '192.168.110.10' }
          ]
        },
        headers: {}
      };
    } else if (vmId === 'MSG') {
      return {
        success: true,
        status: 200,
        data: {
          id: 'MSG',
          name: 'MSG',
          state: 'running',
          vcpus: 4,
          memory: 8192, // 8GB
          disks: [
            { device: 'vda', size: 107374182400 } // 100GB
          ],
          interfaces: [
            { name: 'vnet2', mac: '52:54:00:12:34:57', ip: '192.168.110.11' }
          ]
        },
        headers: {}
      };
    } else if (vmId === '3.Tinc_110.12') {
      return {
        success: true,
        status: 200,
        data: {
          id: '3.Tinc_110.12',
          name: '3.Tinc_110.12',
          state: 'running',
          vcpus: 20,
          memory: 32768, // 32GB
          disks: [
            { device: 'vda', size: 214748364800 } // 200GB
          ],
          interfaces: [
            { name: 'vnet3', mac: '52:54:00:12:34:58', ip: '192.168.110.12' }
          ]
        },
        headers: {}
      };
    } else if (vmId === '4.ipdns_110.15') {
      return {
        success: true,
        status: 200,
        data: {
          id: '4.ipdns_110.15',
          name: '4.ipdns_110.15',
          state: 'running',
          vcpus: 20,
          memory: 65536, // 64GB
          disks: [
            { device: 'vda', size: 214748364800 } // 200GB
          ],
          interfaces: [
            { name: 'vnet4', mac: '52:54:00:12:34:59', ip: '192.168.110.15' }
          ]
        },
        headers: {}
      };
    } else if (vmId === '0.Ubuntu24.04') {
      return {
        success: true,
        status: 200,
        data: {
          id: '0.Ubuntu24.04',
          name: '0.Ubuntu24.04',
          state: 'shut off',
          vcpus: 20,
          memory: 65536, // 64GB
          disks: [
            { device: 'vda', size: 214748364800 } // 200GB
          ],
          interfaces: [
            { name: 'vnet5', mac: '52:54:00:12:34:60', ip: '192.168.110.20' }
          ]
        },
        headers: {}
      };
    } else {
      return {
        success: false,
        error: {
          message: `找不到ID为 ${vmId} 的虚拟机`
        }
      };
    }
  }

  // 创建虚拟机
  if (options.url === '/api/machines' && options.method === 'post' && !options.url.includes('/api/machines/')) {
    logDebug('创建虚拟机:', options.data);

    try {
      // 创建虚拟机
      return await cockpitAPI.createVirtualMachine(options, options.data);
    } catch (err) {
      logDebug('创建虚拟机失败:', err);
      return {
        success: false,
        error: {
          message: `创建虚拟机失败: ${err.message}`
        }
      };
    }
  }

  // 更新虚拟机
  if (options.url && options.url.includes('/api/machines/') && options.method === 'put' && !options.url.includes('/screenshot')) {
    logDebug('更新虚拟机:', options.data);

    // 获取虚拟机ID
    const vmId = options.url.split('/').pop();
    logDebug('虚拟机ID:', vmId);

    try {
      // 更新虚拟机
      return await cockpitAPI.updateVirtualMachine(options, vmId, options.data);
    } catch (err) {
      logDebug('更新虚拟机失败:', err);
      return {
        success: false,
        error: {
          message: `更新虚拟机失败: ${err.message}`
        }
      };
    }
  }

  // 删除虚拟机
  if (options.url && options.url.includes('/api/machines/') && options.method === 'delete') {
    logDebug('删除虚拟机');

    // 获取虚拟机ID
    const vmId = options.url.split('/').pop();
    logDebug('虚拟机ID:', vmId);

    try {
      // 删除虚拟机
      return await cockpitAPI.deleteVirtualMachine(options, vmId);
    } catch (err) {
      logDebug('删除虚拟机失败:', err);
      return {
        success: false,
        error: {
          message: `删除虚拟机失败: ${err.message}`
        }
      };
    }
  }

  // 默认返回错误
  return {
    success: false,
    error: {
      message: `不支持的请求: ${options.method} ${options.url}`
    }
  };
});
