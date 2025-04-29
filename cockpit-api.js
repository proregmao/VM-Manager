const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// 调试日志
function logDebug(...args) {
  console.log('[Cockpit API]', ...args);
}

// 执行SSH命令
async function executeSSHCommand(sshConfig, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      logDebug('SSH连接已就绪');
      
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        let stdout = '';
        let stderr = '';
        
        stream.on('close', (code, signal) => {
          logDebug('命令执行完成，退出码:', code);
          conn.end();
          
          if (code !== 0) {
            return reject(new Error(`命令执行失败，退出码: ${code}, 错误: ${stderr}`));
          }
          
          resolve(stdout);
        }).on('data', (data) => {
          stdout += data.toString();
        }).stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    }).on('error', (err) => {
      logDebug('SSH连接错误:', err);
      reject(err);
    }).connect(sshConfig);
  });
}

// 构建SSH配置
function buildSSHConfig(options) {
  const config = {
    host: options.host,
    port: 22, // 默认SSH端口
    username: options.username || 'root',
  };
  
  // 如果提供了密码，则使用密码认证
  if (options.password) {
    config.password = options.password;
  }
  // 如果提供了私钥路径，则使用私钥认证
  else if (options.privateKeyPath) {
    try {
      const privateKey = fs.readFileSync(options.privateKeyPath);
      config.privateKey = privateKey;
      
      // 如果提供了密码短语，则使用密码短语
      if (options.passphrase) {
        config.passphrase = options.passphrase;
      }
    } catch (err) {
      logDebug('读取私钥文件失败:', err);
      throw err;
    }
  }
  
  return config;
}

// 获取虚拟机列表
async function getVirtualMachines(options) {
  try {
    const sshConfig = buildSSHConfig(options);
    
    // 构建命令，使用virsh list --all获取所有虚拟机
    const command = 'virsh list --all --name';
    
    // 执行命令
    const output = await executeSSHCommand(sshConfig, command);
    
    // 解析输出，获取虚拟机列表
    const vmNames = output.trim().split('\n').filter(name => name.trim() !== '');
    
    // 获取每个虚拟机的详细信息
    const vms = [];
    
    for (const name of vmNames) {
      try {
        // 获取虚拟机状态
        const stateCommand = `virsh domstate "${name}"`;
        const stateOutput = await executeSSHCommand(sshConfig, stateCommand);
        const state = stateOutput.trim();
        
        // 获取虚拟机CPU和内存信息
        const infoCommand = `virsh dominfo "${name}"`;
        const infoOutput = await executeSSHCommand(sshConfig, infoCommand);
        
        // 解析CPU和内存信息
        const vcpusMatch = infoOutput.match(/CPU\(s\):\s+(\d+)/);
        const memoryMatch = infoOutput.match(/Max memory:\s+(\d+)/);
        
        const vcpus = vcpusMatch ? parseInt(vcpusMatch[1]) : 1;
        const memory = memoryMatch ? parseInt(memoryMatch[1]) : 1024;
        
        // 获取虚拟机磁盘信息
        const diskCommand = `virsh domblklist "${name}"`;
        const diskOutput = await executeSSHCommand(sshConfig, diskCommand);
        
        // 解析磁盘信息
        const diskLines = diskOutput.trim().split('\n').slice(2); // 跳过标题行
        const disks = [];
        
        for (const line of diskLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2 && parts[1] && parts[1] !== '-') {
            // 获取磁盘大小
            const diskSizeCommand = `qemu-img info "${parts[1]}" | grep 'virtual size'`;
            const diskSizeOutput = await executeSSHCommand(sshConfig, diskSizeCommand);
            
            // 解析磁盘大小
            const sizeMatch = diskSizeOutput.match(/virtual size: (\d+)/);
            const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
            
            disks.push({
              device: parts[0],
              size: size
            });
          }
        }
        
        // 获取虚拟机网络接口信息
        const ifaceCommand = `virsh domiflist "${name}"`;
        const ifaceOutput = await executeSSHCommand(sshConfig, ifaceCommand);
        
        // 解析网络接口信息
        const ifaceLines = ifaceOutput.trim().split('\n').slice(2); // 跳过标题行
        const interfaces = [];
        
        for (const line of ifaceLines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            // 获取IP地址
            const ipCommand = `virsh domifaddr "${name}" | grep ${parts[0]}`;
            const ipOutput = await executeSSHCommand(sshConfig, ipCommand);
            
            // 解析IP地址
            let ip = '';
            const ipMatch = ipOutput.match(/\s+(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              ip = ipMatch[1];
            }
            
            interfaces.push({
              name: parts[0],
              mac: parts[2],
              ip: ip
            });
          }
        }
        
        // 构建虚拟机对象
        vms.push({
          id: name,
          name: name,
          state: state,
          vcpus: vcpus,
          memory: memory,
          disks: disks,
          interfaces: interfaces
        });
      } catch (err) {
        logDebug(`获取虚拟机 ${name} 详情失败:`, err);
      }
    }
    
    return {
      success: true,
      status: 200,
      data: vms,
      headers: {}
    };
  } catch (err) {
    logDebug('获取虚拟机列表失败:', err);
    return {
      success: false,
      error: {
        message: `获取虚拟机列表失败: ${err.message}`
      }
    };
  }
}

