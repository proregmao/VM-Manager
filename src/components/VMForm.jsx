import React, { useState } from 'react';
import { Form, Input, Button, Card, InputNumber, Select, message } from 'antd';
import { v4 as uuidv4 } from 'uuid';

const { Option } = Select;

const VMForm = ({ vm, server, onSave, onCancel, loading }) => {
  const [form] = Form.useForm();
  const isEdit = !!vm;

  // 提交表单
  const handleSubmit = async (values) => {
    try {
      // 构建虚拟机对象
      const vmData = {
        id: vm?.id || uuidv4(),
        name: values.name,
        vcpus: values.vcpus,
        memory: values.memory * 1024, // 转换为MB
        state: vm?.state || 'shut off',
        disks: [
          {
            device: 'vda',
            size: values.diskSize * 1073741824 // 转换为字节
          }
        ],
        interfaces: [
          {
            name: values.networkInterface,
            mac: values.macAddress || `52:54:00:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
            ip: values.ipAddress
          }
        ]
      };

      // 构建API请求选项
      const apiOptions = {
        url: isEdit ? `/api/machines/${vm.id}` : '/api/machines',
        method: isEdit ? 'put' : 'post',
        data: vmData,
        host: server.host,
        port: server.cockpitPort,
        username: server.username,
        password: server.password,
        privateKeyPath: server.privateKeyPath,
        passphrase: server.passphrase,
      };

      console.log(`${isEdit ? '更新' : '创建'}虚拟机API请求选项:`, JSON.stringify(apiOptions, null, 2));

      // 调用API保存虚拟机
      const response = await window.electronAPI.cockpitAPI(apiOptions);

      if (response.success) {
        message.success(isEdit ? '虚拟机已更新' : '虚拟机已创建');
        onSave(vmData);
      } else {
        message.error(`${isEdit ? '更新' : '创建'}虚拟机失败: ${response.error?.message || '未知错误'}`);
      }
    } catch (err) {
      console.error(`${isEdit ? '更新' : '创建'}虚拟机失败:`, err);
      message.error(`${isEdit ? '更新' : '创建'}虚拟机失败: ${err.message || '未知错误'}`);
    }
  };

  // 初始化表单值
  const initialValues = {
    name: vm?.name || '',
    vcpus: vm?.vcpus || 1,
    memory: vm?.memory ? Math.floor(vm.memory / 1024) : 1, // 转换为GB
    diskSize: vm?.disks && vm.disks.length > 0 ? Math.floor(vm.disks[0].size / 1073741824) : 10, // 转换为GB
    networkInterface: vm?.interfaces && vm.interfaces.length > 0 ? vm.interfaces[0].name : 'vnet0',
    macAddress: vm?.interfaces && vm.interfaces.length > 0 ? vm.interfaces[0].mac : '',
    ipAddress: vm?.interfaces && vm.interfaces.length > 0 ? vm.interfaces[0].ip : '',
  };

  return (
    <Card title={isEdit ? '编辑虚拟机' : '添加虚拟机'} style={{ maxWidth: 800, margin: '0 auto' }}>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入虚拟机名称' }]}
        >
          <Input placeholder="虚拟机名称" />
        </Form.Item>

        <Form.Item
          name="vcpus"
          label="CPU核心数"
          rules={[{ required: true, message: '请输入CPU核心数' }]}
        >
          <InputNumber min={1} max={64} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="memory"
          label="内存 (GB)"
          rules={[{ required: true, message: '请输入内存大小' }]}
        >
          <InputNumber min={1} max={256} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="diskSize"
          label="磁盘大小 (GB)"
          rules={[{ required: true, message: '请输入磁盘大小' }]}
        >
          <InputNumber min={1} max={2000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="networkInterface"
          label="网络接口"
          rules={[{ required: true, message: '请输入网络接口名称' }]}
        >
          <Select>
            <Option value="vnet0">vnet0</Option>
            <Option value="vnet1">vnet1</Option>
            <Option value="vnet2">vnet2</Option>
            <Option value="vnet3">vnet3</Option>
            <Option value="vnet4">vnet4</Option>
            <Option value="vnet5">vnet5</Option>
            <Option value="vnet6">vnet6</Option>
            <Option value="vnet7">vnet7</Option>
            <Option value="vnet8">vnet8</Option>
            <Option value="vnet9">vnet9</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="macAddress"
          label="MAC地址 (可选)"
        >
          <Input placeholder="例如: 52:54:00:12:34:56" />
        </Form.Item>

        <Form.Item
          name="ipAddress"
          label="IP地址"
          rules={[{ required: true, message: '请输入IP地址' }]}
        >
          <Input placeholder="例如: 192.168.110.10" />
        </Form.Item>

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button onClick={onCancel} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit ? '更新' : '创建'}
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default VMForm;
