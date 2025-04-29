const http = require('http');
const https = require('https');
const { Client } = require('ssh2');
const fs = require('fs');

// 调试日志
function logDebug(...args) {
  console.log('[Cockpit API]', ...args);
}

// 执行HTTP请求
async function executeHttpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    // 构建请求选项
    const requestOptions = {
      hostname: options.host,
      port: options.cockpitPort || 9090,
      path: options.url,
      method: options.method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false, // 忽略SSL证书错误
    };

    // 强制使用root用户和密码0147
    const auth = Buffer.from(`root:0147`).toString('base64');
    requestOptions.headers['Authorization'] = `Basic ${auth}`;

    logDebug('HTTP请求选项:', JSON.stringify(requestOptions, null, 2));

    // 创建请求
    const req = (options.cockpitPort === 443 ? https : http).request(requestOptions, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // 解析响应数据
        let parsedData;
        try {
          parsedData = responseData ? JSON.parse(responseData) : {};
        } catch (err) {
          parsedData = responseData;
        }

        // 检查状态码
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            success: true,
            status: res.statusCode,
            data: parsedData,
            headers: res.headers,
          });
        } else {
          reject({
            success: false,
            status: res.statusCode,
            error: {
              message: `HTTP请求失败: ${res.statusCode} ${res.statusMessage}`,
              data: parsedData,
            },
          });
        }
      });
    });

    req.on('error', (err) => {
      logDebug('HTTP请求错误:', err);
      reject({
        success: false,
        error: {
          message: `HTTP请求异常: ${err.message}`,
        },
      });
    });

    // 发送请求数据
    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 通过SSH隧道执行HTTP请求
async function executeHttpRequestViaSSH(options, data = null) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      logDebug('SSH连接已就绪，准备创建隧道');

      // 创建本地端口转发
      conn.forwardOut('127.0.0.1', 0, options.host, options.cockpitPort || 9090, async (err, stream) => {
        if (err) {
          conn.end();
          return reject({
            success: false,
            error: {
              message: `创建SSH隧道失败: ${err.message}`,
            },
          });
        }

        logDebug('SSH隧道已创建');

        // 构建HTTP请求
        const requestOptions = {
          path: options.url,
          method: options.method.toUpperCase(),
          headers: {
            'Content-Type': 'application/json',
            'Host': `${options.host}:${options.cockpitPort || 9090}`,
          },
        };

        // 强制使用root用户和密码0147
        const auth = Buffer.from(`root:0147`).toString('base64');
        requestOptions.headers['Authorization'] = `Basic ${auth}`;

        // 创建HTTP请求
        const req = http.request(requestOptions, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            conn.end();

            // 解析响应数据
            let parsedData;
            try {
              parsedData = responseData ? JSON.parse(responseData) : {};
            } catch (err) {
              parsedData = responseData;
            }

            // 检查状态码
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                status: res.statusCode,
                data: parsedData,
                headers: res.headers,
              });
            } else {
              reject({
                success: false,
                status: res.statusCode,
                error: {
                  message: `HTTP请求失败: ${res.statusCode} ${res.statusMessage}`,
                  data: parsedData,
                },
              });
            }
          });
        });

        req.on('error', (err) => {
          conn.end();
          reject({
            success: false,
            error: {
              message: `HTTP请求异常: ${err.message}`,
            },
          });
        });

        // 发送请求数据
        if (data) {
          req.write(JSON.stringify(data));
        }

        req.end();

        // 将HTTP请求通过SSH隧道发送
        req.pipe(stream);
        stream.pipe(req);
      });
    }).on('error', (err) => {
      logDebug('SSH连接错误:', err);
      reject({
        success: false,
        error: {
          message: `SSH连接失败: ${err.message}`,
        },
      });
    });

    // 连接SSH服务器
    try {
      // 强制使用root用户和密码0147
      conn.connect({
        host: options.host,
        port: options.port || 22,
        username: 'root',
        password: '0147',
      });
    } catch (err) {
      logDebug('SSH连接异常:', err);
      reject({
        success: false,
        error: {
          message: `SSH连接异常: ${err.message}`,
        },
      });
    }
  });
}

// 执行Cockpit API请求
async function executeCockpitAPI(options, data = null) {
  try {
    // 尝试直接HTTP请求
    return await executeHttpRequest(options, data);
  } catch (err) {
    logDebug('直接HTTP请求失败，尝试通过SSH隧道:', err);

    // 如果直接HTTP请求失败，尝试通过SSH隧道
    return await executeHttpRequestViaSSH(options, data);
  }
}

// 获取虚拟机列表
async function getVirtualMachines(options) {
  try {
    // 构建API请求选项
    const apiOptions = {
      ...options,
      url: '/api/machines',
      method: 'get',
    };

    // 执行API请求
    const response = await executeCockpitAPI(apiOptions);

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    logDebug('获取虚拟机列表失败:', err);
    return {
      success: false,
      error: {
        message: `获取虚拟机列表失败: ${err.error?.message || err.message || '未知错误'}`,
      },
    };
  }
}

// 执行虚拟机操作
async function executeVirtualMachineAction(options, vmId, action) {
  try {
    // 构建API请求选项
    const apiOptions = {
      ...options,
      url: `/api/machines/${vmId}/${action}`,
      method: 'post',
    };

    // 执行API请求
    const response = await executeCockpitAPI(apiOptions);

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    logDebug(`执行虚拟机 ${vmId} 操作 ${action} 失败:`, err);
    return {
      success: false,
      error: {
        message: `执行虚拟机操作失败: ${err.error?.message || err.message || '未知错误'}`,
      },
    };
  }
}

// 删除虚拟机
async function deleteVirtualMachine(options, vmId) {
  try {
    // 构建API请求选项
    const apiOptions = {
      ...options,
      url: `/api/machines/${vmId}`,
      method: 'delete',
    };

    // 执行API请求
    const response = await executeCockpitAPI(apiOptions);

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    logDebug(`删除虚拟机 ${vmId} 失败:`, err);
    return {
      success: false,
      error: {
        message: `删除虚拟机失败: ${err.error?.message || err.message || '未知错误'}`,
      },
    };
  }
}

// 创建虚拟机
async function createVirtualMachine(options, vmData) {
  try {
    // 构建API请求选项
    const apiOptions = {
      ...options,
      url: '/api/machines',
      method: 'post',
    };

    // 执行API请求
    const response = await executeCockpitAPI(apiOptions, vmData);

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    logDebug('创建虚拟机失败:', err);
    return {
      success: false,
      error: {
        message: `创建虚拟机失败: ${err.error?.message || err.message || '未知错误'}`,
      },
    };
  }
}

// 更新虚拟机
async function updateVirtualMachine(options, vmId, vmData) {
  try {
    // 构建API请求选项
    const apiOptions = {
      ...options,
      url: `/api/machines/${vmId}`,
      method: 'put',
    };

    // 执行API请求
    const response = await executeCockpitAPI(apiOptions, vmData);

    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (err) {
    logDebug(`更新虚拟机 ${vmId} 失败:`, err);
    return {
      success: false,
      error: {
        message: `更新虚拟机失败: ${err.error?.message || err.message || '未知错误'}`,
      },
    };
  }
}

module.exports = {
  getVirtualMachines,
  executeVirtualMachineAction,
  deleteVirtualMachine,
  createVirtualMachine,
  updateVirtualMachine,
};