// 执行虚拟机操作
async function executeVirtualMachineAction(options, vmId, action) {
  try {
    const sshConfig = buildSSHConfig(options);
    
    // 根据操作构建命令
    let command = '';
    
    switch (action) {
      case 'start':
        command = `virsh start "${vmId}"`;
        break;
      case 'shutdown':
        command = `virsh shutdown "${vmId}"`;
        break;
      case 'forceoff':
        command = `virsh destroy "${vmId}"`;
        break;
      case 'reboot':
        command = `virsh reboot "${vmId}"`;
        break;
      case 'pause':
        command = `virsh suspend "${vmId}"`;
        break;
      case 'resume':
        command = `virsh resume "${vmId}"`;
        break;
      default:
        throw new Error(`不支持的操作: ${action}`);
    }
    
    // 执行命令
    await executeSSHCommand(sshConfig, command);
    
    return {
      success: true,
      status: 200,
      data: { success: true },
      headers: {}
    };
  } catch (err) {
    logDebug(`执行虚拟机 ${vmId} 操作 ${action} 失败:`, err);
    return {
      success: false,
      error: {
        message: `执行虚拟机操作失败: ${err.message}`
      }
    };
  }
}

// 删除虚拟机
async function deleteVirtualMachine(options, vmId) {
  try {
    const sshConfig = buildSSHConfig(options);
    
    // 先关闭虚拟机
    const shutdownCommand = `virsh destroy "${vmId}" || true`;
    await executeSSHCommand(sshConfig, shutdownCommand);
    
    // 删除虚拟机
    const deleteCommand = `virsh undefine "${vmId}" --remove-all-storage`;
    await executeSSHCommand(sshConfig, deleteCommand);
    
    return {
      success: true,
      status: 204,
      data: null,
      headers: {}
    };
  } catch (err) {
    logDebug(`删除虚拟机 ${vmId} 失败:`, err);
    return {
      success: false,
      error: {
        message: `删除虚拟机失败: ${err.message}`
      }
    };
  }
}

// 创建虚拟机
async function createVirtualMachine(options, vmData) {
  try {
    const sshConfig = buildSSHConfig(options);
    
    // 构建创建虚拟机的命令
    // 这里只是一个简化的示例，实际上创建虚拟机需要更复杂的步骤
    const command = `
      virt-install \\
        --name "${vmData.name}" \\
        --vcpus ${vmData.vcpus} \\
        --memory ${vmData.memory} \\
        --disk size=${vmData.disks[0].size / 1073741824} \\
        --network bridge=virbr0,mac=${vmData.interfaces[0].mac} \\
        --os-variant ubuntu20.04 \\
        --import \\
        --noautoconsole
    `;
    
    // 执行命令
    await executeSSHCommand(sshConfig, command);
    
    return {
      success: true,
      status: 201,
      data: vmData,
      headers: {}
    };
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
async function updateVirtualMachine(options, vmId, vmData) {
  try {
    const sshConfig = buildSSHConfig(options);
    
    // 构建更新虚拟机的命令
    // 这里只是一个简化的示例，实际上更新虚拟机需要更复杂的步骤
    const commands = [];
    
    // 更新CPU
    if (vmData.vcpus) {
      commands.push(`virsh setvcpus "${vmId}" ${vmData.vcpus} --config`);
    }
    
    // 更新内存
    if (vmData.memory) {
      commands.push(`virsh setmaxmem "${vmId}" ${vmData.memory} --config`);
      commands.push(`virsh setmem "${vmId}" ${vmData.memory} --config`);
    }
    
    // 执行命令
    for (const command of commands) {
      await executeSSHCommand(sshConfig, command);
    }
    
    return {
      success: true,
      status: 200,
      data: vmData,
      headers: {}
    };
  } catch (err) {
    logDebug(`更新虚拟机 ${vmId} 失败:`, err);
    return {
      success: false,
      error: {
        message: `更新虚拟机失败: ${err.message}`
      }
    };
  }
}

module.exports = {
  getVirtualMachines,
  executeVirtualMachineAction,
  deleteVirtualMachine,
  createVirtualMachine,
  updateVirtualMachine
};
