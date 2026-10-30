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
ASSETS = SITE / 'assets'
MAX_UPLOAD = 15 * 1024 * 1024
ALLOWED_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}
DATA_FILES = {'products': 'products.json', 'colors': 'colors.json', 'homepage': 'homepage.json'}
MEDIA_TRASH = TOOLS / 'backups' / 'media-trash'
MEDIA_TRASH.mkdir(parents=True, exist_ok=True)


def media_reference_index():
    """Map each site-relative asset path to human-readable JSON references."""
    index = {}
    def walk(value, label, trail=''):
        if isinstance(value, dict):
            for key, child in value.items():
                walk(child, label, f'{trail}.{key}' if trail else key)
        elif isinstance(value, list):
            for i, child in enumerate(value):
                walk(child, label, f'{trail}[{i}]')
        elif isinstance(value, str) and value.startswith('assets/'):
            index.setdefault(value, []).append(f'{label} · {trail}')
    for key in DATA_FILES:
        try:
            walk(read_json(key), {'products':'商品','colors':'颜色主题','homepage':'首页配置'}[key])
        except Exception:
            pass
    return index


# ---- Optional Pillow: enables crop / resize / recompress. Falls back gracefully. ----
try:
    from PIL import Image, ImageOps, features as _pil_features
    PIL_OK = True
    PILLOW_VERSION = getattr(Image, '__version__', 'unknown')
    WEBP_OK = _pil_features.check('webp')
except Exception:  # pragma: no cover - Pillow is optional
    Image = None
    PIL_OK = False
    PILLOW_VERSION = None
    WEBP_OK = False

# Output format -> (Pillow format, file extension, default quality)
OUTPUT_FORMATS = {
    'webp': ('WEBP', '.webp', 82),
    'jpg':  ('JPEG', '.jpg',  85),
    'png':  ('PNG',  '.png',  95),
}

# Per-purpose downscale presets (max width, quality). Mirrors the admin UI rules.
PURPOSE_PRESETS = {
    'banner':  {'maxW': 1600, 'quality': 82},
    'product': {'maxW': 1200, 'quality': 82},
    'color':   {'maxW': 900,  'quality': 82},
    'area':    {'maxW': 1200, 'quality': 82},
    'detail':  {'maxW': 1600, 'quality': 82},
    'gallery': {'maxW': 1200, 'quality': 82},
}

for p in (DATA, UPLOADS, TOOLS / 'backups'):
    p.mkdir(parents=True, exist_ok=True)


def safe_slug(name: str) -> str:
    stem = Path(name).stem.lower()
    stem = re.sub(r'[^a-z0-9]+', '-', stem).strip('-')[:70] or 'image'
    return stem


def image_info(path: Path):
    """Return width/height/format/size for an image file, or None."""
    if not PIL_OK or not path.exists():
        return None
    try:
        with Image.open(path) as im:
            return {
                'width': im.width, 'height': im.height,
                'format': im.format,
                'size': path.stat().st_size,
                'sizeLabel': f'{path.stat().st_size / 1024:.0f} KB',
            }
    except Exception:
        return None


