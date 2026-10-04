// serve a static export under a sub-path to mimic GitHub Pages project sites. usage: node scripts/serve-sub.mjs <dir> <prefix> <port>
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const [dir = '.next-export', prefix = '/sito-hood', port = '3100'] = process.argv.slice(2)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.avif': 'image/avif', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.png': 'image/png' }
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!p.startsWith(prefix)) { res.writeHead(404); return res.end('outside prefix') }
  p = p.slice(prefix.length) || '/'
  let f = path.join(dir, p)
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html')
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf') }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(Number(port), () => console.log('serving', dir, 'at', prefix, port))
