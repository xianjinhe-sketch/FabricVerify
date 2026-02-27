import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 9000;

// 静态文件托管
app.use(express.static(join(__dirname, 'dist')));

// SPA 路由回退，确保直接访问某个路由时返回 index.html
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
