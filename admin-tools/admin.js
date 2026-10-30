const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const state = { products: [], colors: [], homepage: {modules:[]}, media: [], page:'dashboard', editor:{type:null,id:null}, dirty:false };
const categoryNames = {'flower-walls':'Flower Walls','flower-arches':'Flower Arches','centerpieces':'Tabletop & Centerpiece','wreaths':'Wreaths','plants':'Artificial Plants','event-supplies':'Event Supplies','giant-flowers':'Giant Flowers'};
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg,ms=2600){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),ms)}
async function api(url,opts={}){const r=await fetch(url,opts);if(!r.ok){let msg=`请求失败 ${r.status}`;try{msg=(await r.json()).error||msg}catch{}throw new Error(msg)}return r.headers.get('content-type')?.includes('application/json')?r.json():r.blob()}
async function loadAll(){const d=await api('/api/data');state.products=d.products||[];state.colors=d.colors||[];state.homepage=d.homepage||{modules:[]};renderAll();state.dirty=false;$('#connection-status').textContent='本地服务已连接';}
function markDirty(){state.dirty=true;$('#connection-status').textContent='有未保存更改';$('#connection-status').style.color='#a36a2d'}
async function saveData(type){const value=state[type];await api('/api/data/'+type,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value,null,2)});state.dirty=false;$('#connection-status').textContent='已保存到本地';$('#connection-status').style.color='';toast('已保存到项目文件夹');}
function setPage(name){state.page=name;$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));$$('#main-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));$('#current-page').textContent=({dashboard:'仪表盘',products:'商品管理',media:'图片素材',colors:'颜色分类',homepage:'首页装修',publish:'Git 发布与备份'})[name]||name;if(name==='media')loadMedia();}
function renderAll(){renderStats();renderRecent();renderProducts();renderColors();renderHomepage();}
function renderStats(){$('#stat-products').textContent=state.products.length;$('#stat-active').textContent=state.products.filter(p=>p.status!=='hidden').length;$('#stat-colors').textContent=state.colors.length;$('#stat-modules').textContent=(state.homepage.modules||[]).length;}
function productRow(p){const colorNames=(p.colors||[]).map(id=>state.colors.find(c=>c.id===id)?.name||id).join(', ');return `<tr><td><div class="product-cell"><img class="thumb" src="/${esc(p.image||'') }" onerror="this.style.opacity='.25'" alt=""><div><div class="product-name">${esc(p.name)}</div><div class="muted">${esc(p.id)}</div></div></div></td><td>${esc(categoryNames[p.category]||p.category||'未分类')}</td><td>${esc(colorNames||'未设置')}</td><td>${p.featured?'<span class="pill">首页推荐</span>':'<span class="muted">普通</span>'}</td><td>${p.status==='hidden'?'<span class="pill off">隐藏</span>':'<span class="pill">上架</span>'}</td><td><div class="row-actions"><button class="small-btn" data-edit-product="${esc(p.id)}">编辑</button><button class="small-btn" data-duplicate-product="${esc(p.id)}">复制</button></div></td></tr>`}
function renderProducts(){const q=($('#product-search')?.value||'').toLowerCase(),cat=$('#product-category-filter')?.value||'all',status=$('#product-status-filter')?.value||'all';const list=state.products.filter(p=>(cat==='all'||p.category===cat)&&(status==='all'||(status==='active'?p.status!=='hidden':p.status==='hidden'))&&[p.name,p.description,p.id,...(p.colors||[])].join(' ').toLowerCase().includes(q)).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));$('#products-table').innerHTML=list.length?`<table><thead><tr><th>商品</th><th>分类</th><th>颜色</th><th>首页</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.map(productRow).join('')}</tbody></table>`:`<div class="empty">没有找到商品。可以新增商品或调整筛选条件。</div>`;}
function renderRecent(){$('#recent-products').innerHTML=`<div class="table-wrap"><table><thead><tr><th>商品</th><th>分类</th><th>状态</th><th></th></tr></thead><tbody>${[...state.products].sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999)).slice(0,5).map(p=>`<tr><td><div class="product-cell"><img class="thumb" src="/${esc(p.image||'')}" alt=""><div><div class="product-name">${esc(p.name)}</div><div class="muted">${esc(p.id)}</div></div></div></td><td>${esc(categoryNames[p.category]||p.category)}</td><td>${p.status==='hidden'?'隐藏':'上架'}</td><td><button class="small-btn" data-edit-product="${esc(p.id)}">编辑</button></td></tr>`).join('')}</tbody></table></div>`;}
function openProduct(id=null,clone=false){let p=id?structuredClone(state.products.find(x=>x.id===id)):null;if(clone&&p){p.id='';p.name+=' Copy'}state.editor={type:'product',id:id&&!clone?id:null};$('#editor-title').textContent=p?'编辑商品':'新增商品';$('#delete-record').classList.toggle('hidden',!id||clone);const colorChecks=state.colors.map(c=>`<label><input type="checkbox" name="colors" value="${esc(c.id)}" ${(p?.colors||[]).includes(c.id)?'checked':''}> ${esc(c.name)}</label>`).join('');$('#editor-body').innerHTML=`<form id="record-form" class="form-grid"><label class="field">商品名称 *<input name="name" required value="${esc(p?.name||'')}"></label><label class="field">商品 ID<input name="id" value="${esc(p?.id||'')}" placeholder="保存时自动生成"></label><label class="field">商品分类<select name="category">${Object.entries(categoryNames).map(([v,n])=>`<option value="${v}" ${(p?.category||'flower-walls')===v?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">状态<select name="status"><option value="active" ${(p?.status||'active')==='active'?'selected':''}>上架</option><option value="hidden" ${p?.status==='hidden'?'selected':''}>隐藏</option></select></label><label class="field full">商品描述<textarea name="description">${esc(p?.description||'')}</textarea></label><label class="field full">主图相对路径<div class="input-row"><input name="image" id="product-image-path" value="${esc(p?.image||'')}" placeholder="assets/uploads/your-image.webp"><button type="button" class="btn" id="choose-product-image">上传图片</button></div><span class="help">支持 JPG、PNG、WebP；上传后自动填入相对路径。</span></label><div class="field full"><span>关联颜色</span><div class="check-row">${colorChecks||'<span class="muted">请先在颜色分类中添加颜色</span>'}</div></div><label class="field">对外价格（可选）<input name="price" value="${esc(p?.price||'')}" placeholder="如 $199.00；留空显示询盘"></label><label class="field">原价（可选）<input name="compareAt" value="${esc(p?.compareAt||'')}"></label><label class="field">排序权重<input name="sortOrder" type="number" value="${esc(p?.sortOrder??state.products.length+1)}"></label><label class="field">详情页链接<input name="detailPage" value="${esc(p?.detailPage||'product-detail.html')}"></label><div class="field full"><div class="check-row"><label><input type="checkbox" name="featured" ${p?.featured?'checked':''}> 首页推荐</label><label><input type="checkbox" name="tags" value="new" ${(p?.tags||[]).includes('new')?'checked':''}> 新品标签</label></div></div></form>`;$('#editor-modal').classList.add('open');$('#record-form').addEventListener('submit',e=>e.preventDefault());$('#choose-product-image').addEventListener('click',()=>uploadSingle('product').then(path=>{if(path)$('#product-image-path').value=path}));}
function saveProduct(){const f=$('#record-form');if(!f.reportValidity())return;const fd=new FormData(f);const name=fd.get('name').trim();let id=(fd.get('id')||'').trim()||slug(name);id=slug(id);const colors=fd.getAll('colors');const existing=state.products.find(p=>p.id===state.editor.id);if(state.products.some(p=>p.id===id&&p.id!==state.editor.id)){toast('商品 ID 已存在，请修改');return}const p={...(existing||{}),id,name,description:fd.get('description').trim(),category:fd.get('category'),status:fd.get('status'),image:fd.get('image').trim(),colors,price:fd.get('price').trim(),compareAt:fd.get('compareAt').trim(),sortOrder:Number(fd.get('sortOrder')||state.products.length+1),detailPage:fd.get('detailPage').trim()||'product-detail.html',featured:fd.get('featured')==='on',tags:fd.get('tags')?['new']:[]};if(existing)Object.assign(existing,p);else state.products.push(p);markDirty();$('#editor-modal').classList.remove('open');renderAll();saveData('products').catch(e=>toast('保存失败：'+e.message,4000));}
function slug(s){return String(s||'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'item'}
function openColor(id=null){const c=id?structuredClone(state.colors.find(x=>x.id===id)):null;state.editor={type:'color',id:id};$('#editor-title').textContent=c?'编辑颜色主题':'新增颜色主题';$('#delete-record').classList.toggle('hidden',!id);$('#editor-body').innerHTML=`<form id="record-form" class="form-grid"><label class="field">颜色 ID *<input name="id" required value="${esc(c?.id||'')}" placeholder="如 sage"></label><label class="field">主题名称 *<input name="name" required value="${esc(c?.name||'')}"></label><label class="field">季节 / 标签<input name="season" value="${esc(c?.season||'')}"></label><label class="field">排序权重<input name="sortOrder" type="number" value="${esc(c?.sortOrder??state.colors.length+1)}"></label><label class="field full">主题说明<textarea name="description">${esc(c?.description||'')}</textarea></label><label class="field">Banner 主图相对路径<div class="input-row"><input name="heroImage" id="color-hero-path" value="${esc(c?.heroImage||'')}"><button type="button" class="btn" id="choose-color-hero">上传</button></div></label><label class="field">首页颜色卡图片<div class="input-row"><input name="cardImage" id="color-card-path" value="${esc(c?.cardImage||'')}"><button type="button" class="btn" id="choose-color-card">上传</button></div></label><label class="field full">色卡颜色（逗号分隔 HEX）<input name="swatches" value="${esc((c?.swatches||[]).join(', '))}" placeholder="#f0ede6, #e8ded0, #d4c5b1"></label><label class="field full">短标语<input name="tagline" value="${esc(c?.tagline||'')}"></label><div class="field full"><label><input type="checkbox" name="active" ${c?.active!==false?'checked':''}> 启用该颜色主题</label></div></form>`;$('#editor-modal').classList.add('open');$('#record-form').addEventListener('submit',e=>e.preventDefault());$('#choose-color-hero').addEventListener('click',()=>uploadSingle('banner').then(path=>{if(path)$('#color-hero-path').value=path}));$('#choose-color-card').addEventListener('click',()=>uploadSingle('color').then(path=>{if(path)$('#color-card-path').value=path}));}
function saveColor(){const f=$('#record-form');if(!f.reportValidity())return;const fd=new FormData(f);const id=slug(fd.get('id'));const existing=state.colors.find(c=>c.id===state.editor.id);if(state.colors.some(c=>c.id===id&&c.id!==state.editor.id)){toast('颜色 ID 已存在');return}const oldId=state.editor.id;const c={...(existing||{}),id,name:fd.get('name').trim(),season:fd.get('season').trim(),sortOrder:Number(fd.get('sortOrder')||1),description:fd.get('description').trim(),heroImage:fd.get('heroImage').trim(),cardImage:fd.get('cardImage').trim(),swatches:fd.get('swatches').split(',').map(x=>x.trim()).filter(Boolean),tagline:fd.get('tagline').trim(),active:fd.get('active')==='on'};if(existing)Object.assign(existing,c);else state.colors.push(c);if(oldId&&oldId!==id)state.products.forEach(p=>p.colors=(p.colors||[]).map(x=>x===oldId?id:x));markDirty();$('#editor-modal').classList.remove('open');renderAll();Promise.all([saveData('colors'),...(oldId&&oldId!==id?[saveData('products')]:[])]).catch(e=>toast('保存失败：'+e.message,4000));}
function renderColors(){const list=[...state.colors].sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));$('#colors-grid').innerHTML=list.map(c=>`<article class="color-item"><div class="color-preview"><img src="/${esc(c.cardImage||c.heroImage||'')}" alt="" onerror="this.style.opacity='.2'"></div><div class="color-title">${esc(c.name)}</div><div class="muted">ID: ${esc(c.id)} · ${c.active===false?'已停用':'启用中'}</div><div class="swatches">${(c.swatches||[]).map(s=>`<i style="background:${esc(s)}"></i>`).join('')}</div><p>${esc(c.description||c.tagline||'暂无说明')}</p><div class="actions"><button class="btn" data-edit-color="${esc(c.id)}">编辑</button><button class="btn" data-delete-color="${esc(c.id)}">删除</button></div></article>`).join('')||'<div class="empty">还没有颜色主题</div>';}
function renderHomepage(){const h=state.homepage||{};$('#home-site-name').value=h.siteName||'Zhuohui';$('#home-announcement').value=h.announcement||'';const mods=[...(h.modules||[])].sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));$('#module-list').innerHTML=mods.map(m=>`<article class="module" data-module="${esc(m.id)}"><img src="/${esc(m.bannerImage||'')}" alt="" onerror="this.style.opacity='.2'"><div><h3>${esc(m.title||m.id)}</h3><p>${esc(m.subtitle||'无副标题')}</p><div class="module-meta"><span class="pill">顺序 ${m.sortOrder}</span><span class="muted">${esc(m.id)}</span><label class="switch"><input type="checkbox" data-module-visible="${esc(m.id)}" ${m.visible!==false?'checked':''}> 显示</label></div><div class="actions" style="margin-top:9px"><button class="small-btn" data-edit-module="${esc(m.id)}">编辑模块</button><button class="small-btn" data-move-module="${esc(m.id)}" data-dir="up">↑</button><button class="small-btn" data-move-module="${esc(m.id)}" data-dir="down">↓</button></div></div><div class="module-actions"><span class="muted">${esc(m.type||'section')}</span></div></article>`).join('');const areas=h.areas||[];$('#area-cards-editor').innerHTML=areas.map((a,i)=>`<div class="field"><strong>${esc(a.title||a.id)}</strong><label class="field">标题<input data-area-field="title" data-area-index="${i}" value="${esc(a.title||'')}"></label><label class="field">说明<input data-area-field="description" data-area-index="${i}" value="${esc(a.description||'')}"></label><label class="field">图片相对路径<input data-area-field="image" data-area-index="${i}" value="${esc(a.image||'')}"></label><label class="field">跳转页面<input data-area-field="link" data-area-index="${i}" value="${esc(a.link||'')}"></label></div>`).join('');}
function editModule(id){const m=state.homepage.modules.find(x=>x.id===id);if(!m)return;state.editor={type:'module',id};$('#editor-title').textContent='编辑首页模块';$('#delete-record').classList.add('hidden');$('#editor-body').innerHTML=`<form id="record-form" class="form-grid"><label class="field">模块 ID<input value="${esc(m.id)}" disabled></label><label class="field">显示标题<input name="title" required value="${esc(m.title||'')}"></label><label class="field full">副标题 / 说明<textarea name="subtitle">${esc(m.subtitle||'')}</textarea></label><label class="field full">Banner 图片相对路径<div class="input-row"><input name="bannerImage" id="module-image-path" value="${esc(m.bannerImage||'')}"><button type="button" class="btn" id="choose-module-image">上传图片</button></div><span class="help">仅对带 Banner 的模块生效。Shop by Area、Shop by Color 等无 Banner 模块可留空。</span></label><label class="field">排序权重<input name="sortOrder" type="number" value="${esc(m.sortOrder||1)}"></label><label class="field">关联商品分类<input value="${esc(m.productCategory||'') }" disabled></label>${m.id==='more-collections'?`<div class="field full"><strong>底部三栏标题与说明</strong></div>${(m.columns||[]).map((c,i)=>`<label class="field">第 ${i+1} 栏标题<input name="columnTitle${i}" value="${esc(c.title||'')}"></label><label class="field">第 ${i+1} 栏说明<input name="columnSubtitle${i}" value="${esc(c.subtitle||'')}"></label>`).join('')}`:''}<div class="field full"><label><input type="checkbox" name="visible" ${m.visible!==false?'checked':''}> 在首页显示</label></div></form>`;$('#editor-modal').classList.add('open');$('#record-form').addEventListener('submit',e=>e.preventDefault());$('#choose-module-image').addEventListener('click',()=>uploadSingle('banner').then(path=>{if(path)$('#module-image-path').value=path}));}
function saveModule(){const f=$('#record-form');if(!f.reportValidity())return;const fd=new FormData(f),m=state.homepage.modules.find(x=>x.id===state.editor.id);Object.assign(m,{title:fd.get('title').trim(),subtitle:fd.get('subtitle').trim(),bannerImage:fd.get('bannerImage').trim(),sortOrder:Number(fd.get('sortOrder')||1),visible:fd.get('visible')==='on'});if(m.id==='more-collections'&&Array.isArray(m.columns))m.columns=m.columns.map((c,i)=>({...c,title:(fd.get('columnTitle'+i)||'').trim(),subtitle:(fd.get('columnSubtitle'+i)||'').trim()}));markDirty();$('#editor-modal').classList.remove('open');renderHomepage();saveData('homepage').catch(e=>toast('保存失败：'+e.message,4000));}

