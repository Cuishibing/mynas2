#!/bin/bash

# 配置信息
REMOTE_HOST="10.42.0.1"
REMOTE_USER="cui"
REMOTE_DIR="/home/cui/Workspace/mynas2"
SSH_KEY="~/.ssh/id_rsa"  # SSH密钥路径

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# 打印带颜色的信息
info() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# 检查必要命令
check_commands() {
    info "检查必要命令..."
    for cmd in ssh scp; do
        if ! command -v $cmd &> /dev/null; then
            error "$cmd 未安装"
        fi
    done
}

# 传输文件到远程服务器
transfer_files() {
    info "传输文件到远程服务器..."
    # 创建远程目录
    # ssh -i $SSH_KEY $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR" || error "创建远程目录失败"
    
    # 创建临时目录用于传输
    TEMP_DIR=$(mktemp -d)
    
    # 复制后端文件，排除node_modules
    rsync -av --exclude 'node_modules' --exclude 'uploads' mynas_service/ $TEMP_DIR/mynas_service/ || error "复制后端文件失败"
    
    # 复制前端文件，排除node_modules和dist
    rsync -av --exclude 'node_modules' --exclude 'dist' mynas_front/ $TEMP_DIR/mynas_front/ || error "复制前端文件失败"
    
    # 复制其他配置文件
    cp docker-compose.yml nginx.conf $TEMP_DIR/ || error "复制配置文件失败"
    
    # 传输文件到远程服务器
    scp -i $SSH_KEY -r $TEMP_DIR/* $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/ || error "文件传输失败"
    
    # 清理临时目录
    rm -rf $TEMP_DIR
}

# 主函数
main() {
    info "开始部署流程..."
    
    check_commands
    transfer_files
    
    info "文件传输完成！"
    info "请在远程服务器上执行以下命令进行部署："
    info "cd $REMOTE_DIR"
    info "docker-compose down"
    info "docker-compose build --no-cache"
    info "docker-compose up -d"
}

# 执行主函数
main 