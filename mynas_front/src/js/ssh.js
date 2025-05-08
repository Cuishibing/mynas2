import { Client } from 'ssh2';

export class SSHConnection {
    constructor() {
        this.ssh = null;
        this.connected = false;
        this.sftp = null;
        this.init();
    }

    init() {
        this.connectBtn = document.getElementById('connect-btn');
        this.statusDiv = document.getElementById('connection-status');
        this.connectBtn.addEventListener('click', () => this.connect());
    }

    async connect() {
        const host = document.getElementById('host').value;
        const port = document.getElementById('port').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!host || !username || !password) {
            this.updateStatus('请填写所有必填字段', 'error');
            return;
        }

        try {
            this.updateStatus('正在连接...', 'info');
            
            this.ssh = new Client();
            
            await new Promise((resolve, reject) => {
                this.ssh.on('ready', () => {
                    this.connected = true;
                    this.updateStatus('连接成功！', 'success');
                    this.showUploadSection();
                    resolve();
                });

                this.ssh.on('error', (err) => {
                    this.connected = false;
                    this.updateStatus('连接失败：' + err.message, 'error');
                    reject(err);
                });

                this.ssh.connect({
                    host: host,
                    port: port,
                    username: username,
                    password: password
                });
            });

            // 初始化 SFTP
            this.sftp = await this.initSFTP();

        } catch (error) {
            this.updateStatus('连接错误：' + error.message, 'error');
        }
    }

    async initSFTP() {
        return new Promise((resolve, reject) => {
            this.ssh.sftp((err, sftp) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(sftp);
            });
        });
    }

    async uploadFile(localPath, remotePath) {
        if (!this.sftp) {
            throw new Error('SFTP 未初始化');
        }

        return new Promise((resolve, reject) => {
            this.sftp.fastPut(localPath, remotePath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async downloadFile(remotePath, localPath) {
        if (!this.sftp) {
            throw new Error('SFTP 未初始化');
        }

        return new Promise((resolve, reject) => {
            this.sftp.fastGet(remotePath, localPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    async listFiles(remotePath) {
        if (!this.sftp) {
            throw new Error('SFTP 未初始化');
        }

        return new Promise((resolve, reject) => {
            this.sftp.readdir(remotePath, (err, list) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(list);
            });
        });
    }

    updateStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = type;
    }

    showUploadSection() {
        document.getElementById('upload-section').style.display = 'block';
        document.getElementById('gallery').style.display = 'block';
    }

    isConnected() {
        return this.connected;
    }

    disconnect() {
        if (this.ssh) {
            this.ssh.end();
            this.connected = false;
            this.sftp = null;
            this.updateStatus('已断开连接', 'info');
        }
    }
} 