const dimensionRules={
 banner:{title:'首页 / 区块横幅 Banner',size:'2400 × 600 px（最低建议 1600 × 400）',ratio:4,minW:1600,minH:400,range:[3.2,5.0],maxKB:1200,tip:'横向宽图。主体尽量放在中央安全区，页面会按容器比例裁切。'},
 product:{title:'商品卡片主图',size:'1200 × 1200 px',ratio:1,minW:900,minH:900,range:[0.85,1.15],maxKB:700,tip:'优先方图，商品主体完整，四周留少量空间，便于列表统一裁切。'},
 color:{title:'Shop by Color 颜色卡片',size:'900 × 1200 px',ratio:.75,minW:750,minH:1000,range:[.62,.88],maxKB:700,tip:'竖图 3:4 左右，适合色系场景、花艺搭配和色彩氛围。'},
 area:{title:'Shop by Area 场景卡片',size:'1200 × 900 px',ratio:1.333,minW:1000,minH:750,range:[1.15,1.55],maxKB:800,tip:'横图 4:3 左右，保留足够环境信息，方便展示 Welcome / Ceremony / Reception 场景。'},
 detail:{title:'商品详情主图',size:'1600 × 2000 px',ratio:.8,minW:1200,minH:1500,range:[.65,.95],maxKB:1000,tip:'竖图 4:5 左右，商品尽量清晰完整，避免水印或文字贴近边缘。'},
 gallery:{title:'商品详情图库',size:'1200 × 1200 px',ratio:1,minW:900,minH:900,range:[.65,1.5],maxKB:1000,tip:'多角度图片尽量保持相近尺寸；场景图可以横竖混合，但第一张建议与主图比例接近。'}
};
function ratioLabel(w,h){const r=w/h;return `${r.toFixed(2)}:1${Math.abs(r-1)<.05?'（近方图）':r>1.2?'（横图）':r<.85?'（竖图）':''}`}
function currentDimensionRule(){return dimensionRules[$('#dimension-use')?.value||'banner']||dimensionRules.banner}
function renderDimensionRule(){const r=currentDimensionRule();const el=$('#dimension-rule');if(el)el.innerHTML=`<strong>${r.title}</strong><br>推荐：${r.size}<br>文件大小：建议 ≤ ${r.maxKB} KB<br><span style="color:#687565">${r.tip}</span>`}
function readImageSize(file){return new Promise(resolve=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{resolve({width:img.naturalWidth,height:img.naturalHeight,url})};img.onerror=()=>resolve({width:0,height:0,url});img.src=url})}
async function inspectSelectedFiles(files){const r=currentDimensionRule(),report=$('#dimension-report');report.innerHTML='';for(const file of files){const d=await readImageSize(file);const ratio=d.height?d.width/d.height:0;let issues=[];if(!d.width||!d.height)issues.push('无法读取图片尺寸');else{if(d.width<r.minW||d.height<r.minH)issues.push(`分辨率偏低，建议至少 ${r.minW} × ${r.minH}px`);if(ratio<r.range[0]||ratio>r.range[1])issues.push(`比例不匹配，当前 ${ratioLabel(d.width,d.height)}`);if(file.size/1024>r.maxKB)issues.push(`文件较大（${(file.size/1024).toFixed(0)} KB），建议压缩`)}const status=!issues.length?'推荐':(!d.width?'无法读取':issues.length>=2?'建议调整':'可用但需留意');const cls=!issues.length?'':(!d.width||issues.length>=2?'bad':'warn');const el=document.createElement('div');el.className='dimension-result';el.innerHTML=`<img src="${d.url}" alt=""><div><div class="dim-name">${esc(file.name)}</div><div class="dim-meta">${d.width&&d.height?`${d.width} × ${d.height}px · ${ratioLabel(d.width,d.height)}`:'图片尺寸读取失败'} · ${(file.size/1024).toFixed(0)} KB<br>${issues.length?issues.map(esc).join('；'):'符合当前用途的推荐规格。'}</div></div><span class="dimension-status ${cls}">${status}</span>`;report.appendChild(el);}}
function maybeWarnForUpload(files){const r=currentDimensionRule();return inspectFilesRaw(files,r).then(results=>{const bad=results.filter(x=>x.issues.length);if(!bad.length)return true;const summary=bad.slice(0,5).map(x=>`${x.file.name}: ${x.issues.join('；')}`).join('\\n');return confirm(`有 ${bad.length} 张图片与“${r.title}”推荐规格不完全匹配：\\n\\n${summary}\\n\\n仍要继续上传吗？`);})}
async function inspectFilesRaw(files,r){const out=[];for(const file of files){const d=await readImageSize(file);const issues=[];if(!d.width||!d.height)issues.push('无法读取图片尺寸');else{const ratio=d.width/d.height;if(d.width<r.minW||d.height<r.minH)issues.push(`分辨率偏低（建议至少 ${r.minW} × ${r.minH}px）`);if(ratio<r.range[0]||ratio>r.range[1])issues.push(`比例 ${ratioLabel(d.width,d.height)} 与推荐不符`);if(file.size/1024>r.maxKB)issues.push(`文件较大：${(file.size/1024).toFixed(0)} KB`)}URL.revokeObjectURL(d.url);out.push({file,issues})}return out}

