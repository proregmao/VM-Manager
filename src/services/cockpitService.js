/**
 * Cockpit服务API
 * 用于与Cockpit API进行交互
 */

// 调用Cockpit API
export const callCockpitAPI = async (options) => {
  try {
    // 调用Electron API中的cockpitAPI方法
    const response = await window.electronAPI.cockpitAPI(options);
    return response;
  } catch (error) {
    console.error('Cockpit API调用失败:', error);
    throw error;
  }
};

// 获取虚拟机列表
export const getVirtualMachines = async (server) => {
  try {
    const response = await callCockpitAPI({
      url: '/api/machines',
      method: 'get',
      host: server.host,
      port: server.cockpitPort,
      username: server.username,
      password: server.password,
      privateKeyPath: server.privateKeyPath,
      passphrase: server.passphrase,
    });
    
    return response;
  } catch (error) {
    console.error('获取虚拟机列表失败:', error);
    throw error;
  }
};

// 获取虚拟机详情
export const getVirtualMachineDetails = async (server, vmId) => {
  try {
    const response = await callCockpitAPI({
      url: `/api/machines/${vmId}`,
      method: 'get',
      host: server.host,
      port: server.cockpitPort,
      username: server.username,
      password: server.password,
      privateKeyPath: server.privateKeyPath,
      passphrase: server.passphrase,
    });
    
    return response;
  } catch (error) {
    console.error(`获取虚拟机 ${vmId} 详情失败:`, error);
    throw error;
  }
};

// 执行虚拟机操作
export const performVirtualMachineAction = async (server, vmId, action) => {
  try {
    const response = await callCockpitAPI({
      url: `/api/machines/${vmId}/${action}`,
      method: 'post',
      host: server.host,
      port: server.cockpitPort,
      username: server.username,
      password: server.password,
      privateKeyPath: server.privateKeyPath,
      passphrase: server.passphrase,
    });
    
    return response;
  } catch (error) {
    console.error(`执行虚拟机 ${vmId} 操作 ${action} 失败:`, error);
    throw error;
  }
};
