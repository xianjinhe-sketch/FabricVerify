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

app.use(express.json({ limit: '50mb' }));
app.use(express.static(distPath));

// Gemini 代理接口
app.post('/api/gemini', async (req, res) => {
    const { contents, generationConfig } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: { message: 'Gemini API Key missing' } });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig })
        });

        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        res.json(data);
    } catch (error) {
        console.error('[Gemini Proxy Error]', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// AI 代理接口 (DashScope)
app.post('/api/ai', async (req, res) => {
    const { messages, model = 'qwen-vl-max', response_format } = req.body;
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.VITE_DASHSCOPE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: { message: 'Server API Key missing' } });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000); // 90秒超时

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                ...(response_format ? { response_format } : {})
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);
        const data = await response.json();
        if (!response.ok) {
            return res.status(response.status).json(data);
        }
        res.json(data);
    } catch (error) {
        console.error('[AI Proxy Error]', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// SPA 路由回退
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

// 阿里云 FC / 本地环境：监听端口
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
    console.log(`[FabricVerify] Server running on port ${PORT}`);
    console.log(`[FabricVerify] Platform: Alibaba Cloud FC`);
});
