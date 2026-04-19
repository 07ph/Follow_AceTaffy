# Rhythm Pulse - 部署指南

## 项目信息

- **项目名称**: Rhythm Pulse
- **类型**: Vue 3 + Vite
- **端口**: 5173
- **技术栈**: Vue 3, TypeScript, Vite, Pinia

## 快速开始

### 1. 安装依赖

```bash
cd rhythm-pulse-source
npm install
```

### 2. 构建生产版本

```bash
npm run build
```

构建完成后，生产文件将在 `dist/` 目录中生成。

### 3. 运行生产服务器

#### 方式 A: 使用 Vite Preview（推荐用于测试）

```bash
npm run preview
```

访问: http://localhost:4173

#### 方式 B: 使用任何静态文件服务器

```bash
# 使用 Python
cd dist
python -m http.server 8000

# 使用 Node.js
cd dist
npx serve -p 8000

# 使用 Nginx/Apache（生产环境）
# 将 dist/ 目录内容部署到 Web 服务器
```

访问: http://localhost:8000（或配置的端口）

## 项目结构

```
rhythm-pulse-source/
├── dist/                 # 生产构建输出
├── node_modules/         # 依赖包
├── public/              # 静态资源
├── src/                 # 源代码
│   ├── assets/        # 资源文件
│   ├── components/    # Vue 组件
│   ├── stores/        # Pinia 状态管理
│   ├── types/         # TypeScript 类型定义
│   ├── views/         # 页面视图
│   └── main.ts        # 应用入口
├── index.html           # HTML 入口
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```

## 环境变量

如需自定义端口或其他配置，可创建 `.env` 文件：

```env
VITE_PORT=5173
```

## 生产部署

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;

    location / {
        try_files $uri $uri/ = /index.html;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
}
```

### Docker 部署（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 80
CMD ["npx", "serve", "-s", "dist"]
```

构建和运行：
```bash
docker build -t rhythm-pulse .
docker run -p 80:80 rhythm-pulse
```

## 常见问题

### Q: 构建时报错 "Cannot find module"

**A**: 删除 `node_modules` 和 `package-lock.json` 后重新安装依赖：
```bash
rm -rf node_modules package-lock.json
npm install
```

### Q: 样式或资源加载失败

**A**: 检查 `vite.config.ts` 中的 `publicDir` 配置，确保静态资源路径正确。

### Q: 路由在部署后不工作

**A**: 确保服务器配置了 SPA 路由回退（所有路径返回 `index.html`）。

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## 浏览器兼容性

- Chrome/Edge: ✅ 完全支持
- Firefox: ✅ 完全支持
- Safari: ✅ 完全支持（iOS/macOS）
- Opera: ✅ 完全支持

最低要求：现代浏览器（ES6+）

## 性能优化

- Vite 已启用生产构建优化
- 静态资源已哈希缓存
- 代码已分割和压缩
- 建议启用 CDN 加速静态资源

## 许可证

本项目遵循 MIT 许可证。
