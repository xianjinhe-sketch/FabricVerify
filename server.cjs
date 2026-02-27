const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// 静态文件托管（Vite 打包后的 dist 目录）
const distPath = path.join(__dirname, 'dist');

// 如果 dist 不存在（未构建），打印提示
if (!fs.existsSync(distPath)) {
    console.error('[ERROR] dist/ folder not found. Make sure to run "npm run build" before starting the server.');
    process.exit(1);
}

app.use(express.static(distPath));

// SPA 路由回退，确保单页应用所有路由都返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// 阿里云 FC / 本地环境：监听端口
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
    console.log(`[FabricVerify] Server running on port ${PORT}`);
    console.log(`[FabricVerify] Platform: Alibaba Cloud FC`);
});