async function loadMedia() {
  try {
    state.media = await api('/api/media');
    const cnt = $('#media-count');
    if (cnt) cnt.textContent = state.media.length + ' 张图片';
    const grid = $('#media-grid');
    if (!grid) return;

    grid.innerHTML = state.media.map((m, i) => {
      return '<article class="media-item">'
        + '<img data-media-image="' + i + '" src="/' + esc(m.path) + '" alt="" loading="lazy">'
        + '<div class="media-info">'
        + '<div class="media-name">' + esc(m.name) + '</div>'
        + '<div class="media-dimensions" data-media-dimensions="' + i + '">读取中…</div>'
        + '<div class="media-flags" data-media-flags="' + i + '"></div>'
        + '<div class="media-actions">'
        + '<button class="small-btn" data-edit-image="' + esc(m.path) + '">编辑图片</button>'
        + '<button class="small-btn" data-replace-image="' + esc(m.path) + '">替换</button>'
        + '<button class="small-btn" data-copy-path="' + esc(m.path) + '">复制路径</button>'
        + '</div>'
        + '</div></article>';
    }).join('') || '<div class="empty">素材目录暂无图片。点击上传图片开始使用。</div>';

    state.media.forEach((m, i) => {
      const im = $('[data-media-image="' + i + '"]');
      const paint = () => {
        if (!im || !im.naturalWidth) return;
        paintMediaLabels(i, m, im.naturalWidth, im.naturalHeight, m.size);
      };
      if (im && im.complete) paint();
      else if (im) im.addEventListener('load', paint, { once: true });
    });
  } catch (e) {
    toast('读取素材失败：' + e.message);
  }
}

function paintMediaLabels(index, media, w, h, bytes) {
  const dimEl = $('[data-media-dimensions="' + index + '"]');
  const flagEl = $('[data-media-flags="' + index + '"]');
  const kb = Math.round((bytes || 0) / 1024);
  const ratio = w / Math.max(1, h);

  if (dimEl) {
    dimEl.innerHTML = '<span class="dim-badge">' + w + ' × ' + h + ' px</span>'
      + '<div style="margin-top:3px">' + ratio.toFixed(2) + ':1 · ' + kb + ' KB</div>';
  }

  if (!flagEl) return;

  const usedAs = inferImagePurpose(media.path);
  const rule = usedAs ? dimensionRules[usedAs] : (dimensionRules[currentPurpose()] || dimensionRules.product);
  const purposeName = (rule.title || '').replace(/（[^）]*）/g, '');
  const scope = usedAs ? ('用作' + purposeName) : '按当前用途';

  const issues = [];
  if (w < rule.minW || h < rule.minH) issues.push('尺寸偏小');
  if (ratio < rule.range[0] || ratio > rule.range[1]) issues.push('比例不符');
  if (kb > rule.maxKB) issues.push('体积偏大');

  const needsWork = [];
  if (kb > 500) needsWork.push('>500KB');
  if (w < 800 && h < 800) needsWork.push('<800px');

  const parts = [];
  const sep = ' · ';
  if (issues.length === 0) {
    parts.push('<span class="dimension-status" style="font-size:9px;padding:3px 6px" title="'
      + esc(scope) + '">符合规格</span>');
  } else {
    parts.push('<span class="dimension-status warn" style="font-size:9px;padding:3px 6px" title="'
      + esc(scope + '：' + issues.join('；')) + '">' + esc(issues.join(sep)) + '</span>');
  }
  if (needsWork.length) {
    parts.push('<span class="dimension-status bad" style="font-size:9px;padding:3px 6px" title="建议优化">待优化 '
      + esc(needsWork.join(' ')) + '</span>');
  }
  flagEl.innerHTML = parts.join(' ');
}

/** Work out what an asset is actually used for by scanning the live data. */
function inferImagePurpose(path) {
  if (!path) return null;
  const hit = function (v) { return v === path; };
  if ((state.colors || []).some(function (c) { return hit(c.heroImage); })) return 'banner';
  if ((state.colors || []).some(function (c) { return hit(c.cardImage); })) return 'color';
  if ((state.homepage && state.homepage.modules || []).some(function (m) { return hit(m.bannerImage); })) return 'banner';
  if ((state.homepage && state.homepage.areas || []).some(function (a) { return hit(a.image); })) return 'area';
  if ((state.products || []).some(function (p) { return hit(p.image); })) return 'product';
  return null;
}

