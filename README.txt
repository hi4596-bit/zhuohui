ZHUOHUI FLORAL — FLOWER WALL CATALOG UPDATE
===========================================

Files
-----
- index.html: home page
- products.html: product collections overview
- flower-walls.html: updated flower-wall catalog matching the supplied reference
- product-detail.html: product detail page; supports product/image query parameters from the catalog
- inspiration.html, custom.html, about.html: supporting pages
- assets/: all local WebP image assets

Local preview
-------------
Open index.html in a browser. Use the navigation to open Products > Flower walls.

GitHub Pages deployment
-----------------------
Upload the complete folder contents to the same repository directory:
1. All HTML files
2. The entire assets/ folder (including every .webp file)
3. This README

Do not upload only an HTML file. Image paths are relative (assets/filename.webp), so the assets folder must remain next to the HTML files.

Catalog behavior
----------------
- Desktop: six columns on wide screens; four columns at medium widths; two columns on phones.
- Filter styles by color and sort by name.
- Product cards open the detail page with the selected product name and image.
- "Add to enquiry" opens the existing enquiry modal and pre-fills the product.
- Recently viewed is saved locally in the browser and appears after a product has been opened.
- No public prices or invented review counts are shown. The current catalog contains six styles because these are the flower-wall products represented in the supplied project assets; replace/add items when the real product catalog is ready.

Notes
-----
The enquiry form opens the visitor's email application; it does not send to a server or store enquiries online.


FLOWER WALL FILTERS UPDATE
- Color filter chips now filter the actual six flower-wall product cards and show live counts.
- Price range chips are intentionally disabled while product prices are not published. Current items are quotation-based wholesale products, so assigning price bands would create inaccurate pricing.
- To enable price filtering for a product, add a numeric data-price attribute (in USD) to its .catalog-card element, e.g. data-price="85". The price chips will automatically enable and filter by the selected range.
- Color categories currently represented: Cloud Dancer White, Sage Green, Berry & Burgundy, Blue, Multicolor. Blush and Terri remain visible with a zero count until matching products are added.

Homepage updated: full-screen responsive carousel with three local WebP slides. Keep the assets folder beside the HTML pages when deploying.


SHOP BY COLOR UPDATE
- New page: shop-by-color.html
- Products navigation now has a secondary menu: All collections, Shop by color, Flower walls, Flower arches, Wreaths, Potted florals.
- Keep the assets folder next to the HTML files when deploying to GitHub Pages.
- Color palettes filter the local sample product set. Product pricing and review counts are not fabricated; this page uses inquiry-oriented product cards.
