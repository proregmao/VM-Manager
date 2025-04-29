#!/bin/bash

# 复制必要的文件到应用程序包中
cp -r dist release/mac-arm64/VM\ Manager.app/Contents/Resources/app/

# 显示应用程序包中的文件结构
find release/mac-arm64/VM\ Manager.app -type f | sort

echo "完成!"