function download(name,data,type='application/json'){const blob=new Blob([type==='text/csv'?data:JSON.stringify(data,null,2)],{type:type==='text/csv'?'text/csv;charset=utf-8':'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function exportCSV(){const cols=['id','name','category','description','image','colors','price','compareAt','status','featured','sortOrder'];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[cols.join(','),...state.products.map(p=>cols.map(k=>q(Array.isArray(p[k])?p[k].join('|'):p[k])).join(','))];download('zhuohui-products.csv','\ufeff'+rows.join('\r\n'),'text/csv')}
function exportAll(){download('zhuohui-content-data.json',{products:state.products,colors:state.colors,homepage:state.homepage})}
function saveCurrent(){if(state.editor.type==='product')return saveProduct();if(state.editor.type==='color')return saveColor();if(state.editor.type==='module')return saveModule();}
$('#main-nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)setPage(b.dataset.page)});$$('[data-goto]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.goto)));
$('#product-search').addEventListener('input',renderProducts);$('#product-category-filter').addEventListener('change',renderProducts);$('#product-status-filter').addEventListener('change',renderProducts);
$('#add-product').addEventListener('click',()=>openProduct());$('#quick-add').addEventListener('click',()=>openProduct());$('#add-color').addEventListener('click',()=>openColor());$('#save-record').addEventListener('click',saveCurrent);$('#cancel-edit').addEventListener('click',()=>$('#editor-modal').classList.remove('open'));$('#modal-close').addEventListener('click',()=>$('#editor-modal').classList.remove('open'));$('#editor-modal').addEventListener('click',e=>{if(e.target.id==='editor-modal')$('#editor-modal').classList.remove('open')});
$('#delete-record').addEventListener('click',()=>{const {type,id}=state.editor;if(!id)return;if(!confirm('确认删除这条记录？此操作会保存到本地数据文件。'))return;if(type==='product'){state.products=state.products.filter(p=>p.id!==id);saveData('products').then(renderAll)}else if(type==='color'){if(state.products.some(p=>(p.colors||[]).includes(id))&&!confirm('仍有商品关联该颜色，确定删除？'))return;state.colors=state.colors.filter(c=>c.id!==id);state.products.forEach(p=>p.colors=(p.colors||[]).filter(x=>x!==id));Promise.all([saveData('colors'),saveData('products')]).then(renderAll)}$('#editor-modal').classList.remove('open')});
document.addEventListener('click',e=>{const ep=e.target.closest('[data-edit-product]');if(ep){openProduct(ep.dataset.editProduct);return}const dp=e.target.closest('[data-duplicate-product]');if(dp){openProduct(dp.dataset.duplicateProduct,true);return}const ec=e.target.closest('[data-edit-color]');if(ec){openColor(ec.dataset.editColor);return}const dc=e.target.closest('[data-delete-color]');if(dc){if(!confirm('删除该颜色主题？'))return;const id=dc.dataset.deleteColor;if(state.products.some(p=>(p.colors||[]).includes(id))){toast('仍有商品关联该颜色，请先调整商品颜色');return}state.colors=state.colors.filter(c=>c.id!==id);saveData('colors').then(renderAll).catch(err=>toast(err.message));return}const em=e.target.closest('[data-edit-module]');if(em){editModule(em.dataset.editModule);return}const mm=e.target.closest('[data-move-module]');if(mm){const list=state.homepage.modules.sort((a,b)=>a.sortOrder-b.sortOrder),i=list.findIndex(m=>m.id===mm.dataset.moveModule),j=mm.dataset.dir==='up'?i-1:i+1;if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];list.forEach((m,k)=>m.sortOrder=k+1);renderHomepage();markDirty();saveData('homepage').catch(err=>toast(err.message));return}const cp=e.target.closest('[data-copy-path]');if(cp){navigator.clipboard?.writeText(cp.dataset.copyPath).then(()=>toast('已复制路径')).catch(()=>toast(cp.dataset.copyPath));return}const vis=e.target.closest('[data-module-visible]');if(vis){const m=state.homepage.modules.find(x=>x.id===vis.dataset.moduleVisible);if(m){m.visible=vis.checked;markDirty();saveData('homepage').then(()=>toast('模块显示状态已保存')).catch(err=>toast(err.message))}}});
$('#dimension-use').addEventListener('change',()=>{renderDimensionRule();const files=$('#inspect-file-input').files;if(files?.length)inspectSelectedFiles([...files])});$('#inspect-images').addEventListener('click',()=>$('#inspect-file-input').click());$('#inspect-file-input').addEventListener('change',e=>{if(e.target.files?.length)inspectSelectedFiles([...e.target.files]);});renderDimensionRule();
$('#upload-media').addEventListener('click',()=>$('#media-file-input').click());$('#media-file-input').addEventListener('change',async e=>{if(e.target.files.length){try{await uploadFiles([...e.target.files])}catch(err){toast('上传失败：'+err.message,4000)}e.target.value=''}});$('#refresh-media').addEventListener('click',loadMedia);
$('#home-site-name').addEventListener('input',()=>{state.homepage.siteName=$('#home-site-name').value;markDirty()});$('#home-announcement').addEventListener('input',()=>{state.homepage.announcement=$('#home-announcement').value;markDirty()});$('#save-home').addEventListener('click',async()=>{state.homepage.siteName=$('#home-site-name').value.trim();state.homepage.announcement=$('#home-announcement').value.trim();$$('[data-area-field]').forEach(input=>{const a=state.homepage.areas?.[Number(input.dataset.areaIndex)];if(a)a[input.dataset.areaField]=input.value.trim()});try{await saveData('homepage')}catch(e){toast(e.message,4000)}});$('#reset-home-order').addEventListener('click',()=>{state.homepage.modules.sort((a,b)=>a.sortOrder-b.sortOrder).forEach((m,i)=>m.sortOrder=i+1);renderHomepage();markDirty()});$('#save-all').addEventListener('click',async()=>{state.homepage.siteName=$('#home-site-name').value.trim()||state.homepage.siteName;state.homepage.announcement=$('#home-announcement').value.trim();$$('[data-area-field]').forEach(input=>{const a=state.homepage.areas?.[Number(input.dataset.areaIndex)];if(a)a[input.dataset.areaField]=input.value.trim()});try{await api('/api/data/products',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.products,null,2)});await api('/api/data/colors',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.colors,null,2)});await api('/api/data/homepage',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.homepage,null,2)});state.dirty=false;$('#connection-status').textContent='已保存到本地';toast('所有数据已保存')}catch(e){toast('保存失败：'+e.message,4000)}});$('#export-products').addEventListener('click',exportCSV);$('#download-data').addEventListener('click',exportAll);$('#download-backup').addEventListener('click',()=>{location.href='/api/backup'});$('#open-site').addEventListener('click',()=>window.open('/','_blank'));
loadAll().catch(e=>{console.error(e);$('#connection-status').textContent='服务连接失败';toast('无法读取本地数据，请确认通过 run-admin.bat 启动后台。'+e.message,6000)});

/* ===== Image cropper (Figma-style) & compressor ===== */
const cropper = {
  img: null, file: null, naturalW: 0, naturalH: 0,
  zoom: 1, fitZoom: 1, panX: 0, panY: 0,
  sel: { x: 0, y: 0, w: 0, h: 0 },   // in DISPLAY px (relative to the image box)
  ratio: 'free',
  drag: null, panning: false, spaceDown: false,
  caps: null, callbacks: null, sourcePath: null
};

async function loadCapabilities() {
  try {
    cropper.caps = await api('/api/capabilities');
    const el = document.getElementById('pillow-status');
    if (!el) return;
    if (cropper.caps.pillow) {
      el.textContent = 'Pillow ' + (cropper.caps.pillowVersion || '') + ' 可用';
      el.style.background = '#e9f2e7';
      el.style.color = '#426c48';
    } else {
      el.textContent = '未安装 Pillow';
      el.style.background = '#f7e7e4';
      el.style.color = '#a3453c';
    }
  } catch (e) {
    const el = document.getElementById('pillow-status');
    if (el) el.textContent = '服务未响应';
  }
}

function currentPurpose() {
  const sel = document.getElementById('dimension-use');
  return sel ? sel.value : 'product';
}

const $id = function (x) { return document.getElementById(x); };

/* ---------- open / close ---------- */

