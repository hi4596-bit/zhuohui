/* Zhuohui unified JSON content layer. No framework or external API required. */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const imagePath = p => p && !/^https?:\/\//i.test(p) ? p.replace(/^\//,'') : (p || '');
  const productHref = p => `${p.detailPage || 'product-detail.html'}${(p.detailPage || 'product-detail.html').includes('?')?'&':'?'}id=${encodeURIComponent(p.id)}`;
  const catToType = {'flower-walls':'walls','flower-arches':'arches','centerpieces':'potted','wreaths':'wreaths','plants':'potted','event-supplies':'potted','giant-flowers':'walls'};
  const priceLabel = p => p.price ? esc(p.price) : 'Wholesale quote';
  const card = (p, mode='home') => {
    const img = imagePath(p.image);
    const type = catToType[p.category] || 'walls';
    if (mode === 'catalog') return `<article class="catalog-card" data-product-id="${esc(p.id)}" data-color="${esc((p.colors||[])[0]==='mix'?'multi':((p.colors||[])[0]||'white'))}" data-name="${esc(p.name.toLowerCase())}" data-image="${esc(img)}" data-price="${esc(p.price||'')}"><a class="catalog-image" href="${esc(productHref(p))}" data-view-product><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"></a><div class="catalog-card-body"><a class="catalog-title" href="${esc(productHref(p))}" data-view-product>${esc(p.name)}</a><p>${esc(p.description||'Artificial florals · Wholesale and custom options')}</p><div class="catalog-card-bottom"><span>${p.price?esc(p.price):'Wholesale enquiry'}</span><button type="button" class="catalog-add" data-enquiry-product="${esc(p.name)}">Add to enquiry <span>↗</span></button></div></div></article>`;
    return `<article class="product-card ${mode==='wall'?'extra-wall':''} ${mode==='arch'?'extra-arch':''}" data-product-id="${esc(p.id)}" data-color="${esc((p.colors||[])[0]||'white')}" data-type="${type}" ${mode!=='mini' && p.sortOrder>6?'hidden':''}><a class="${mode==='color'?'product-image':'product-photo'}" href="${esc(productHref(p))}"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"></a><h3 class="${mode==='color'?'':'product-title'}">${esc(p.name)}</h3><p class="${mode==='color'?'':'product-desc'}">${esc(p.description||'Wholesale artificial florals · Custom options')}</p><div class="${mode==='color'?'product-actions':'product-bottom'}"><span>${priceLabel(p)}</span><button class="${mode==='color'?'card-enquire':'quote-icon'}" type="button" data-card-enquire="${esc(p.name)}" aria-label="Enquire about ${esc(p.name)}">↗</button></div></article>`;
  };
  function swatches(colors) { return (colors||[]).map(c=>`<i style="background:${esc(c)}"></i>`).join(''); }
  function colorCard(c) { return `<a class="color-card" href="shop-by-color.html?color=${encodeURIComponent(c.id)}"><span class="color-photo"><img src="${esc(imagePath(c.cardImage||c.heroImage))}" alt="${esc(c.name)} floral palette" loading="lazy"></span><h3>${esc(c.name)}</h3><span class="swatches">${swatches(c.swatches)}</span><p>${esc(c.tagline||c.description||'Explore this color palette')}</p></a>`; }
  function setImage(img, src, alt) { if (!img || !src) return; img.src = imagePath(src); if (alt) img.alt = alt; }
  function renderNavColors(colors) {
    const sub = document.querySelector('.color-subnav'); if (!sub) return;
    sub.innerHTML = colors.filter(c=>c.active!==false).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999)).map(c=>`<a href="shop-by-color.html?color=${encodeURIComponent(c.id)}"><span class="menu-swatch" style="background:${esc((c.swatches||[])[2]||'#c8c8c0')}"></span>${esc(c.name)}</a>`).join('');
  }
  function renderHome(products, colors, homepage) {
    const mainWrap = document.querySelector('main > .wrap'); if (!mainWrap) return;
    const modules = [...(homepage.modules||[])].sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));
    const nodes = {
      'flower-walls':[document.querySelector('#flower-walls'), document.querySelector('[aria-label="Featured flower walls"]')],
      'flower-arches':[document.querySelector('#flower-arches'), document.querySelector('[aria-label="Featured flower arches"]')],
      'shop-by-area':[document.querySelector('#shop-by-area')],
      'shop-by-color':[document.querySelector('#shop-by-color')],
      'more-collections':[document.querySelector('#more-collections')]
    };
    modules.forEach(m => {
      const pair = nodes[m.id] || [];
      pair.forEach(n => { if (!n) return; n.hidden = m.visible === false; });
      if (m.id === 'flower-walls' || m.id === 'flower-arches') {
        const feature = pair[0];
        if (feature) {
          const img = feature.querySelector('.feature-banner img'); setImage(img,m.bannerImage,m.title);
          const heading = feature.querySelector('.feature-caption h1, .feature-caption h2'); if (heading) heading.textContent = m.title || heading.textContent;
          const subtitle = feature.querySelector('.module-subtitle');
          if (m.subtitle) { let p=subtitle||feature.querySelector('.feature-caption p'); if(!p){p=document.createElement('p');p.className='module-subtitle';feature.querySelector('.feature-caption').appendChild(p)}p.textContent=m.subtitle; }
        }
      } else {
        const section = pair[0]; if(section){const h=section.querySelector('.section-head h2');const p=section.querySelector('.section-head p');if(h&&m.title)h.textContent=m.title;if(p&&m.subtitle)p.textContent=m.subtitle;}
      }
    });
    // Reorder homepage modules without changing their internal markup/styles.
    modules.forEach(m => (nodes[m.id]||[]).filter(Boolean).forEach(n=>mainWrap.appendChild(n)));
    const wallGrid = document.querySelector('#wall-grid');
    if (wallGrid) { const list=products.filter(p=>p.status!=='hidden'&&p.category==='flower-walls'&&p.featured).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));wallGrid.innerHTML=list.map((p,i)=>`<article class="product-card ${i>=6?'extra-wall':''}" data-product-id="${esc(p.id)}" data-color="${esc((p.colors||[])[0]||'white')}" ${i>=6?'hidden':''}><a class="product-photo" href="${esc(productHref(p))}"><img src="${esc(imagePath(p.image))}" alt="${esc(p.name)}" loading="lazy"></a><h3 class="product-title">${esc(p.name)}</h3><p class="product-desc">${esc(p.description||'Wholesale artificial florals · Custom options')}</p><div class="product-bottom"><span>${priceLabel(p)}</span><button class="quote-icon" data-product="${esc(p.name)}" aria-label="Enquire about ${esc(p.name)}">↗</button></div></article>`).join(''); }
    const archGrid = document.querySelector('#arch-grid');
    if (archGrid) { const list=products.filter(p=>p.status!=='hidden'&&p.category==='flower-arches'&&p.featured).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));archGrid.innerHTML=list.map((p,i)=>`<article class="product-card ${i>=6?'extra-arch':''}" data-product-id="${esc(p.id)}" data-color="${esc((p.colors||[])[0]||'white')}" ${i>=6?'hidden':''}><a class="product-photo" href="${esc(productHref(p))}"><img src="${esc(imagePath(p.image))}" alt="${esc(p.name)}" loading="lazy"></a><h3 class="product-title">${esc(p.name)}</h3><p class="product-desc">${esc(p.description||'Wholesale artificial florals · Custom options')}</p><div class="product-bottom"><span>${priceLabel(p)}</span><button class="quote-icon" data-product="${esc(p.name)}" aria-label="Enquire about ${esc(p.name)}">↗</button></div></article>`).join(''); }
    const miniMap=[['centerpieces','Tabletop & Centerpiece'],['wreaths','Wreaths & Floral Details'],['plants','Artificial Plants']];
    document.querySelectorAll('.mini-category').forEach((section,i)=>{const [cat]=miniMap[i]||[];if(!cat)return;const grid=section.querySelector('.mini-products');if(!grid)return;const list=products.filter(p=>p.status!=='hidden'&&p.category===cat&&p.featured).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999)).slice(0,2);grid.innerHTML=list.map(p=>`<article class="product-card" data-product-id="${esc(p.id)}"><a class="product-photo" href="${esc(productHref(p))}"><img src="${esc(imagePath(p.image))}" alt="${esc(p.name)}" loading="lazy"></a><h3 class="product-title">${esc(p.name)}</h3><p class="product-desc">${esc(p.description)}</p><div class="product-bottom"><span>${priceLabel(p)}</span><button class="quote-icon" data-product="${esc(p.name)}">↗</button></div></article>`).join('');});
    const colorGrid=document.querySelector('#shop-by-color .color-grid');if(colorGrid)colorGrid.innerHTML=colors.filter(c=>c.active!==false).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999)).map(colorCard).join('');
    (homepage.areas||[]).forEach((a,i)=>{const card=document.querySelectorAll('#shop-by-area .area-card')[i];if(!card)return;const link=card.querySelector('a:first-child'),img=card.querySelector('img'),heading=card.querySelector('h3'),desc=card.querySelector('p'),cta=card.querySelector('.text-link');if(link&&a.link)link.href=a.link;if(cta&&a.link)cta.href=a.link;if(img)setImage(img,a.image,a.title);if(heading&&a.title)heading.textContent=a.title;if(desc&&a.description)desc.textContent=a.description;});
    const moreModule=(homepage.modules||[]).find(m=>m.id==='more-collections');if(moreModule&&Array.isArray(moreModule.columns))moreModule.columns.forEach((c,i)=>{const card=document.querySelectorAll('#more-collections .mini-category')[i];if(!card)return;const h=card.querySelector('h2'),p=card.querySelector(':scope > p');if(h&&c.title)h.textContent=c.title;if(p&&c.subtitle)p.textContent=c.subtitle;});
    if(homepage.siteName){document.title=homepage.siteName+' | Artificial Wedding & Home Florals';const logo=document.querySelector('.header .brand strong');if(logo)logo.textContent=homepage.siteName.toUpperCase();}
    const wallColorLinks=document.querySelector('#flower-walls .feature-links');if(wallColorLinks)wallColorLinks.innerHTML=colors.filter(c=>c.active!==false).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999)).map(c=>`<a href=\"shop-by-color.html?color=${encodeURIComponent(c.id)}\">${esc(c.name)}</a>`).join('');
    const announcement=document.querySelector('.announcement span:nth-child(2)');if(announcement&&homepage.announcement)announcement.textContent=homepage.announcement;
  }
  function renderColorPage(products, colors) {
    const grid=document.querySelector('#color-products'); if(!grid)return;
    let current=new URLSearchParams(location.search).get('color')||'white'; if(!colors.some(c=>c.id===current&&c.active!==false))current='white';
    let type='all', showAll=false;
    const title=$('#palette-title'), season=$('#palette-season'), desc=$('#palette-description'), hero=$('#palette-hero'), dots=$('#palette-dots'), count=$('#results-count'), more=$('#show-more');
    const applyTheme=()=>{const c=colors.find(x=>x.id===current)||colors[0];if(!c)return;if(title)title.textContent=c.name;if(season)season.textContent=c.season||'';if(desc)desc.textContent=c.description||'';setImage(hero,c.heroImage,c.name);if(dots)dots.innerHTML=swatches(c.swatches);};
    const visibleProducts=()=>products.filter(p=>p.status!=='hidden'&&(current==='all'||(p.colors||[]).includes(current))&&(type==='all'||(catToType[p.category]||'walls')===type)).sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));
    const render=()=>{const list=visibleProducts();grid.innerHTML=list.map(p=>card(p,'color')).join('');[...grid.children].forEach((el,i)=>{if(!showAll&&i>=6)el.style.display='none'});if(count)count.textContent=`${list.length} matching collections`;if(more)more.hidden=list.length<=6||showAll;};
    applyTheme();render();
    // Add a second handler after the legacy page script so the JSON dataset is authoritative.
    document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{type=btn.dataset.type;showAll=false;render()}));
    if(more)more.addEventListener('click',()=>{showAll=true;render()});
    // Existing navigation uses query strings, and the page header has no palette selector.
    const colorNav=document.querySelector('.color-subnav');if(colorNav){colorNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{}));}
  }
  function renderFlowerWallCatalog(products) {
    const grid=document.querySelector('#catalog-grid');if(!grid)return;
    const list=products.filter(p=>p.status!=='hidden'&&p.category==='flower-walls').sort((a,b)=>(a.sortOrder||999)-(b.sortOrder||999));
    grid.innerHTML=list.map(p=>card(p,'catalog')).join('');
    const count=$('#catalog-count'),empty=$('#catalog-empty'),sort=$('#catalog-sort');
    let color='all',price='all';
    const colorButtons=[...document.querySelectorAll('[data-color-filter]')],priceButtons=[...document.querySelectorAll('[data-price-filter]')];
    function matchesPrice(p){if(price==='all')return true;const n=parseFloat(String(p.price||'').replace(/[^0-9.]/g,''));if(!Number.isFinite(n))return false;if(price==='under50')return n<50;if(price==='50-99')return n>=50&&n<=99.99;if(price==='100-149')return n>=100&&n<=149.99;if(price==='150plus')return n>=150;return true;}
    function apply(){let rows=list.filter(p=>(color==='all'||(p.colors||[]).includes(color))&&matchesPrice(p));if(sort?.value==='az')rows.sort((a,b)=>a.name.localeCompare(b.name));if(sort?.value==='za')rows.sort((a,b)=>b.name.localeCompare(a.name));grid.innerHTML=rows.map(p=>card(p,'catalog')).join('');if(count)count.textContent=`${rows.length} ${rows.length===1?'style':'styles'}`;if(empty)empty.hidden=rows.length>0;colorButtons.forEach(b=>{b.classList.toggle('active',b.dataset.colorFilter===color);b.setAttribute('aria-pressed',b.dataset.colorFilter===color?'true':'false');const small=b.querySelector('small');if(small&&b.dataset.colorFilter!=='all')small.textContent=list.filter(p=>(p.colors||[]).some(c=>(c==='mix'?'multi':c)===b.dataset.colorFilter)).length;});}
    colorButtons.forEach(b=>b.addEventListener('click',()=>{color=b.dataset.colorFilter;apply()}));priceButtons.forEach(b=>b.addEventListener('click',()=>{price=b.dataset.priceFilter;apply()}));if(sort)sort.addEventListener('change',apply);apply();
  }
  function renderProductDetail(products) {
    const id=new URLSearchParams(location.search).get('id');if(!id)return;const p=products.find(x=>x.id===id);if(!p)return;
    const h=document.querySelector('h1');if(h)h.textContent=p.name;const image=document.querySelector('main img, .product-gallery img, .product-main-image img');if(image)setImage(image,p.image,p.name);document.title=`${p.name} | Zhuohui Floral`;
    const desc=document.querySelector('.product-description, .product-intro p, .product-info p');if(desc&&p.description)desc.textContent=p.description;
  }
  Promise.all([fetch('data/products.json').then(r=>r.ok?r.json():[]),fetch('data/colors.json').then(r=>r.ok?r.json():[]),fetch('data/homepage.json').then(r=>r.ok?r.json():{})]).then(([products,colors,homepage])=>{
    if(!Array.isArray(products)||!Array.isArray(colors))return;
    renderNavColors(colors);
    if(document.querySelector('#wall-grid'))renderHome(products,colors,homepage||{});
    if(document.querySelector('#color-products'))renderColorPage(products,colors);
    if(document.querySelector('#catalog-grid'))renderFlowerWallCatalog(products);
    renderProductDetail(products);
  }).catch(err=>console.warn('Zhuohui content JSON not loaded; using the original HTML fallback.',err));
  // Generic enquiry buttons generated by the data layer.
  document.addEventListener('click',e=>{const b=e.target.closest('[data-card-enquire],[data-product],[data-enquiry-product]');if(!b)return;const name=b.getAttribute('data-card-enquire')||b.getAttribute('data-product')||b.getAttribute('data-enquiry-product');const modal=document.querySelector('#quote-modal');if(!modal)return;const select=modal.querySelector('select[name="product"]');if(select&&name){let o=[...select.options].find(x=>x.value===name||x.textContent===name);if(!o){o=document.createElement('option');o.value=name;o.textContent=name;select.appendChild(o)}select.value=name;}modal.classList.add('open');document.body.style.overflow='hidden';});
})();
