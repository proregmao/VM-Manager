import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Spin, Typography, Tag, Space, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined, PoweroffOutlined, PlayCircleOutlined, PauseCircleOutlined, ExportOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { confirm } = Modal;

// 格式化内存大小
const formatMemory = (memory) => {
  if (!memory) return '未知';

  // 特殊处理常见的内存值
  if (memory === 1048576) return '1 GB';
  if (memory === 2097152) return '2 GB';
  if (memory === 4194304) return '4 GB';
  if (memory === 8388608) return '8 GB';
  if (memory === 8192) return '8 GB';
  if (memory === 16384) return '16 GB';
  if (memory === 32768) return '32 GB';
  if (memory === 65536) return '64 GB';

  // 转换为GB
  const gb = memory / 1048576;

  // 如果是整数GB，则不显示小数点
  if (Math.floor(gb) === gb) {
    return `${gb} GB`;
  }

  return `${gb.toFixed(2)} GB`;
};

// 格式化磁盘大小
const formatDiskSize = (size) => {
  if (!size) return '未知';

  const gb = size / 1073741824;

  // 如果是整数GB，则不显示小数点
  if (Math.floor(gb) === gb) {
    return `${gb} GB`;
  }

  return `${gb.toFixed(2)} GB`;
};

// 获取状态标签颜色
const getStatusColor = (state) => {
  if (!state) return 'default';

  const stateStr = state.toLowerCase();
  if (stateStr === 'running') return 'success';
  if (stateStr === 'paused') return 'warning';
  if (stateStr === 'shut off' || stateStr === 'shutoff') return 'error';

  return 'default';
};

// 获取状态显示文本
const getStatusText = (state) => {
  if (!state) return '未知';

  const stateStr = state.toLowerCase();
  if (stateStr === 'running') return '运行中';
  if (stateStr === 'paused') return '已暂停';
  if (stateStr === 'shut off' || stateStr === 'shutoff') return '已关闭';

  return state;
};

