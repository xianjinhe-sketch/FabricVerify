const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 9000;

// 静态文件托管
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由回退，确保直接访问某个路由时返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
