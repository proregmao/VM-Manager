import React from 'react';
import { Alert } from 'antd';

const ErrorHandler = ({ error, onClear }) => {
  if (!error) return null;
  
  return (
    <Alert
      message="错误"
      description={error}
      type="error"
      showIcon
      closable
      onClose={onClear}
      style={{ marginBottom: '16px' }}
    />
  );
};

export default ErrorHandler;