function openCropper(file, options) {
  if (!file) return;
  const opts = options || {};
  if (cropper.caps && cropper.caps.pillow === false) {
    toast('未安装 Pillow，无法裁剪压缩。请运行 pip install Pillow', 6000);
    if (opts.onCancel) opts.onCancel();
    return;
  }

  cropper.file = file;
  cropper.sourcePath = opts.sourcePath || null;
  cropper.callbacks = { onSaved: opts.onSaved || null, onCancel: opts.onCancel || null };
  cropper.forced = !!(opts.reason && opts.reason.length);

  // default to free crop; only lock a ratio when the caller explicitly asks
  selectRatioButton('free');
  const mwHint = $id('crop-maxwidth');
  if (mwHint && opts.purpose) {
    const preset2 = dimensionRules[opts.purpose];
    if (preset2 && preset2.maxW && !mwHint.value) mwHint.placeholder = '\u7559\u7a7a\u5219\u6309\u7528\u9014\u81ea\u52a8\uff08' + preset2.maxW + 'px\uff09';
  }
  const tk = $id('crop-targetkb');
  if (tk && opts.purpose) {
    const preset = dimensionRules[opts.purpose];
    if (preset && preset.maxKB && !tk.value) tk.value = preset.maxKB;
  }

  const img = $id('crop-img');
  const url = URL.createObjectURL(file);
  img.onload = function () {
    cropper.img = img;
    cropper.naturalW = img.naturalWidth;
    cropper.naturalH = img.naturalHeight;

    const nameEl = $id('cropper-filename');
    if (nameEl) {
      nameEl.textContent = file.name + ' · ' + img.naturalWidth + '\u00d7' + img.naturalHeight +
        ' px · ' + Math.round(file.size / 1024) + ' KB' + (opts.sourcePath ? ' · \u7f16\u8f91\u4e2d' : '');
    }

    const info = $id('crop-info');
    if (info && opts.reason && opts.reason.length) {
      info.innerHTML = '<span style="color:#a0642c;font-weight:600">\u4e0d\u7b26\u5408\u89c4\u683c\uff1a</span>'
        + (typeof esc === 'function' ? esc(opts.reason.join('\uff1b')) : opts.reason.join('\uff1b'));
    } else if (info) {
      info.textContent = '\u62d6\u62fd\u6846\u9009\u88c1\u526a\u533a\u57df\uff0c\u56db\u5468\u53e5\u67c4\u8c03\u6574\u5c3a\u5bf8';
    }

    $id('cropper-modal').classList.add('open');
    requestAnimationFrame(function () {
      fitToViewport();
      resetSelection();
      updateZoomLabel();
    });
  };
  img.onerror = function () {
    toast('\u56fe\u7247\u8bfb\u53d6\u5931\u8d25', 4000);
    URL.revokeObjectURL(url);
    if (opts.onCancel) opts.onCancel();
  };
  img.src = url;
}

function closeCropper(cancelled) {
  $id('cropper-modal').classList.remove('open');
  const cb = cropper.callbacks || null;
  cropper.callbacks = null;
  if (cancelled && cb && cb.onCancel) cb.onCancel();
}

/* ---------- viewport / zoom ---------- */

function fitToViewport() {
  const vp = $id('crop-viewport');
  const img = $id('crop-img');
  if (!vp || !img || !cropper.naturalW) return;

  const pad = 56;
  const availW = Math.max(120, vp.clientWidth - pad);
  const availH = Math.max(120, vp.clientHeight - pad);
  const s = Math.min(availW / cropper.naturalW, availH / cropper.naturalH);

  cropper.fitZoom = s;
  cropper.zoom = s;
  cropper.panX = 0;
  cropper.panY = 0;
  applyTransform();
}

function applyTransform() {
  const wrap = $id('crop-canvas-wrap');
  const img = $id('crop-img');
  if (!wrap || !img) return;

  const dw = Math.max(1, Math.round(cropper.naturalW * cropper.zoom));
  const dh = Math.max(1, Math.round(cropper.naturalH * cropper.zoom));

  img.style.width = dw + 'px';
  img.style.height = dh + 'px';
  wrap.style.width = dw + 'px';
  wrap.style.height = dh + 'px';
  wrap.style.transform = 'translate(' + cropper.panX + 'px,' + cropper.panY + 'px)';

  // keep the selection inside bounds after zoom changes
  clampSelection();
  paintSelection();
  updateCropInfo();
}

function setZoom(z, anchorPx, anchorPy) {
  const vp = $id('crop-viewport');
  if (!vp) return;
  const minZ = cropper.fitZoom * 0.35;
  const maxZ = cropper.fitZoom * 8;
  const newZ = Math.max(minZ, Math.min(maxZ, z));

  // zoom around a point (keep that spot under the cursor)
  let ax = anchorPx;
  let ay = anchorPy;
  if (ax === undefined) {
    ax = vp.clientWidth / 2 - cropper.panX;
    ay = vp.clientHeight / 2 - cropper.panY;
  }
  const ratio = newZ / cropper.zoom;
  cropper.panX = ax - (ax - cropper.panX) * ratio;
  cropper.panY = ay - (ay - cropper.panY) * ratio;
  cropper.zoom = newZ;
  applyTransform();
  updateZoomLabel();
}

function updateZoomLabel() {
  const lbl = $id('zoom-label');
  const rng = $id('zoom-range');
  const pct = Math.round((cropper.zoom / cropper.fitZoom) * 100);
  if (lbl) lbl.textContent = pct + '%';
  if (rng) rng.value = String(Math.max(20, Math.min(300, pct)));
}

/* ---------- selection ---------- */

function selectRatioButton(value) {
  cropper.ratio = value;
  document.querySelectorAll('.ratio-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.ratio === value);
  });
}

function selectionBounds() {
  const img = $id('crop-img');
  if (!img) return { w: 0, h: 0 };
  return { w: img.offsetWidth || img.clientWidth, h: img.offsetHeight || img.clientHeight };
}

function resetSelection() {
  const b = selectionBounds();
  if (!b.w || !b.h) return;
  const r = cropper.ratio === 'free' ? null : parseFloat(cropper.ratio);

  let w, h;
  if (r) {
    // largest rectangle with ratio r that fits inside the image, flush to the edges
    const imgR = b.w / b.h;
    if (imgR > r) { h = b.h; w = h * r; }
    else { w = b.w; h = w / r; }
  } else {
    // free mode: the selection IS the whole image
    w = b.w;
    h = b.h;
  }
  cropper.sel = { x: (b.w - w) / 2, y: (b.h - h) / 2, w: w, h: h };
  paintSelection();
  updateCropInfo();
}

function clampSelection() {
  const b = selectionBounds();
  const s = cropper.sel;
  if (!b.w || !b.h) return;
  s.w = Math.max(24, Math.min(s.w, b.w));
  s.h = Math.max(24, Math.min(s.h, b.h));
  s.x = Math.max(0, Math.min(s.x, b.w - s.w));
  s.y = Math.max(0, Math.min(s.y, b.h - s.h));
}

function paintSelection() {
  const selEl = $id('crop-selection');
  const wrap = $id('crop-canvas-wrap');
  const top = document.querySelector('.shade-top');
  const bottom = document.querySelector('.shade-bottom');
  const left = document.querySelector('.shade-left');
  const right = document.querySelector('.shade-right');
  if (!selEl || !wrap) return;

  const s = cropper.sel;
  const bw = wrap.offsetWidth;
  const bh = wrap.offsetHeight;

  selEl.style.left = s.x + 'px';
  selEl.style.top = s.y + 'px';
  selEl.style.width = s.w + 'px';
  selEl.style.height = s.h + 'px';

  if (top) { top.style.height = s.y + 'px'; }
  if (bottom) { bottom.style.height = Math.max(0, bh - s.y - s.h) + 'px'; }
  if (left) { left.style.top = s.y + 'px'; left.style.width = s.x + 'px'; left.style.height = s.h + 'px'; }
  if (right) {
    right.style.top = s.y + 'px';
    right.style.width = Math.max(0, bw - s.x - s.w) + 'px';
    right.style.height = s.h + 'px';
  }
}

function updateCropInfo() {
  const z = cropper.zoom || 1;
  const s = cropper.sel;
  const sw = Math.max(1, Math.round(s.w / z));
  const sh = Math.max(1, Math.round(s.h / z));

  const maxWEl = $id('crop-maxwidth');
  const maxW = parseInt(maxWEl ? maxWEl.value : '0', 10) || 0;
  let outW = sw;
  let outH = sh;
  if (maxW > 0 && sw > maxW) {
    outH = Math.round(sh * maxW / sw);
    outW = maxW;
  }
  const out = $id('crop-outsize');
  if (out) out.textContent = '\u8f93\u51fa ' + outW + ' \u00d7 ' + outH + ' px';

  const info = $id('crop-info');
  if (info && !cropper.forced) {
    info.textContent = '\u88c1\u526a ' + sw + ' \u00d7 ' + sh + ' px \u00b7 \u6bd4\u4f8b '
      + (sw / Math.max(1, sh)).toFixed(2) + ':1 \u00b7 ' + (cropper.ratio === 'free' ? '\u81ea\u7531' : '\u5df2\u9501\u5b9a');
  }
}

/* ---------- pointer interaction ---------- */

