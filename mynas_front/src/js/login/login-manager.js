import { config } from '../config.js';

export class LoginManager {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginButton = document.getElementById('login-btn');
        this.registerButton = document.getElementById('register-btn');
    }

    bindEvents() {
        this.loginButton.addEventListener('click', () => this.handleLogin());
        this.registerButton.addEventListener('click', () => this.handleRegister());
        
        // 添加输入验证
        this.usernameInput.addEventListener('input', () => this.validateUsername());
        this.passwordInput.addEventListener('input', () => this.validatePassword());
    }

    validateUsername() {
        const username = this.usernameInput.value;
        const pattern = /^[a-zA-Z0-9_-]+$/;
        
        if (!pattern.test(username)) {
            this.usernameInput.setCustomValidity('用户名只能包含字母、数字、下划线和连字符');
        } else {
            this.usernameInput.setCustomValidity('');
        }
    }

    validatePassword() {
        const password = this.passwordInput.value;
        
        if (password.length < 6) {
            this.passwordInput.setCustomValidity('密码长度不能少于6个字符');
        } else {
            this.passwordInput.setCustomValidity('');
        }
    }

    async handleLogin() {
        // 验证输入
        this.validateUsername();
        this.validatePassword();

        if (!this.usernameInput.checkValidity() || !this.passwordInput.checkValidity()) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.usernameInput.value,
                    password: this.passwordInput.value
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 保存token到localStorage
                    localStorage.setItem('token', result.token);
                    // 登录成功，跳转到首页
                    window.location.href = 'index.html';
                } else {
                    alert('登录失败：' + result.message);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || '登录请求失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            alert('登录失败：' + error.message);
        }
    }

    async handleRegister() {
        // 验证输入
        this.validateUsername();
        this.validatePassword();

        if (!this.usernameInput.checkValidity() || !this.passwordInput.checkValidity()) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: this.usernameInput.value,
                    password: this.passwordInput.value
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // 保存token到localStorage
                    localStorage.setItem('token', result.token);
                    // 注册成功，跳转到首页
                    window.location.href = 'index.html';
                } else {
                    alert('注册失败：' + result.message);
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || '注册请求失败');
            }
        } catch (error) {
            console.error('注册失败:', error);
            alert('注册失败：' + error.message);
        }
    }
} 