def _encode_image(im, fmt: str, quality: int) -> bytes:
    """Encode a PIL image to bytes for the requested output format."""
    pil_fmt, _ext, _q = OUTPUT_FORMATS.get(fmt, OUTPUT_FORMATS['webp'])
    buf = io.BytesIO()

    if pil_fmt == 'PNG':
        # PNG is lossless; quality param maps to compress_level
        level = max(0, min(9, int(round((100 - quality) / 100 * 9))))
        out = im
        if out.mode not in ('RGB', 'RGBA', 'L', 'LA'):
            out = out.convert('RGBA')
        out.save(buf, 'PNG', optimize=True, compress_level=level)
    elif pil_fmt == 'JPEG':
        out = im
        if out.mode in ('RGBA', 'LA', 'P'):
            # flatten transparency onto white
            rgba = out.convert('RGBA')
            bg = Image.new('RGB', rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            out = bg
        elif out.mode != 'RGB':
            out = out.convert('RGB')
        out.save(buf, 'JPEG', quality=max(1, min(100, quality)), optimize=True,
                 progressive=True, subsampling=0 if quality >= 90 else 2)
    else:  # WEBP
        out = im
        if out.mode == 'P':
            out = out.convert('RGBA')
        out.save(buf, 'WEBP', quality=max(1, min(100, quality)), method=6)
    return buf.getvalue()


def _parse_hex_color(value, default=(255, 255, 255)):
    """'#ffffff' / '#fff' / '255,255,255' -> (r, g, b)."""
    if not value:
        return default
    v = str(value).strip()
    try:
        if ',' in v:
            parts = [int(x) for x in v.split(',')[:3]]
            if len(parts) == 3 and all(0 <= x <= 255 for x in parts):
                return tuple(parts)
            return default
        v = v.lstrip('#')
        if len(v) == 3:
            v = ''.join(c * 2 for c in v)
        if len(v) == 6:
            return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        pass
    return default


def _fit_to_ratio(im, target_ratio, mode='crop', pad_color=None, pad_mode='solid'):
    """Force the image into `target_ratio` (w/h) using one of three strategies.

    crop     : trim the overflow so the whole frame is filled (no distortion)
    pad      : keep everything, letterbox with solid colour or transparency
    stretch  : squash/stretch to the exact ratio (distorts content)
    """
    if not target_ratio or target_ratio <= 0:
        return im
    w, h = im.size
    cur = w / h
    if abs(cur - target_ratio) < 0.005:
        return im

    if mode == 'stretch':
        # exact target ratio, content distorted
        if cur > target_ratio:
            nw = max(1, int(round(h * target_ratio)))
            return im.resize((nw, h), Image.LANCZOS)
        nh = max(1, int(round(w / target_ratio)))
        return im.resize((w, nh), Image.LANCZOS)

    if mode == 'pad':
        if cur > target_ratio:
            nh = max(1, int(round(w / target_ratio)))
            canvas_size = (w, nh)
        else:
            nw = max(1, int(round(h * target_ratio)))
            canvas_size = (nw, h)

        transparent = (pad_mode == 'transparent')
        if transparent:
            canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
            src = im.convert('RGBA')
        else:
            rgb = pad_color or (255, 255, 255)
            canvas = Image.new('RGB', canvas_size, rgb)
            src = im.convert('RGB') if im.mode not in ('RGB', 'L') else im.convert('RGB')

        ox = (canvas_size[0] - w) // 2
        oy = (canvas_size[1] - h) // 2
        if transparent and src.mode == 'RGBA':
            canvas.paste(src, (ox, oy), src)
        else:
            canvas.paste(src, (ox, oy))
        return canvas

    # default: crop (centre)
    if cur > target_ratio:
        nw = max(1, int(round(h * target_ratio)))
        left = (w - nw) // 2
        return im.crop((left, 0, left + nw, h))
    nh = max(1, int(round(w / target_ratio)))
    top = (h - nh) // 2
    return im.crop((0, top, w, top + nh))


def process_image(payload: bytes, *, crop=None, max_w=None, quality=None,
                  fmt='webp', target_kb=None, max_kb=None,
                  fit_ratio=None, fit_mode='crop', pad_color=None, pad_mode='solid'):
    """Crop, fit, downscale and re-encode an uploaded image.

    crop     : dict with left/top/width/height in *source pixel* coordinates
    fit_ratio: force output to this width/height ratio (e.g. 1.0 for square)
    fit_mode : 'crop' (trim), 'pad' (letterbox) or 'stretch' (distort)
    pad_color: '#rrggbb' solid colour used when fit_mode='pad'
    pad_mode : 'solid' or 'transparent' when fit_mode='pad'
    max_w    : max output width in px (aspect preserved, never upscales)
    quality  : 1-100 encoder quality
    fmt      : 'webp' | 'jpg' | 'png'
    target_kb: try progressively lower quality until under this size
    max_kb   : hard cap, same mechanism
    Returns (bytes, info-dict).
    """
    if not PIL_OK:
        raise RuntimeError('未安装 Pillow，无法处理图片。请运行 pip install Pillow')

    im = Image.open(io.BytesIO(payload))
    im = ImageOps.exif_transpose(im)  # respect phone/DSLR orientation
    src_w, src_h = im.size

    # ---- 1. crop ----
    if crop:
        try:
            l = int(round(float(crop['left'])))
            t = int(round(float(crop['top'])))
            w = int(round(float(crop['width'])))
            h = int(round(float(crop['height'])))
        except Exception:
            raise ValueError('裁剪参数格式不正确')
        if w < 8 or h < 8:
            raise ValueError('裁剪区域太小（至少 8×8 像素）')
        # clamp inside the source image
        l = max(0, min(l, src_w - 1))
        t = max(0, min(t, src_h - 1))
        w = max(1, min(w, src_w - l))
        h = max(1, min(h, src_h - t))
        im = im.crop((l, t, l + w, t + h))

    # ---- 1b. force a target aspect ratio (crop / pad / stretch) ----
    if fit_ratio:
        try:
            fr = float(fit_ratio)
        except Exception:
            fr = None
        if fr and fr > 0:
            mode = fit_mode if fit_mode in ('crop', 'pad', 'stretch') else 'crop'
            im = _fit_to_ratio(im, fr, mode=mode,
                               pad_color=_parse_hex_color(pad_color),
                               pad_mode=pad_mode)
            # transparency only survives in webp/png
            if pad_mode == 'transparent' and fmt == 'jpg' and im.mode == 'RGBA':
                bg = Image.new('RGB', im.size, (255, 255, 255))
                bg.paste(im, mask=im.split()[-1])
                im = bg

    # ---- 2. downscale (never upscale) ----
    if max_w:
        max_w = int(max_w)
        if max_w > 0 and im.width > max_w:
            new_h = max(1, int(round(im.height * max_w / im.width)))
            im = im.resize((max_w, new_h), Image.LANCZOS)

    # ---- 3. encode, optionally shrinking quality to hit a size cap ----
    q = int(quality) if quality else OUTPUT_FORMATS.get(fmt, OUTPUT_FORMATS['webp'])[2]
    q = max(1, min(100, q))

    cap = target_kb or max_kb
    data = _encode_image(im, fmt, q)
    if cap and cap > 0:
        cap_bytes = int(cap) * 1024
        # first: walk quality down
        while len(data) > cap_bytes and q > 25:
            q = max(25, q - 6)
            data = _encode_image(im, fmt, q)
        # still too big and PNG (lossless) -> switch to WebP which actually compresses
        if len(data) > cap_bytes and fmt == 'png':
            q2 = q
            while len(data) > cap_bytes and q2 > 30:
                data = _encode_image(im, 'webp', q2)
                q2 -= 6
            fmt = 'webp'
        # last resort: scale the image down until it fits
        scale = 1.0
        while len(data) > cap_bytes and im.width > 240 and scale > 0.3:
            scale -= 0.12
            small = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
            data = _encode_image(small, fmt, q)
            if len(data) <= cap_bytes:
                im = small

    return data, {
        'width': im.width, 'height': im.height,
        'format': fmt, 'quality': q,
        'size': len(data), 'sizeLabel': f'{len(data) / 1024:.0f} KB',
        'sourceWidth': src_w, 'sourceHeight': src_h,
        'sourceSize': len(payload),
        'savedPercent': round(100 - (len(data) / max(1, len(payload)) * 100), 1),
    }


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
        if path == '/api/media/latest-archive':
            batches = [d for d in MEDIA_TRASH.iterdir() if d.is_dir() and (d / 'manifest.json').is_file()]
            batches.sort(key=lambda d: d.stat().st_mtime, reverse=True)
            return self.send_json({'batch': batches[0].name if batches else None})
        if path == '/api/media':
            files = []
            refs = media_reference_index()
            for p in (SITE / 'assets').rglob('*'):
                if p.is_file() and p.suffix.lower() in ALLOWED_EXT:
                    rel = p.relative_to(SITE).as_posix()
                    usages = refs.get(rel, [])
                    entry = {'name': p.name, 'path': rel, 'size': p.stat().st_size,
                             'sizeLabel': f'{p.stat().st_size/1024:.0f} KB',
                             'references': usages, 'referenceCount': len(usages),
                             'isUpload': rel.startswith('assets/uploads/')}
                    meta = image_info(p)
                    if meta:
                        entry.update({'width': meta['width'], 'height': meta['height']})
                    files.append(entry)
            files.sort(key=lambda x: (not x['isUpload'], x['name'].lower()))
            return self.send_json(files)
        if path == '/api/image/raw':
            # stream an existing asset back to the browser so it can be re-cropped
            qs = parsed.query or ''
            rel = unquote(qs.split('path=', 1)[1]) if 'path=' in qs else ''
            target = (SITE / rel).resolve()
            try:
                target.relative_to(SITE)
            except ValueError:
                return self.send_json({'error': '非法路径'}, 400)
            if not target.is_file() or target.suffix.lower() not in ALLOWED_EXT:
                return self.send_json({'error': '文件不存在'}, 404)
            body = target.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == '/api/capabilities':
            # lets the UI know whether server-side crop/compress is available
            return self.send_json({
                'pillow': PIL_OK,
                'pillowVersion': PILLOW_VERSION,
                'webp': WEBP_OK,
                'formats': list(OUTPUT_FORMATS.keys()),
                'purposes': PURPOSE_PRESETS,
            })
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

    def _read_multipart(self, allow_large=False):
        """Read one multipart upload; returns (filename, payload)."""
        cap = MAX_UPLOAD + (4 * 1024 * 1024 if allow_large else 1024 * 1024)
        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0 or length > cap:
            raise ValueError('单张图片大小不能超过 15 MB')
        content_type = self.headers.get('Content-Type', '')
        body = self.rfile.read(length)
        message = BytesParser(policy=default).parsebytes(
            f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + body)
        part = next((x for x in message.iter_parts() if x.get_filename()), None)
        if part is None:
            return None, None
        return Path(part.get_filename()).name, (part.get_payload(decode=True) or b'')

    def _save_upload(self, filename, payload, fmt_hint=None):
        """Write bytes into assets/uploads with a timestamped, collision-free name."""
        ext = Path(filename).suffix.lower()
        if fmt_hint in OUTPUT_FORMATS:
            ext = OUTPUT_FORMATS[fmt_hint][1]
        if ext not in ALLOWED_EXT:
            ext = '.webp'
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        dest = UPLOADS / f'{stamp}-{safe_slug(filename)}{ext}'
        counter = 2
        while dest.exists():
            dest = UPLOADS / f'{stamp}-{safe_slug(filename)}-{counter}{ext}'
            counter += 1
        dest.write_bytes(payload)
        return dest

    def _handle_image_process(self):
        """POST /api/image/process  (multipart: file + options field)."""
        if not PIL_OK:
            return self.send_json({
                'error': '未安装 Pillow，无法处理图片。请在项目目录运行: pip install Pillow',
                'pillow': False,
            }, 503)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            cap = MAX_UPLOAD + 4 * 1024 * 1024
            if length <= 0 or length > cap:
                return self.send_json({'error': '单张图片大小不能超过 15 MB'}, 413)
            content_type = self.headers.get('Content-Type', '')
            body = self.rfile.read(length)
            message = BytesParser(policy=default).parsebytes(
                f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode() + body)

            def _part_name(part):
                try:
                    return part.get_param('name', header='content-disposition')
                except Exception:
                    return None

            parts = list(message.iter_parts())
            file_part = next((x for x in parts
                              if x.get_filename() and _part_name(x) in ('file', None)), None)
            if file_part is None:
                file_part = next((x for x in parts if x.get_filename()), None)
            if file_part is None:
                return self.send_json({'error': '没有接收到图片文件'}, 400)

            filename = Path(file_part.get_filename()).name
            ext = Path(filename).suffix.lower()
            if ext not in ALLOWED_EXT:
                return self.send_json({'error': '仅支持 JPG、PNG、WebP、GIF、AVIF 图片'}, 415)
            payload = file_part.get_payload(decode=True) or b''
            if not payload:
                return self.send_json({'error': '图片文件为空'}, 400)

            opts = {}
            opts_part = next((x for x in parts if _part_name(x) == 'options'), None)
            if opts_part is not None:
                raw = opts_part.get_payload(decode=True) or b'{}'
                try:
                    opts = json.loads(raw.decode('utf-8') or '{}')
                except Exception:
                    opts = {}

            fmt = str(opts.get('format') or 'webp').lower()
            if fmt not in OUTPUT_FORMATS:
                fmt = 'webp'

            purpose = opts.get('purpose')
            max_w = opts.get('maxWidth')
            quality = opts.get('quality')
            if purpose in PURPOSE_PRESETS:
                preset = PURPOSE_PRESETS[purpose]
                if max_w in (None, '', 0):
                    max_w = preset['maxW']
                if quality in (None, '', 0):
                    quality = preset['quality']

            target_kb = opts.get('targetKb') or opts.get('maxKb')

            data, info = process_image(
                payload,
                crop=opts.get('crop') or None,
                max_w=max_w or None,
                quality=quality or None,
                fmt=fmt,
                target_kb=target_kb or None,
                fit_ratio=opts.get('fitRatio') or None,
                fit_mode=opts.get('fitMode') or 'crop',
                pad_color=opts.get('padColor') or None,
                pad_mode=opts.get('padMode') or 'solid',
            )

            if opts.get('save', True):
                dest = self._save_upload(filename, data, fmt_hint=fmt)
                rel = dest.relative_to(SITE).as_posix()
                info.update({'ok': True, 'path': rel, 'name': dest.name})
                return self.send_json(info)

            # preview mode: return bytes inline as data URL, do not write to disk
            import base64 as _b64
            mime = {'webp': 'image/webp', 'jpg': 'image/jpeg', 'png': 'image/png'}[fmt]
            info.update({'ok': True, 'dataUrl': f'data:{mime};base64,' + _b64.b64encode(data).decode('ascii')})
            return self.send_json(info)
        except Exception as e:
            return self.send_json({'error': str(e)}, 400)

    def _handle_batch_optimize(self):
        """POST /api/images/optimize-batch  (JSON body) - recompress existing assets in place."""
        if not PIL_OK:
            return self.send_json({'error': '未安装 Pillow，无法优化图片'}, 503)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = json.loads(self.rfile.read(length).decode('utf-8') or '{}') if length else {}
        except Exception:
            body = {}

        dry_run = bool(body.get('dryRun'))
        max_w = int(body.get('maxWidth') or 1600)
        quality = int(body.get('quality') or 80)
        min_kb = float(body.get('minKb') or 0)      # skip files already smaller than this
        backup = body.get('backup', True)

        results, total_before, total_after = [], 0, 0
        backup_dir = TOOLS / 'backups' / 'images'
        if backup and not dry_run:
            backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')

        targets = [p for p in ASSETS.rglob('*')
                   if p.is_file() and p.suffix.lower() in ALLOWED_EXT]

        for p in targets:
            try:
                before = p.stat().st_size
                total_before += before
                if before / 1024 < min_kb:
                    total_after += before
                    results.append({'path': p.relative_to(SITE).as_posix(), 'action': 'skipped-small',
                                    'before': before, 'after': before})
                    continue

                raw = p.read_bytes()
                fmt = 'webp' if p.suffix.lower() == '.webp' else ('jpg' if p.suffix.lower() in ('.jpg', '.jpeg') else 'png')
                data, info = process_image(raw, max_w=max_w, quality=quality, fmt=fmt)

                if len(data) >= before:
                    total_after += before
                    results.append({'path': p.relative_to(SITE).as_posix(), 'action': 'kept-original',
                                    'before': before, 'after': before})
                    continue

                total_after += len(data)
                if not dry_run:
                    if backup:
                        bak = backup_dir / f'{p.stem}.{stamp}{p.suffix}.bak'
                        shutil.copy2(p, bak)
                    p.write_bytes(data)
                results.append({
                    'path': p.relative_to(SITE).as_posix(),
                    'action': 'optimized',
                    'before': before, 'after': len(data),
                    'beforeLabel': f'{before/1024:.0f} KB',
                    'afterLabel': f'{len(data)/1024:.0f} KB',
                    'savedPercent': info['savedPercent'],
                })
            except Exception as e:
                results.append({'path': p.name, 'action': 'error', 'error': str(e)})

        return self.send_json({
            'ok': True, 'dryRun': dry_run,
            'count': len(results),
            'optimized': sum(1 for r in results if r['action'] == 'optimized'),
            'totalBefore': total_before, 'totalAfter': total_after,
            'totalBeforeLabel': f'{total_before/1024/1024:.2f} MB',
            'totalAfterLabel': f'{total_after/1024/1024:.2f} MB',
            'savedPercent': round(100 - total_after / max(1, total_before) * 100, 1),
            'results': results,
        })

    def do_POST(self):
        path = urlparse(self.path).path

        if path in ('/api/media/archive', '/api/media/restore'):
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length <= 0 or length > 1024 * 1024:
                    return self.send_json({'error': '请求内容无效'}, 400)
                payload = json.loads(self.rfile.read(length).decode('utf-8'))
                if path.endswith('/archive'):
                    requested = payload.get('paths') or []
                    refs = media_reference_index()
                    archived, blocked, errors = [], [], []
                    stamp = datetime.now().strftime('%Y%m%d-%H%M%S-%f')
                    batch = MEDIA_TRASH / stamp
                    for rel in requested:
                        if not isinstance(rel, str) or not rel.startswith('assets/uploads/'):
                            blocked.append({'path': str(rel), 'reason': '只允许归档 uploads 目录中的图片'})
                            continue
                        src = (SITE / rel).resolve()
                        try: src.relative_to(UPLOADS.resolve())
                        except ValueError:
                            blocked.append({'path': rel, 'reason': '非法路径'}); continue
                        if not src.is_file() or src.suffix.lower() not in ALLOWED_EXT:
                            errors.append({'path': rel, 'reason': '文件不存在或格式不支持'}); continue
                        used = refs.get(rel, [])
                        if used:
                            blocked.append({'path': rel, 'reason': '仍被引用：' + '；'.join(used[:4])})
                            continue
                        batch.mkdir(parents=True, exist_ok=True)
                        dest = batch / src.name
                        shutil.move(str(src), str(dest))
                        archived.append({'path': rel, 'trashName': src.name})
                    if archived:
                        (batch / 'manifest.json').write_text(json.dumps(archived, ensure_ascii=False, indent=2), encoding='utf-8')
                    return self.send_json({'ok': True, 'batch': stamp if archived else None, 'archived': archived, 'blocked': blocked, 'errors': errors})
                batch_id = str(payload.get('batch') or '')
                if not re.fullmatch(r'\d{8}-\d{6}-\d{6}', batch_id):
                    return self.send_json({'error': '归档批次无效'}, 400)
                batch = (MEDIA_TRASH / batch_id).resolve()
                try: batch.relative_to(MEDIA_TRASH.resolve())
                except ValueError: return self.send_json({'error': '非法批次'}, 400)
                manifest = batch / 'manifest.json'
                if not manifest.is_file(): return self.send_json({'error': '找不到可恢复的归档记录'}, 404)
                entries = json.loads(manifest.read_text(encoding='utf-8'))
                restored, conflicts, remaining = [], [], []
                for item in entries:
                    rel = item['path']
                    target = (SITE / rel).resolve()
                    try: target.relative_to(UPLOADS.resolve())
                    except ValueError:
                        conflicts.append(rel); remaining.append(item); continue
                    source = batch / item['trashName']
                    if target.exists() or not source.is_file():
                        conflicts.append(rel); remaining.append(item); continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(source), str(target)); restored.append(rel)
                if remaining:
                    manifest.write_text(json.dumps(remaining, ensure_ascii=False, indent=2), encoding='utf-8')
                else:
                    try: manifest.unlink()
                    except OSError: pass
                    try: batch.rmdir()
                    except OSError: pass
                return self.send_json({'ok': True, 'restored': restored, 'conflicts': conflicts})
            except Exception as e:
                return self.send_json({'error': str(e)}, 400)

        if path == '/api/image/process':
            return self._handle_image_process()

        if path == '/api/images/optimize-batch':
            return self._handle_batch_optimize()

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
                return self.send_json({'error': '\u975e\u6cd5\u8def\u5f84'}, 400)
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
