import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: '50mb' }));

  // Gemini Proxy (Kept for backwards compatibility if needed)
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
    } catch (error: any) {
        console.error('[Gemini Proxy Error]', error);
        res.status(500).json({ error: { message: error.message } });
    }
  });

  // AI Proxy (DashScope)
  app.post('/api/ai', async (req, res) => {
    const { messages, model = 'qwen-vl-max', response_format } = req.body;
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.VITE_DASHSCOPE_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: { message: 'Server API Key missing' } });
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

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
    } catch (error: any) {
        console.error('[AI Proxy Error]', error);
        res.status(500).json({ error: { message: error.message } });
    }
  });

  // GitHub Sync Endpoint
  app.post('/api/sync-github', async (req, res) => {
    const { token, repo, branch, message } = req.body;
    if (!token || !repo || !branch) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const [owner, repoName] = repo.split('/');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Studio-Sync'
      };

      // 1. Get branch ref
      let resRef = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${branch}`, { headers });
      if (!resRef.ok) throw new Error(`Failed to get branch: ${await resRef.text()}`);
      const refData = await resRef.json();
      const commitSha = refData.object.sha;

      // 2. Get commit
      let resCommit = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${commitSha}`, { headers });
      const commitData = await resCommit.json();
      const baseTreeSha = commitData.tree.sha;

      // 3. Read files and create blobs
      const filesToSync: {fullPath: string, relPath: string}[] = [];
      const baseDir = process.cwd();
      
      function getFiles(dir: string) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          
          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch (e) {
            continue; // Skip files we can't access
          }

          if (stat.isDirectory()) {
            // Exclude system and build directories
            const isSystemDir = dir === '/' && ['bin', 'boot', 'dev', 'etc', 'home', 'lib', 'lib64', 'media', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'usr', 'var'].includes(file);
            const isIgnoredDir = ['node_modules', '.git', 'dist'].includes(file);
            
            if (!isSystemDir && !isIgnoredDir) {
              getFiles(fullPath);
            }
          } else {
            // Exclude sensitive or lock files
            const isIgnoredFile = ['.env', '.DS_Store', 'package-lock.json', 'server.cjs'].includes(file);
            if (!isIgnoredFile) {
              filesToSync.push({ fullPath, relPath });
            }
          }
        }
      }
      getFiles(baseDir);

      const tree = [];
      for (const file of filesToSync) {
        const content = fs.readFileSync(file.fullPath, { encoding: 'base64' });
        const resBlob = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ content, encoding: 'base64' })
        });
        if (!resBlob.ok) throw new Error(`Failed to create blob for ${file.relPath}: ${await resBlob.text()}`);
        const blobData = await resBlob.json();
        tree.push({
          path: file.relPath,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha
        });
      }

      // 4. Create tree (Clean sync: no base_tree to ensure repo matches local state)
      const resTree = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tree })
      });
      if (!resTree.ok) {
        const errData = await resTree.json();
        throw new Error(`GitHub Tree Error: ${errData.message || JSON.stringify(errData)}`);
      }
      const treeData = await resTree.json();

      // 5. Create commit
      const resNewCommit = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: message || 'Auto-sync from AI Studio',
          tree: treeData.sha,
          parents: [commitSha]
        })
      });
      if (!resNewCommit.ok) throw new Error('Failed to create commit');
      const newCommitData = await resNewCommit.json();

      // 6. Update ref
      const resUpdateRef = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommitData.sha })
      });
      if (!resUpdateRef.ok) throw new Error('Failed to update ref');

      res.json({ success: true, commitUrl: newCommitData.html_url });
    } catch (error: any) {
      console.error('GitHub Sync Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.send('Production build not found. Please run npm run build.');
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