const ServerDetail = ({ server, onEdit, onDelete, loading: propLoading }) => {
  const [vms, setVMs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // 加载虚拟机列表
  const loadVMs = async () => {
    if (!server) return;

    try {
      setLoading(true);
      setError(null);

      // 调用Cockpit API获取虚拟机列表
      const response = await window.electronAPI.cockpitAPI({
        url: '/api/machines',
        method: 'get',
        host: server.host,
        port: server.cockpitPort,
        username: server.username,
        password: server.password,
        privateKeyPath: server.privateKeyPath,
        passphrase: server.passphrase,
      });

      if (response.success) {
        // 调试输出
        console.log('虚拟机列表:', response.data);

        // 对每个虚拟机进行调试输出
        response.data.forEach(vm => {
          console.log(`虚拟机 ${vm.name} 的内存:`, vm.memory);
          console.log(`虚拟机 ${vm.name} 的格式化内存:`, formatMemory(vm.memory));

          if (vm.interfaces && vm.interfaces.length > 0) {
            console.log(`虚拟机 ${vm.name} 的网络接口:`, vm.interfaces);
          }
        });

        setVMs(response.data);
      } else {
        console.error('获取虚拟机列表失败:', response.error);
        setError('获取虚拟机列表失败: ' + (response.error?.message || '未知错误'));
      }
    } catch (err) {
      console.error('获取虚拟机列表异常:', err);
      setError('获取虚拟机列表异常: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 当服务器变化时加载虚拟机列表
  useEffect(() => {
    loadVMs();
  }, [server]);

  // 刷新虚拟机列表
  const handleRefresh = () => {
    loadVMs();
  };

  // 确认删除服务器
  const handleConfirmDelete = () => {
    confirm({
      title: '确认删除',
      content: `确定要删除服务器 "${server.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        onDelete();
      },
    });
  };

  // 执行虚拟机操作
  const handleVMAction = async (vmId, action) => {
    if (!server || !vmId || !action) return;

    try {
      // 设置操作加载状态
      setActionLoading(prev => ({ ...prev, [vmId + action]: true }));

      // 调用Cockpit API执行操作
      const response = await window.electronAPI.cockpitAPI({
        url: `/api/machines/${vmId}/${action}`,
        method: 'post',
        host: server.host,
        port: server.cockpitPort,
        username: server.username,
        password: server.password,
        privateKeyPath: server.privateKeyPath,
        passphrase: server.passphrase,
      });

      if (response.success) {
        message.success(`操作 ${action} 成功`);

        // 延迟一下再刷新，让操作有时间生效
        setTimeout(() => {
          loadVMs();
        }, 1000);
      } else {
        console.error(`操作 ${action} 失败:`, response.error);
        message.error(`操作 ${action} 失败: ${response.error?.message || '未知错误'}`);
      }
    } catch (err) {
      console.error(`操作 ${action} 异常:`, err);
      message.error(`操作 ${action} 异常: ${err.message || '未知错误'}`);
    } finally {
      // 清除操作加载状态
      setActionLoading(prev => ({ ...prev, [vmId + action]: false }));
    }
  };

  // 打开Cockpit Web界面
  const handleOpenCockpit = () => {
    const url = `http://${server.host}:${server.cockpitPort}`;
    window.open(url, '_blank');
  };

  if (!server) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <p>请选择一个服务器</p>
      </div>
    );
  }

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{server.name} ({server.host})</span>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
                刷新
              </Button>
              <Button icon={<EditOutlined />} onClick={onEdit}>
                编辑
              </Button>
              <Button icon={<DeleteOutlined />} danger onClick={handleConfirmDelete}>
                删除
              </Button>
              <Button type="primary" onClick={handleOpenCockpit}>
                打开Cockpit Web界面
              </Button>
            </Space>
          </div>
        }
        style={{ marginBottom: '16px' }}
      >
        <Row gutter={16}>
          <Col span={8}>
            <Text strong>主机地址:</Text> {server.host}
          </Col>
          <Col span={8}>
            <Text strong>SSH端口:</Text> {server.port}
          </Col>
          <Col span={8}>
            <Text strong>用户名:</Text> {server.username}
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: '8px' }}>
          <Col span={8}>
            <Text strong>认证方式:</Text> {server.authType === 'password' ? '密码' : '私钥'}
          </Col>
          <Col span={8}>
            <Text strong>Cockpit端口:</Text> {server.cockpitPort}
          </Col>
          <Col span={8}>
            <Text strong>使用Cockpit API:</Text> {server.useCockpit ? '是' : '否'}
          </Col>
        </Row>
      </Card>

      <Title level={4}>虚拟机列表</Title>

      {error && (
        <div style={{ color: 'red', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading || propLoading ? (
        <div style={{ textAlign: 'center', margin: '50px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        vms.length > 0 ? (
          vms.map(vm => (
            <Card
              key={vm.id}
              className="vm-card"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    {vm.name}
                    <Tag color={getStatusColor(vm.state)} style={{ marginLeft: '8px' }}>
                      {getStatusText(vm.state)}
                    </Tag>
                  </span>
                  <Space>
                    {vm.state === 'running' && (
                      <>
                        <Button
                          icon={<PoweroffOutlined />}
                          onClick={() => handleVMAction(vm.id, 'shutdown')}
                          loading={actionLoading[vm.id + 'shutdown']}
                        >
                          关闭
                        </Button>
                        <Button
                          icon={<PauseCircleOutlined />}
                          onClick={() => handleVMAction(vm.id, 'pause')}
                          loading={actionLoading[vm.id + 'pause']}
                        >
                          暂停
                        </Button>
                        <Button
                          danger
                          icon={<PoweroffOutlined />}
                          onClick={() => handleVMAction(vm.id, 'forceoff')}
                          loading={actionLoading[vm.id + 'forceoff']}
                        >
                          强制关闭
                        </Button>
                      </>
                    )}
                    {vm.state === 'paused' && (
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleVMAction(vm.id, 'resume')}
                        loading={actionLoading[vm.id + 'resume']}
                      >
                        恢复
                      </Button>
                    )}
                    {(vm.state === 'shut off' || vm.state === 'shutoff') && (
                      <Button
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleVMAction(vm.id, 'start')}
                        loading={actionLoading[vm.id + 'start']}
                      >
                        启动
                      </Button>
                    )}
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => handleVMAction(vm.id, 'reboot')}
                      loading={actionLoading[vm.id + 'reboot']}
                      disabled={vm.state !== 'running'}
                    >
                      重启
                    </Button>
                  </Space>
                </div>
              }
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
                <div>
                  <span style={{ color: '#666' }}>CPU: </span>
                  <span>{vm.vcpus}核</span>
                </div>
                <div>
                  <span style={{ color: '#666' }}>内存: </span>
                  <span>{formatMemory(vm.memory)}</span>
                </div>
                {vm.disks && vm.disks.length > 0 && (
                  <div>
                    <span style={{ color: '#666' }}>磁盘: </span>
                    <span>{formatDiskSize(vm.disks[0].size)}</span>
                  </div>
                )}
                {vm.interfaces && vm.interfaces.length > 0 && (
                  <div>
                    <span style={{ color: '#666' }}>网络: </span>
                    <span>
                      {vm.interfaces.map((iface, index) => {
                        // 调试输出
                        console.log(`虚拟机 ${vm.name} 的网络接口 ${iface.name}:`, JSON.stringify(iface));

                        // 检查IP地址是否存在
                        const hasIp = iface.ip && iface.ip !== 'undefined' && iface.ip !== '';

                        return (
                          <span key={index}>
                            {iface.name}
                            {hasIp && ` IP地址: ${iface.ip}`}
                            {index < vm.interfaces.length - 1 ? ', ' : ''}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div style={{ textAlign: 'center', margin: '50px 0' }}>
            <p>没有找到虚拟机</p>
          </div>
        )
      )}
    </div>
  );
};

export default ServerDetail;