function bindCropperEvents() {
  const vp = $id('crop-viewport');
  const wrap = $id('crop-canvas-wrap');
  const selEl = $id('crop-selection');
  if (!vp || !wrap || !selEl) return;

  function localPoint(ev) {
    const r = wrap.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function startResize(ev, handle) {
    ev.preventDefault();
    ev.stopPropagation();
    const p = localPoint(ev);
    cropper.drag = {
      mode: 'resize', handle: handle,
      startX: p.x, startY: p.y,
      box: { x: cropper.sel.x, y: cropper.sel.y, w: cropper.sel.w, h: cropper.sel.h }
    };
  }

  function startMove(ev) {
    ev.preventDefault();
    const p = localPoint(ev);
    cropper.drag = {
      mode: 'move',
      startX: p.x, startY: p.y,
      box: { x: cropper.sel.x, y: cropper.sel.y }
    };
  }

  function onPointerMove(ev) {
    if (cropper.panning) {
      cropper.panX += ev.clientX - cropper.panStartX;
      cropper.panY += ev.clientY - cropper.panStartY;
      cropper.panStartX = ev.clientX;
      cropper.panStartY = ev.clientY;
      wrap.style.transform = 'translate(' + cropper.panX + 'px,' + cropper.panY + 'px)';
      return;
    }
    const d = cropper.drag;
    if (!d) return;
    ev.preventDefault();

    const p = localPoint(ev);
    const b = selectionBounds();
    const s = cropper.sel;
    const r = cropper.ratio === 'free' ? null : parseFloat(cropper.ratio);

    if (d.mode === 'move') {
      s.x = Math.max(0, Math.min(d.box.x + (p.x - d.startX), b.w - s.w));
      s.y = Math.max(0, Math.min(d.box.y + (p.y - d.startY), b.h - s.h));
      paintSelection();
      updateCropInfo();
      return;
    }

    const hd = d.handle;
    let left = d.box.x;
    let top = d.box.y;
    let right = d.box.x + d.box.w;
    let bottom = d.box.y + d.box.h;

    if (hd.indexOf('w') >= 0) left = Math.min(d.box.x + (p.x - d.startX), right - 24);
    if (hd.indexOf('e') >= 0) right = Math.max(d.box.x + d.box.w + (p.x - d.startX), left + 24);
    if (hd.indexOf('n') >= 0) top = Math.min(d.box.y + (p.y - d.startY), bottom - 24);
    if (hd.indexOf('s') >= 0) bottom = Math.max(d.box.y + d.box.h + (p.y - d.startY), top + 24);

    left = Math.max(0, left);
    top = Math.max(0, top);
    right = Math.min(b.w, right);
    bottom = Math.min(b.h, bottom);

    let w = right - left;
    let h = bottom - top;

    if (r) {
      // ---- aspect-locked resize ----
      // Corners anchor on the opposite corner.
      // Edge midpoints grow symmetrically around the selection centre.
      const cx = d.box.x + d.box.w / 2;
      const cy = d.box.y + d.box.h / 2;
      const isEdgeN = (hd === 'n'), isEdgeS = (hd === 's');
      const isEdgeE = (hd === 'e'), isEdgeW = (hd === 'w');

      if (isEdgeN || isEdgeS) {
        // vertical edge: height is driven, width follows, centred horizontally
        h = Math.max(24, h);
        w = h * r;
        if (isEdgeN) { bottom = d.box.y + d.box.h; top = bottom - h; }
        else { top = d.box.y; bottom = top + h; }
        left = cx - w / 2;
        right = cx + w / 2;
      } else if (isEdgeE || isEdgeW) {
        // horizontal edge: width is driven, height follows, centred vertically
        w = Math.max(24, w);
        h = w / r;
        if (isEdgeW) { right = d.box.x + d.box.w; left = right - w; }
        else { left = d.box.x; right = left + w; }
        top = cy - h / 2;
        bottom = cy + h / 2;
      } else {
        // corner: opposite corner stays put
        h = w / r;
        if (hd.indexOf('w') >= 0) left = d.box.x + d.box.w - w;
        else right = left + w;
        if (hd.indexOf('n') >= 0) top = d.box.y + d.box.h - h;
        else bottom = top + h;
      }

      // keep inside the image, shrinking the ratio box if needed
      if (left < 0) {
        const over = -left;
        left = 0;
        if (isEdgeE || isEdgeW || hd.indexOf('w') >= 0) right = Math.min(b.w, right + over);
        w = right - left;
        h = w / r;
      }
      if (top < 0) {
        const over = -top;
        top = 0;
        if (isEdgeS || isEdgeN || hd.indexOf('n') >= 0) bottom = Math.min(b.h, bottom + over);
        h = bottom - top;
        w = h * r;
      }
      if (left + w > b.w) { w = b.w - left; h = w / r; }
      if (top + h > b.h) { h = b.h - top; w = h * r; }
      if (isEdgeN || isEdgeS) left = Math.min(Math.max(0, cx - w / 2), b.w - w);
      if (isEdgeE || isEdgeW) top = Math.min(Math.max(0, cy - h / 2), b.h - h);
    }

    s.x = Math.max(0, left);
    s.y = Math.max(0, top);
    s.w = Math.max(24, w);
    s.h = Math.max(24, h);
    clampSelection();
    paintSelection();
    updateCropInfo();
  }

  function endPointer() {
    cropper.drag = null;
    cropper.panning = false;
    vp.classList.remove('panning');
  }

  // 8 handles
  selEl.querySelectorAll('.crop-handle').forEach(function (hEl) {
    const hd = hEl.dataset.h;
    hEl.addEventListener('mousedown', function (e) { startResize(e, hd); });
    hEl.addEventListener('touchstart', function (e) { startResize(e, hd); }, { passive: false });
  });

  selEl.addEventListener('mousedown', function (e) {
    if (e.target.closest('.crop-handle')) return;
    startMove(e);
  });
  selEl.addEventListener('touchstart', function (e) {
    if (e.target.closest('.crop-handle')) return;
    startMove(e);
  }, { passive: false });

  // pan with space / middle button
  vp.addEventListener('mousedown', function (e) {
    if (e.button === 1 || cropper.spaceDown) {
      e.preventDefault();
      cropper.panning = true;
      cropper.panStartX = e.clientX;
      cropper.panStartY = e.clientY;
      vp.classList.add('panning');
    }
  });

  document.addEventListener('mousemove', onPointerMove);
  document.addEventListener('touchmove', onPointerMove, { passive: false });
  document.addEventListener('mouseup', endPointer);
  document.addEventListener('touchend', endPointer);

  // double-click inside the image resets the selection to full
  wrap.addEventListener('dblclick', function (e) {
    e.preventDefault();
    resetSelection();
  });

  // wheel zoom
  vp.addEventListener('wheel', function (e) {
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    const ax = e.clientX - rect.left - cropper.panX;
    const ay = e.clientY - rect.top - cropper.panY;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(cropper.zoom * factor, ax, ay);
  }, { passive: false });

  // space to pan
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && $id('cropper-modal').classList.contains('open')) {
      cropper.spaceDown = true;
      vp.style.cursor = 'grab';
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.code === 'Space') {
      cropper.spaceDown = false;
      vp.style.cursor = '';
    }
  });
}

/* ---------- apply ---------- */

