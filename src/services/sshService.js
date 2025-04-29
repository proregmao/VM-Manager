/**
 * SSH服务
 * 用于与SSH服务器进行交互
 */

// 连接到SSH服务器
export const connectToSSH = async (options) => {
  try {
    // 调用Electron API中的connectSSH方法
    const response = await window.electronAPI.connectSSH(options);
    return response;
  } catch (error) {
    console.error('SSH连接失败:', error);
    throw error;
  }
};

// 执行SSH命令
export const executeSSHCommand = async (options) => {
  try {
    // 调用Electron API中的execSSHCommand方法
    const response = await window.electronAPI.execSSHCommand(options);
    return response;
  } catch (error) {
    console.error('SSH命令执行失败:', error);
    throw error;
  }
};

// 选择私钥文件
export const selectPrivateKey = async () => {
  try {
    // 调用Electron API中的selectPrivateKey方法
    const response = await window.electronAPI.selectPrivateKey();
    return response;
  } catch (error) {
    console.error('选择私钥文件失败:', error);
    throw error;
  }
};
