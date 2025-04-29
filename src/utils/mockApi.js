// 模拟API服务，用于开发模式
const mockApi = {
  // 模拟Cockpit API
  cockpitAPI: async (options) => {
    console.log('模拟API请求:', options);

    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 500));

    // 虚拟机操作（启动、关闭、暂停等）
    if (options.url && options.url.includes('/api/machines/') && options.method === 'post' && options.url.split('/').length >= 4) {
      console.log('模拟虚拟机操作');
      
      // 获取虚拟机ID和操作
      const parts = options.url.split('/');
      const vmId = parts[parts.length - 2];
      const action = parts[parts.length - 1];
      
      console.log('虚拟机ID:', vmId, '操作:', action);
      
      // 模拟操作响应
      return {
        success: true,
        status: 200,
        data: { success: true },
        headers: {}
      };
    }

    // 删除虚拟机
    if (options.url && options.url.includes('/api/machines/') && options.method === 'delete') {
      console.log('模拟删除虚拟机');
      
      // 获取虚拟机ID
      const vmId = options.url.split('/').pop();
      console.log('虚拟机ID:', vmId);
      
      // 模拟删除虚拟机响应
      return {
        success: true,
        status: 204,
        data: null,
        headers: {}
      };
    }

    // 更新虚拟机
    if (options.url && options.url.includes('/api/machines/') && options.method === 'put') {
      console.log('模拟更新虚拟机:', options.data);
      
      // 获取虚拟机ID
      const vmId = options.url.split('/').pop();
      console.log('虚拟机ID:', vmId);
      
      // 模拟更新虚拟机响应
      return {
        success: true,
        status: 200,
        data: options.data,
        headers: {}
      };
    }

    // 创建虚拟机
    if (options.url === '/api/machines' && options.method === 'post') {
      console.log('模拟创建虚拟机:', options.data);
      
      // 模拟创建虚拟机响应
      return {
        success: true,
        status: 201,
        data: options.data,
        headers: {}
      };
    }

    // 获取虚拟机列表
    if (options.url === '/api/machines' && options.method === 'get') {
      console.log('模拟获取虚拟机列表');
      
      // 返回模拟的虚拟机数据
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

    // 默认返回错误
    return {
      success: false,
      error: {
        message: `不支持的请求: ${options.method} ${options.url}`
      }
    };
  }
};

export default mockApi;