async function applyCrop(save) {
  if (!cropper.img || !cropper.file) return;
  const z = cropper.zoom || 1;
  const s = cropper.sel;
  const crop = {
    left: Math.round(s.x / z),
    top: Math.round(s.y / z),
    width: Math.round(s.w / z),
    height: Math.round(s.h / z)
  };

  const fd = new FormData();
  fd.append('file', cropper.file);

  const fmtEl = $id('crop-format');
  const mwEl = $id('crop-maxwidth');
  const tkEl = $id('crop-targetkb');
  const fitEl = $id('crop-fitmode');
  const padEl = $id('crop-padmode');
  const padcEl = $id('crop-padcolor');

  const opts = {
    crop: crop,
    format: fmtEl ? fmtEl.value : 'webp',
    purpose: currentPurpose(),
    maxWidth: parseInt(mwEl ? mwEl.value : '0', 10) || null,
    targetKb: parseInt(tkEl ? tkEl.value : '0', 10) || null,
    fitRatio: cropper.ratio === 'free' ? null : parseFloat(cropper.ratio),
    fitMode: fitEl ? fitEl.value : 'crop',
    padMode: padEl ? padEl.value : 'solid',
    padColor: padcEl ? padcEl.value : '#ffffff',
    save: save
  };
  fd.append('options', new Blob([JSON.stringify(opts)], { type: 'application/json' }), 'options.json');

  const btn = save ? $id('cropper-apply') : $id('cropper-skip');
  if (!btn) return;
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '\u5904\u7406\u4e2d\u2026';
  try {
    const res = await api('/api/image/process', { method: 'POST', body: fd });
    if (save) {
      const cb = cropper.callbacks || null;
      cropper.callbacks = null;
      $id('cropper-modal').classList.remove('open');
      if (cb && cb.onSaved) cb.onSaved(res.path);
      if (!cb) await loadMedia();
      toast('\u5df2\u4fdd\u5b58 ' + res.name + ' \u00b7 ' + res.width + '\u00d7' + res.height
        + ' \u00b7 ' + res.sizeLabel + '\uff08\u7701 ' + res.savedPercent + '%\uff09', 5000);
    } else {
      toast('\u9884\u89c8\uff1a' + res.width + '\u00d7' + res.height + ' \u00b7 ' + res.sizeLabel, 4000);
    }
  } catch (e) {
    toast('\u5904\u7406\u5931\u8d25\uff1a' + e.message, 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

/* ---------- batch optimize ---------- */

async function runBatchOptimize() {
  const maxwEl = $id('batch-maxwidth');
  const qEl = $id('batch-quality');
  const mkEl = $id('batch-minkb');
  const modeEl = $id('batch-mode');
  const body = {
    dryRun: (modeEl ? modeEl.value : 'dry') === 'dry',
    maxWidth: parseInt(maxwEl ? maxwEl.value : '1600', 10) || 1600,
    quality: parseInt(qEl ? qEl.value : '80', 10) || 80,
    minKb: parseFloat(mkEl ? mkEl.value : '0') || 0,
    backup: true
  };

  const btn = $id('run-batch');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '\u5904\u7406\u4e2d\uff0c\u8bf7\u7a0d\u5019\u2026';
  const report = $id('batch-report');
  if (report) report.innerHTML = '<span class="muted">\u6b63\u5728\u5904\u7406\uff0c\u56fe\u7247\u8f83\u591a\u65f6\u9700\u8981\u4e00\u4f1a\u513f\u2026</span>';

  try {
    const res = await api('/api/images/optimize-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const hint = $id('batch-hint');
    if (hint) hint.textContent = (body.dryRun ? '\u9884\u89c8' : '\u5df2\u6267\u884c') + ' \u00b7 \u7701 ' + res.savedPercent + '%';

    if (report) {
      const rows = (res.results || []).map(function (r) {
        if (r.action === 'optimized') {
          return '<div class="dimension-result"><div></div><div>'
            + '<div class="dim-name">' + esc(r.path) + '</div>'
            + '<div class="dim-meta">' + r.beforeLabel + ' \u2192 <span class="crop-ok">' + r.afterLabel + '</span>\uff08\u7701 ' + r.savedPercent + '%\uff09</div>'
            + '</div><span class="dimension-status">\u5df2\u4f18\u5316</span></div>';
        }
        const labels = { 'skipped-small': '\u592a\u5c0f\uff0c\u8df3\u8fc7', 'kept-original': '\u5df2\u662f\u6700\u4f18', 'error': '\u51fa\u9519' };
        const label = labels[r.action] || r.action;
        return '<div class="dimension-result"><div></div><div>'
          + '<div class="dim-name">' + esc(r.path) + '</div>'
          + '<div class="dim-meta">' + (r.beforeLabel || '') + '</div>'
          + '</div><span class="dimension-status warn">' + label + '</span></div>';
      }).join('');

      report.innerHTML = '<div class="notice" style="margin-bottom:10px"><strong>'
        + (body.dryRun ? '\u9884\u89c8\u7ed3\u679c' : '\u4f18\u5316\u5b8c\u6210') + '\uff1a</strong>\u5171 ' + res.count + ' \u5f20\uff0c\u4f18\u5316 ' + res.optimized
        + ' \u5f20\uff0c' + res.totalBeforeLabel + ' \u2192 ' + res.totalAfterLabel
        + '\uff0c\u5171\u7701 <strong>' + res.savedPercent + '%</strong>'
        + (body.dryRun ? '\u3002\u8fd9\u53ea\u662f\u9884\u89c8\uff0c\u672a\u4fee\u6539\u4efb\u4f55\u6587\u4ef6\u3002' : '\u3002\u539f\u56fe\u5df2\u5907\u4efd\u5230 admin-tools/backups/images/')
        + '</div>' + rows;
    }

    if (!body.dryRun) await loadMedia();
    toast('\u6279\u91cf\u4f18\u5316\u5b8c\u6210\uff1a\u7701 ' + res.savedPercent + '%', 5000);
  } catch (e) {
    if (report) report.innerHTML = '<span class="muted">\u5931\u8d25\uff1a' + esc(e.message) + '</span>';
    toast('\u6279\u91cf\u4f18\u5316\u5931\u8d25\uff1a' + e.message, 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

/* ---------- init ---------- */

function initCropper() {
  loadCapabilities();

  const openBtn = $id('open-cropper');
  if (openBtn) openBtn.addEventListener('click', function () { $id('cropper-file-input').click(); });

  const fileInput = $id('cropper-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (files.length) openCropper(files[0]);
    });
  }

  // ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      selectRatioButton(b.dataset.ratio);
      resetSelection();
    });
  });

  // zoom controls
  const zOut = $id('zoom-out');
  const zIn = $id('zoom-in');
  const zRange = $id('zoom-range');
  const zFit = $id('zoom-fit');
  if (zOut) zOut.addEventListener('click', function () { setZoom(cropper.zoom / 1.25); });
  if (zIn) zIn.addEventListener('click', function () { setZoom(cropper.zoom * 1.25); });
  if (zRange) zRange.addEventListener('input', function () {
    setZoom(cropper.fitZoom * (parseInt(zRange.value, 10) / 100));
  });
  if (zFit) zFit.addEventListener('click', function () { fitToViewport(); resetSelection(); });

  // footer buttons
  const closeBtn = $id('cropper-close');
  if (closeBtn) closeBtn.addEventListener('click', function () { closeCropper(true); });
  const cancelBtn = $id('cropper-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', function () { closeCropper(true); });
  const resetBtn = $id('cropper-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () { resetSelection(); });
  const applyBtn = $id('cropper-apply');
  if (applyBtn) applyBtn.addEventListener('click', function () { applyCrop(true); });
  const skipBtn = $id('cropper-skip');
  if (skipBtn) skipBtn.addEventListener('click', function () { applyCrop(true); });
  const batchBtn = $id('run-batch');
  if (batchBtn) batchBtn.addEventListener('click', runBatchOptimize);

  const maxw = $id('crop-maxwidth');
  if (maxw) maxw.addEventListener('input', updateCropInfo);

  // stretch warning + colour picker bindings
  const fitModeSel = $id('crop-fitmode');
  if (fitModeSel && !fitModeSel._bound) {
    fitModeSel._bound = true;
    fitModeSel.addEventListener('change', function () {
      const warn = $id('stretch-warn');
      if (warn) warn.style.display = fitModeSel.value === 'stretch' ? 'block' : 'none';
      ['crop-padmode', 'crop-padcolor'].forEach(function (id) {
        const el = $id(id);
        if (el && el.closest('.field')) el.closest('.field').style.opacity = fitModeSel.value === 'pad' ? '1' : '.45';
      });
    });
  }
  const padColorText = $id('crop-padcolor');
  const padColorPick = $id('crop-padcolor-pick');
  if (padColorPick && padColorText && !padColorPick._bound) {
    padColorPick._bound = true;
    padColorPick.addEventListener('input', function () { padColorText.value = padColorPick.value; });
    padColorText.addEventListener('input', function () {
      const v = padColorText.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) padColorPick.value = v;
    });
  }

  window.addEventListener('resize', function () {
    const m = $id('cropper-modal');
    if (m && m.classList.contains('open') && cropper.img) {
      const prevFit = cropper.fitZoom;
      fitToViewport();
      if (prevFit && Math.abs(prevFit - cropper.fitZoom) > 0.001) resetSelection();
    }
  });

  bindCropperEvents();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCropper);
} else {
  initCropper();
}


/* ===== Smart upload: compliant images upload directly, others must be edited ===== */
/* Replaces uploadFiles / uploadSingle so the whole app shares one gatekeeper. */

const uploadGate = { queue: [], resolve: null, pending: [] };

/** Is this file already acceptable for the chosen purpose? */
async function checkCompliance(file, purpose) {
  const rule = dimensionRules[purpose] || dimensionRules.product;
  const dim = await readImageSize(file);
  const issues = [];
  if (!dim.width || !dim.height) {
    issues.push('无法读取图片尺寸，文件可能损坏');
    return { ok: false, issues, dim, rule };
  }
  const ratio = dim.width / dim.height;
  const kb = file.size / 1024;

  if (dim.width < rule.minW || dim.height < rule.minH) {
    issues.push('分辨率 ' + dim.width + '×' + dim.height + ' 低于建议 ' + rule.minW + '×' + rule.minH);
  }
  if (ratio < rule.range[0] || ratio > rule.range[1]) {
    issues.push('比例 ' + ratio.toFixed(2) + ':1 不在推荐区间 ' + rule.range[0] + '–' + rule.range[1]);
  }
  if (kb > rule.maxKB) {
    issues.push('文件 ' + Math.round(kb) + ' KB 超过建议上限 ' + rule.maxKB + ' KB');
  }
  URL.revokeObjectURL(dim.url);
  return { ok: issues.length === 0, issues, dim, rule };
}

