import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, InputNumber, Switch, message } from 'antd';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;

const ServerForm = ({ server, onSave, onCancel, loading }) => {
  const [form] = Form.useForm();
  const [authType, setAuthType] = useState(server?.authType || 'password');
  const [privateKeyPath, setPrivateKeyPath] = useState(server?.privateKeyPath || '');
  const [testLoading, setTestLoading] = useState(false);

  // 选择私钥文件
  const handleSelectPrivateKey = async () => {
    try {
      const result = await window.electronAPI.selectPrivateKey();
      if (result.success) {
        setPrivateKeyPath(result.filePath);
        form.setFieldsValue({ privateKeyPath: result.filePath });
      }
    } catch (err) {
      console.error('选择私钥文件失败:', err);
      message.error('选择私钥文件失败');
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    try {
      // 验证表单
      await form.validateFields();
      
      // 获取表单数据
      const values = form.getFieldsValue();
      
      setTestLoading(true);
      
      // 构建连接选项
      const options = {
        host: values.host,
        port: values.port,
        username: values.username,
      };
      
      // 根据认证类型设置选项
      if (values.authType === 'password') {
        options.password = values.password;
      } else {
        options.privateKeyPath = values.privateKeyPath;
        options.passphrase = values.passphrase;
      }
      
      // 测试连接
      const result = await window.electronAPI.connectSSH(options);
      
      if (result.success) {
        message.success('连接成功');
      } else {
        message.error(`连接失败: ${result.message}`);
      }
    } catch (err) {
      console.error('测试连接失败:', err);
      message.error('测试连接失败');
    } finally {
      setTestLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async (values) => {
    // 构建服务器对象
    const serverData = {
      id: server?.id || uuidv4(),
      name: values.name,
      host: values.host,
      port: values.port,
      username: values.username,
      authType: values.authType,
      cockpitPort: values.cockpitPort,
      useCockpit: values.useCockpit,
    };
    
    // 根据认证类型设置选项
    if (values.authType === 'password') {
      serverData.password = values.password;
    } else {
      serverData.privateKeyPath = values.privateKeyPath;
      serverData.passphrase = values.passphrase;
    }
    
    // 保存服务器
    onSave(serverData);
  };

  return (
    <Card title={server ? '编辑服务器' : '添加服务器'} className="server-form">
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: server?.name || '',
          host: server?.host || '',
          port: server?.port || 22,
          username: server?.username || 'root',
          password: server?.password || '',
          authType: server?.authType || 'password',
          privateKeyPath: server?.privateKeyPath || '',
          passphrase: server?.passphrase || '',
          cockpitPort: server?.cockpitPort || 9090,
          useCockpit: server?.useCockpit !== undefined ? server.useCockpit : true,
        }}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入服务器名称' }]}
        >
          <Input placeholder="服务器名称" />
        </Form.Item>
        
        <Form.Item
          name="host"
          label="主机地址"
          rules={[{ required: true, message: '请输入主机地址' }]}
        >
          <Input placeholder="IP地址或域名" />
        </Form.Item>
        
        <Form.Item
          name="port"
          label="SSH端口"
          rules={[{ required: true, message: '请输入SSH端口' }]}
        >
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="用户名" />
        </Form.Item>
        
        <Form.Item
          name="authType"
          label="认证方式"
          rules={[{ required: true, message: '请选择认证方式' }]}
        >
          <Select onChange={(value) => setAuthType(value)}>
            <Option value="password">密码</Option>
            <Option value="privateKey">私钥</Option>
          </Select>
        </Form.Item>
        
        {authType === 'password' ? (
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: authType === 'password', message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="privateKeyPath"
              label="私钥文件"
              rules={[{ required: authType === 'privateKey', message: '请选择私钥文件' }]}
            >
              <Input 
                placeholder="私钥文件路径" 
                readOnly 
                value={privateKeyPath}
                addonAfter={
                  <Button type="link" size="small" onClick={handleSelectPrivateKey}>
                    选择
                  </Button>
                }
              />
            </Form.Item>
            
            <Form.Item
              name="passphrase"
              label="私钥密码"
              rules={[{ required: false }]}
            >
              <Input.Password placeholder="私钥密码（如果有）" />
            </Form.Item>
          </>
        )}
        
        <Form.Item
          name="cockpitPort"
          label="Cockpit端口"
          rules={[{ required: true, message: '请输入Cockpit端口' }]}
        >
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        
        <Form.Item
          name="useCockpit"
          label="使用Cockpit API"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        
        <div className="form-actions">
          <Button onClick={handleTestConnection} loading={testLoading} style={{ marginRight: '8px' }}>
            测试连接
          </Button>
          <Button onClick={onCancel} style={{ marginRight: '8px' }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default ServerForm;
