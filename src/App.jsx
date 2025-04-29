import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import ServerForm from './components/ServerForm';
import ServerDetail from './components/ServerDetail';
import ErrorHandler from './components/ErrorHandler';
import './App.css';

const { Header, Sider, Content } = Layout;

function App() {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [showServerForm, setShowServerForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 加载服务器列表
  const loadServers = async () => {
    try {
      const serverList = await window.electronAPI.getServers();
      setServers(serverList);
      
      // 如果有服务器但没有选中的服务器，则选中第一个
      if (serverList.length > 0 && !selectedServer) {
        setSelectedServer(serverList[0]);
      }
    } catch (err) {
      console.error('加载服务器列表失败:', err);
      setError('加载服务器列表失败');
    }
  };

  // 初始加载
  useEffect(() => {
    loadServers();
  }, []);

  // 添加服务器
  const handleAddServer = () => {
    setEditingServer(null);
    setShowServerForm(true);
  };

  // 编辑服务器
  const handleEditServer = (server) => {
    setEditingServer(server);
    setShowServerForm(true);
  };

  // 删除服务器
  const handleDeleteServer = async (serverId) => {
    try {
      setLoading(true);
      await window.electronAPI.deleteServer(serverId);
      message.success('服务器已删除');
      
      // 重新加载服务器列表
      await loadServers();
      
      // 如果删除的是当前选中的服务器，则清除选中状态
      if (selectedServer && selectedServer.id === serverId) {
        setSelectedServer(null);
      }
    } catch (err) {
      console.error('删除服务器失败:', err);
      setError('删除服务器失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存服务器
  const handleSaveServer = async (server) => {
    try {
      setLoading(true);
      await window.electronAPI.saveServer(server);
      message.success('服务器已保存');
      
      // 重新加载服务器列表
      await loadServers();
      
      // 关闭表单
      setShowServerForm(false);
    } catch (err) {
      console.error('保存服务器失败:', err);
      setError('保存服务器失败');
    } finally {
      setLoading(false);
    }
  };

  // 选择服务器
  const handleSelectServer = (server) => {
    setSelectedServer(server);
  };

  // 刷新服务器列表
  const handleRefresh = () => {
    loadServers();
  };

  // 关闭表单
  const handleCloseForm = () => {
    setShowServerForm(false);
  };

  // 清除错误
  const handleClearError = () => {
    setError(null);
  };

  return (
    <Layout className="app-container">
      <Header style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>VM Manager</div>
      </Header>
      <Layout className="main-content">
        <Sider width={250} theme="light">
          <div style={{ padding: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddServer} block>
              添加服务器
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh} 
              style={{ marginTop: '8px' }} 
              block
            >
              刷新
            </Button>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedServer ? [selectedServer.id] : []}
          >
            {servers.map(server => (
              <Menu.Item key={server.id} onClick={() => handleSelectServer(server)}>
                {server.name} ({server.host})
              </Menu.Item>
            ))}
          </Menu>
        </Sider>
        <Content className="content">
          {error && (
            <ErrorHandler error={error} onClear={handleClearError} />
          )}
          
          {showServerForm ? (
            <ServerForm 
              server={editingServer} 
              onSave={handleSaveServer} 
              onCancel={handleCloseForm}
              loading={loading}
            />
          ) : selectedServer ? (
            <ServerDetail 
              server={selectedServer} 
              onEdit={() => handleEditServer(selectedServer)} 
              onDelete={() => handleDeleteServer(selectedServer.id)}
              loading={loading}
            />
          ) : (
            <div style={{ textAlign: 'center', marginTop: '100px' }}>
              <p>请选择一个服务器或添加新服务器</p>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