/** Ask the user how to handle a non-compliant batch. */
function askEditDecision(badItems, purpose) {
  return new Promise(resolve => {
    const list = badItems.slice(0, 6).map(x =>
      '· ' + x.file.name + '\n    ' + x.issues.join('；')
    ).join('\n');
    const more = badItems.length > 6 ? '\n…另有 ' + (badItems.length - 6) + ' 张' : '';
    const msg = '以下 ' + badItems.length + ' 张图片不符合「' +
      (dimensionRules[purpose] || {}).title + '」的推荐规格：\n\n' + list + more +
      '\n\n点「确定」进入编辑（裁剪/压缩后再上传）\n点「取消」放弃这批图片';
    resolve(confirm(msg));
  });
}

/**
 * Main entry. Opens a file picker, checks each file, and:
 *   - compliant  -> upload immediately
 *   - non-compliant -> force the crop/compress editor before saving
 * Resolves with an array of uploaded relative paths (may be empty).
 */
async function uploadWithGate(purposeOverride) {
  const purpose = purposeOverride || currentPurpose();

  const files = await new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => resolve(Array.prototype.slice.call(input.files || []));
    input.click();
  });
  if (!files.length) return [];

  const results = await Promise.all(files.map(f => checkCompliance(f, purpose)));
  const good = [];
  const bad = [];
  results.forEach((r, i) => { const entry = { file: files[i], issues: r.issues, dim: r.dim, rule: r.rule }; (r.ok ? good : bad).push(entry); });

  const savedPaths = [];

  // 1) compliant files go straight in
  for (const item of good) {
    try {
      const fd = new FormData();
      fd.append('file', item.file);
      const res = await api('/api/upload', { method: 'POST', body: fd });
      savedPaths.push(res.path);
    } catch (e) {
      toast('上传失败：' + e.message, 4000);
    }
  }
  if (good.length) {
    toast('已直接上传 ' + good.length + ' 张（符合规格）', 3500);
  }

  // 2) non-compliant files MUST go through the editor
  if (bad.length) {
    const caps = cropper.caps || await (async () => { await loadCapabilities(); return cropper.caps; })();
    if (caps && caps.pillow === false) {
      toast('有 ' + bad.length + ' 张图片不符合规格，但未安装 Pillow 无法编辑。请运行 pip install Pillow', 7000);
      await loadMedia();
      return savedPaths;
    }
    const go = await askEditDecision(bad, purpose);
    if (!go) {
      toast('已跳过 ' + bad.length + ' 张不符合规格的图片', 4000);
      await loadMedia();
      return savedPaths;
    }
    // queue them through the cropper one at a time
    for (const item of bad) {
      const saved = await runCropperFlow(item.file, purpose, item.issues);
      if (saved) savedPaths.push(saved);
    }
  }

  await loadMedia();
  return savedPaths;
}

/** Open the cropper for a single file and resolve with the saved path (or null). */
function runCropperFlow(file, purpose, issues) {
  return new Promise(resolve => {
    openCropper(file, {
      purpose: purpose,
      reason: issues,
      onSaved: function (path) { resolve(path); },
      onCancel: function () { resolve(null); }
    });
  });
}

/* ---- override the originals so every upload button uses the gate ---- */
async function uploadFiles(files) {
  // called by the media page multi-select; route through the same logic
  if (!files || !files.length) return;
  const purpose = currentPurpose();
  const results = await Promise.all(files.map(f => checkCompliance(f, purpose)));
  const good = [];
  const bad = [];
  results.forEach((r, i) => { (r.ok ? good : bad).push({ file: files[i] }); });

  for (const item of good) {
    const fd = new FormData();
    fd.append('file', item.file);
    await api('/api/upload', { method: 'POST', body: fd });
  }
  if (good.length) toast('已直接上传 ' + good.length + ' 张（符合规格）', 3500);

  if (bad.length) {
    const go = await askEditDecision(bad, purpose);
    if (go) {
      for (const item of bad) {
        await runCropperFlow(item.file, purpose, []);
      }
    } else {
      toast('已跳过 ' + bad.length + ' 张', 3500);
    }
  }
  await loadMedia();
}

async function uploadSingle(useOverride) {
  const paths = await uploadWithGate(useOverride || currentPurpose());
  return paths.length ? paths[0] : null;
}

/* ===== Edit / replace actions for existing library images ===== */

/** Load an existing asset into the cropper. */
async function editExistingImage(path) {
  if (cropper.caps && cropper.caps.pillow === false) {
    toast('未安装 Pillow，无法编辑图片。请运行 pip install Pillow', 6000);
    return;
  }
  try {
    const url = '/api/image/raw?path=' + encodeURIComponent(path);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('无法读取图片（' + resp.status + '）');
    const blob = await resp.blob();
    const name = path.split('/').pop();
    const file = new File([blob], name, { type: blob.type || 'image/webp' });

    openCropper(file, {
      purpose: currentPurpose(),
      reason: ['这是素材库中的现有图片，编辑后会生成新文件并自动替换引用'],
      sourcePath: path,
      onSaved: async function (newPath) {
        await swapImageReference(path, newPath);
        await loadMedia();
      }
    });
  } catch (e) {
    toast('读取失败：' + e.message, 5000);
  }
}

/** Pick a new file and replace the existing one. */
async function replaceExistingImage(path) {
  const file = await new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve((input.files || [])[0] || null);
    input.click();
  });
  if (!file) return;

  const purpose = currentPurpose();
  const check = await checkCompliance(file, purpose);

  if (check.ok) {
    // compliant: upload then repoint references
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api('/api/upload', { method: 'POST', body: fd });
      await swapImageReference(path, res.path);
      await loadMedia();
      toast('已替换为新图片（符合规格，直接上传）', 4000);
    } catch (e) {
      toast('替换失败：' + e.message, 5000);
    }
    return;
  }

  // not compliant -> force the editor
  const go = await askEditDecision([{ file: file, issues: check.issues }], purpose);
  if (!go) { toast('已取消替换', 3000); return; }

  openCropper(file, {
    purpose: purpose,
    reason: check.issues,
    sourcePath: path,
    onSaved: async function (newPath) {
      await swapImageReference(path, newPath);
      await loadMedia();
    }
  });
}

/** Point every JSON reference from oldPath to newPath. */
async function swapImageReference(oldPath, newPath) {
  if (!oldPath || !newPath || oldPath === newPath) return;
  const refs = [];
  const look = [['products', state.products], ['colors', state.colors]];
  look.forEach(([key, list]) => {
    (list || []).forEach(function (item, idx) {
      ['image', 'heroImage', 'cardImage', 'bannerImage'].forEach(function (field) {
        if (item[field] === oldPath) refs.push({ key: key, idx: idx, field: field });
      });
    });
  });
  (state.homepage?.areas || []).forEach(function (area, idx) {
    if (area.image === oldPath) refs.push({ key: 'homepage-area', idx: idx, field: 'image' });
  });
  (state.homepage?.modules || []).forEach(function (mod, idx) {
    if (mod.bannerImage === oldPath) refs.push({ key: 'module', idx: idx, field: 'bannerImage' });
  });

  if (!refs.length) {
    toast('已生成新图片，但没有其他数据引用旧路径（可能需要手动替换）', 5000);
    return;
  }

  // apply locally then persist
  refs.forEach(function (r) {
    if (r.key === 'products') state.products[r.idx][r.field] = newPath;
    else if (r.key === 'colors') state.colors[r.idx][r.field] = newPath;
    else if (r.key === 'homepage-area') state.homepage.areas[r.idx][r.field] = newPath;
    else if (r.key === 'module') state.homepage.modules[r.idx][r.field] = newPath;
  });

  const saves = [];
  if (refs.some(r => r.key === 'products')) saves.push(saveData('products'));
  if (refs.some(r => r.key === 'colors')) saves.push(saveData('colors'));
  if (refs.some(r => r.key === 'homepage-area' || r.key === 'module')) saves.push(saveData('homepage'));

  try {
    await Promise.all(saves);
    renderAll();
    toast('已替换引用：' + refs.length + ' 处（商品/颜色/首页）', 5000);
  } catch (e) {
    toast('更新引用失败：' + e.message, 5000);
  }
}

/** Wire the buttons via delegated click handling. */
document.addEventListener('click', function (e) {
  const editBtn = e.target.closest('[data-edit-image]');
  if (editBtn) { e.preventDefault(); editExistingImage(editBtn.dataset.editImage); return; }

  const repBtn = e.target.closest('[data-replace-image]');
  if (repBtn) { e.preventDefault(); replaceExistingImage(repBtn.dataset.replaceImage); return; }
});
