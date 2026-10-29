#!/usr/bin/env python3
"""Loopback-only local admin API for Zhuohui Floral static site."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote
from email.parser import BytesParser
from email.policy import default
from datetime import datetime
import json, mimetypes, os, re, shutil, socket, webbrowser, zipfile, io, time

BASE = Path(__file__).resolve().parent.parent
SITE = (BASE / 'zhuohui-floral-site').resolve()
TOOLS = (BASE / 'admin-tools').resolve()
DATA = SITE / 'data'
UPLOADS = SITE / 'assets' / 'uploads'
MAX_UPLOAD = 15 * 1024 * 1024
ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}
DATA_FILES = {'products': 'products.json', 'colors': 'colors.json', 'homepage': 'homepage.json'}

for p in (DATA, UPLOADS, TOOLS / 'backups'):
    p.mkdir(parents=True, exist_ok=True)


def safe_slug(name: str) -> str:
    stem = Path(name).stem.lower()
    stem = re.sub(r'[^a-z0-9]+', '-', stem).strip('-')[:70] or 'image'
    return stem


def read_json(name):
    path = DATA / DATA_FILES[name]
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def write_json(name, value):
    if name == 'products':
        if not isinstance(value, list): raise ValueError('products 必须是数组')
        ids = [str(x.get('id', '')).strip() for x in value]
        if any(not x for x in ids): raise ValueError('每个商品都必须有 id')
        if len(ids) != len(set(ids)): raise ValueError('商品 id 不能重复')
        for p in value:
            if not p.get('name'): raise ValueError('商品名称不能为空')
    elif name == 'colors':
        if not isinstance(value, list): raise ValueError('colors 必须是数组')
        ids = [str(x.get('id', '')).strip() for x in value]
        if any(not x for x in ids) or len(ids) != len(set(ids)): raise ValueError('颜色 id 不能为空且不能重复')
    elif name == 'homepage':
        if not isinstance(value, dict) or not isinstance(value.get('modules', []), list): raise ValueError('homepage 数据格式不正确')
    else:
        raise ValueError('未知数据类型')
    path = DATA / DATA_FILES[name]
    backup_dir = TOOLS / 'backups'
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    if path.exists():
        shutil.copy2(path, backup_dir / f'{path.stem}-{stamp}.json.bak')
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)


class Handler(SimpleHTTPRequestHandler):
    server_version = 'ZhuohuiLocalAdmin/1.0'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def log_message(self, fmt, *args):
        print('[local-admin] ' + (fmt % args))

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in ('/admin', '/admin/', '/admin.html'):
            return self.send_local_file(TOOLS / 'admin.html', 'text/html; charset=utf-8')
        if path in ('/admin.js', '/admin-tools/admin.js'):
            return self.send_local_file(TOOLS / 'admin.js', 'application/javascript; charset=utf-8')
        if path == '/api/data':
            try:
                return self.send_json({key: read_json(key) for key in DATA_FILES})
            except Exception as e: return self.send_json({'error': str(e)}, 500)
        if path == '/api/media':
            files = []
            for p in (SITE / 'assets').rglob('*'):
                if p.is_file() and p.suffix.lower() in ALLOWED_EXT:
                    rel = p.relative_to(SITE).as_posix()
                    files.append({'name': p.name, 'path': rel, 'size': p.stat().st_size,
                                  'sizeLabel': f'{p.stat().st_size/1024:.0f} KB'})
            files.sort(key=lambda x: (not x['path'].startswith('assets/uploads/'), x['name'].lower()))
            return self.send_json(files)
        if path == '/api/backup':
            mem = io.BytesIO()
            with zipfile.ZipFile(mem, 'w', zipfile.ZIP_DEFLATED) as z:
                for p in DATA.glob('*.json'):
                    z.write(p, f'data/{p.name}')
                for p in (SITE / 'assets' / 'uploads').rglob('*'):
                    if p.is_file(): z.write(p, p.relative_to(SITE).as_posix())
            body = mem.getvalue()
            self.send_response(200); self.send_header('Content-Type','application/zip')
            self.send_header('Content-Disposition','attachment; filename="zhuohui-content-backup.zip"')
            self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        if path.startswith('/api/'):
            return self.send_json({'error':'API endpoint not found'}, 404)
        return super().do_GET()

    def do_PUT(self):
        path = urlparse(self.path).path
        m = re.fullmatch(r'/api/data/(products|colors|homepage)', path)
        if not m: return self.send_json({'error':'API endpoint not found'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 8 * 1024 * 1024: return self.send_json({'error':'JSON 文件过大'}, 413)
            value = json.loads(self.rfile.read(length).decode('utf-8'))
            write_json(m.group(1), value)
            return self.send_json({'ok': True, 'type': m.group(1), 'savedAt': datetime.now().isoformat(timespec='seconds')})
        except Exception as e:
            return self.send_json({'error': str(e)}, 400)

    def do_POST(self):
        path = urlparse(self.path).path
        if path != '/api/upload': return self.send_json({'error':'API endpoint not found'}, 404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_UPLOAD + 1024 * 1024:
                return self.send_json({'error':'单张图片大小不能超过 15 MB'}, 413)
            content_type = self.headers.get('Content-Type', '')
            body = self.rfile.read(length)
            message = BytesParser(policy=default).parsebytes(
                f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + body)
            part = next((p for p in message.iter_parts() if p.get_filename()), None)
            if part is None: return self.send_json({'error':'没有接收到图片文件'}, 400)
            filename = Path(part.get_filename()).name
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXT: return self.send_json({'error':'仅支持 JPG、PNG、WebP、GIF、AVIF 图片'}, 415)
            payload = part.get_payload(decode=True) or b''
            if len(payload) > MAX_UPLOAD: return self.send_json({'error':'单张图片大小不能超过 15 MB'}, 413)
            if not payload: return self.send_json({'error':'图片文件为空'}, 400)
            stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
            dest = UPLOADS / f'{stamp}-{safe_slug(filename)}{ext}'
            counter = 2
            while dest.exists():
                dest = UPLOADS / f'{stamp}-{safe_slug(filename)}-{counter}{ext}'; counter += 1
            dest.write_bytes(payload)
            return self.send_json({'ok': True, 'path': dest.relative_to(SITE).as_posix(), 'name': dest.name, 'size': len(payload)})
        except Exception as e:
            return self.send_json({'error': str(e)}, 400)

    def send_local_file(self, path, content_type):
        if not path.exists(): return self.send_json({'error':'本地管理文件缺失'}, 404)
        body = path.read_bytes()
        self.send_response(200); self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def translate_path(self, path):
        # Prevent path traversal while preserving standard static-file serving.
        raw = unquote(urlparse(path).path).lstrip('/')
        candidate = (SITE / raw).resolve()
        try:
            candidate.relative_to(SITE)
        except ValueError:
            return str(SITE / '__not_found__')
        return str(candidate)


def main():
    host, port = '127.0.0.1', 8765
    server = ThreadingHTTPServer((host, port), Handler)
    print('\nZhuohui Floral local admin is running.')
    print(f'Website preview: http://{host}:{port}/')
    print(f'Admin panel:     http://{host}:{port}/admin')
    print('Only this computer can access the admin API. Press Ctrl+C to stop.\n')
    try: webbrowser.open(f'http://{host}:{port}/admin')
    except Exception: pass
    try: server.serve_forever()
    except KeyboardInterrupt: print('\nStopping local admin...')
    finally: server.server_close()

if __name__ == '__main__': main()
