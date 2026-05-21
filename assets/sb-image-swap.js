/**
 * Simple Bundles – Infinite Options Image Swap
 *
 * Swaps the main PDP image when a customer changes an Infinite Options
 * bundle dropdown. Uses the bundled_variants metafield for reliable
 * product/variant to image mapping.
 *
 * This version prevents duplicate option values, such as "White", from
 * matching the wrong dropdown by mapping images with:
 *
 * option group name + selected value
 *
 * Example:
 * label marker::white
 * label ribbon::white
 */

(function () {
  'use strict';

  const CONFIG = {
    imageSelectors: [
      '.product__media-item--variant img',
      '.product__media img.image-magnify-full-size',
      '.product__media-list .product__media img',
      '.product__media img',
      '.product-image-main img',
      '.product__photos img',
      '.product__photo img.photoswipe__image',
      '.product__photo img',
      '.product-gallery__image img',
      '.product__main-photos img',
      '.product-main-slide .image-wrap img',
      '.product-featured-img',
      '.product-single__photo img',
      '.product-single__media img',
      '.product__media-item img',
      '[data-product-media-type="image"] img',
      '.product-single__image img',
      '.product__image-wrapper img',
    ],

    ioBundleContainer: '#simple-bundles-io-options',
    transitionMs: 200,
  };

  let mainImageEl = null;
  let originalSrc = null;
  let originalSrcset = null;

  const imageMap = {};
  const productCache = {};

  function normalizeOptionText(text) {
    return String(text || '')
      .replace(/\([\+\-]?\s*[A-Z]{0,3}\$?\s*[\d,.]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeKey(text) {
    return normalizeOptionText(text);
  }

  function buildGroupValueKey(groupName, value) {
    return `${normalizeKey(groupName)}::${normalizeKey(value)}`;
  }

  function getSelectGroupName(select) {
    const nameAttr = select.getAttribute('name') || '';

    const propertyMatch = nameAttr.match(/properties\[(.*?)\]/);
    if (propertyMatch && propertyMatch[1]) {
      return normalizeKey(propertyMatch[1]);
    }

    const id = select.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) return normalizeKey(label.textContent);
    }

    const wrapper =
      select.closest('.simple-bundles-option') ||
      select.closest('.sb-option') ||
      select.closest('.product-form__input') ||
      select.closest('.form__input') ||
      select.closest('div');

    if (wrapper) {
      const label = wrapper.querySelector('label');
      if (label) return normalizeKey(label.textContent);
    }

    return '';
  }

  function findMainImage() {
    for (const sel of CONFIG.imageSelectors) {
      const img = document.querySelector(sel);
      if (img && img.src) return img;
    }

    const section =
      document.querySelector('.product') ||
      document.querySelector('[data-section-type="product"]') ||
      document.querySelector('.product-single') ||
      document.querySelector('main');

    if (!section) return null;

    let best = null;
    let bestArea = 0;

    section.querySelectorAll('img').forEach((img) => {
      const area = img.offsetWidth * img.offsetHeight;

      if (area > bestArea && !img.closest(CONFIG.ioBundleContainer)) {
        best = img;
        bestArea = area;
      }
    });

    return best;
  }

  function getProductHandle() {
    const match = window.location.pathname.match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  async function fetchProduct(handle) {
    if (productCache[handle]) return productCache[handle];

    try {
      const res = await fetch(`/products/${handle}.js`);

      if (!res.ok) return null;

      const data = await res.json();
      productCache[handle] = data;

      return data;
    } catch (e) {
      console.warn('[SB-IMG] fetch failed for', handle, e);
      return null;
    }
  }

  function resizeImage(url, width) {
    if (!url) return url;

    return url
      .replace(/_(\d+x\d*|\d*x\d+)\./, '.')
      .replace(/\.(\w+)(\?.*)?$/, `_${width}x.$1$2`);
  }

  function normalizeImageUrl(url) {
    return String(url || '')
      .replace(/[?#].*$/, '')
      .replace(/_\d+x\d*\./, '.');
  }

  function swapImage(newSrc) {
    if (!mainImageEl || !newSrc) return;

    const normCurrent = normalizeImageUrl(mainImageEl.src);
    const normNew = normalizeImageUrl(newSrc);

    if (normCurrent === normNew) return;

    mainImageEl.style.transition = `opacity ${CONFIG.transitionMs}ms ease`;
    mainImageEl.style.opacity = '0';

    setTimeout(() => {
      mainImageEl.removeAttribute('srcset');

      const picture = mainImageEl.closest('picture');
      if (picture) {
        picture.querySelectorAll('source').forEach((source) => source.remove());
      }

      const zoomEl =
        mainImageEl.closest('[data-zoom]') ||
        mainImageEl.closest('[data-bgset]') ||
        mainImageEl.closest('[data-image]');

      if (zoomEl) {
        if (zoomEl.dataset.zoom) zoomEl.dataset.zoom = resizeImage(newSrc, 2048);
        if (zoomEl.dataset.bgset) zoomEl.dataset.bgset = newSrc;
        if (zoomEl.dataset.image) zoomEl.dataset.image = newSrc;
      }

      mainImageEl.src = newSrc;

      const show = () => {
        mainImageEl.style.opacity = '1';
      };

      mainImageEl.addEventListener('load', show, { once: true });

      if (mainImageEl.complete) show();
    }, CONFIG.transitionMs);
  }

  function restoreOriginal() {
    if (!mainImageEl || !originalSrc) return;

    mainImageEl.style.transition = `opacity ${CONFIG.transitionMs}ms ease`;
    mainImageEl.style.opacity = '0';

    setTimeout(() => {
      mainImageEl.src = originalSrc;

      if (originalSrcset) {
        mainImageEl.setAttribute('srcset', originalSrcset);
      }

      mainImageEl.style.opacity = '1';
    }, CONFIG.transitionMs);
  }

  async function buildImageMap(bundledVariants) {
    if (!Array.isArray(bundledVariants) || bundledVariants.length === 0) {
      console.warn('[SB-IMG] No bundled_variants data found.');
      return;
    }

    const handleGroups = {};

    for (const bv of bundledVariants) {
      if (!bv.handle) continue;

      if (!handleGroups[bv.handle]) {
        handleGroups[bv.handle] = [];
      }

      handleGroups[bv.handle].push(bv);
    }

    const fetches = Object.keys(handleGroups).map(async (handle) => {
      const product = await fetchProduct(handle);

      if (!product) {
        console.warn('[SB-IMG] Could not fetch product:', handle);
        return;
      }

      for (const bv of handleGroups[handle]) {
        let imageSrc = null;

        const matchedVariant = product.variants.find(
          (variant) => Number(variant.id) === Number(bv.variant_id)
        );

        if (matchedVariant && matchedVariant.featured_image) {
          imageSrc = matchedVariant.featured_image.src;
        }

        if (!imageSrc && product.featured_image) {
          imageSrc = product.featured_image;
        }

        if (!imageSrc && product.images && product.images.length > 0) {
          imageSrc = product.images[0];
        }

        if (!imageSrc) {
          console.log('[SB-IMG] No image available for:', bv.product_title);
          continue;
        }

        imageSrc = resizeImage(imageSrc, 1024);

        const keys = new Set();

        if (bv.variant_options) {
          for (const opt of bv.variant_options) {
            if (!opt.value) continue;

            if (opt.name) {
              keys.add(buildGroupValueKey(opt.name, opt.value));
            }

            keys.add(normalizeOptionText(opt.value));
          }
        }

        if (bv.product_title) {
          keys.add(normalizeOptionText(bv.product_title));

          if (bv.variant_title && bv.variant_title !== 'Default Title') {
            keys.add(
              normalizeOptionText(`${bv.product_title} - ${bv.variant_title}`)
            );
          }
        }

        for (const key of keys) {
          if (!key) continue;

          imageMap[key] = imageSrc;
        }
      }
    });

    await Promise.all(fetches);

    console.log(
      '[SB-IMG] Image map built:',
      Object.keys(imageMap).length,
      'entries',
      imageMap
    );
  }

  async function getBundledVariants() {
    const handle = getProductHandle();

    if (!handle) return null;

    try {
      const res = await fetch(`/products/${handle}.json`);

      if (res.ok) {
        const data = await res.json();
        const product = data.product || data;

        if (product.metafields) {
          const sbMeta =
            product.metafields.simple_bundles ||
            product.metafields['app--4901177--simple_bundles'];

          if (sbMeta && sbMeta.bundled_variants) {
            return JSON.parse(sbMeta.bundled_variants);
          }
        }
      }
    } catch (e) {
      console.warn('[SB-IMG] Product JSON metafield lookup failed:', e);
    }

    const scripts = document.querySelectorAll('script[type="application/json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        const searchObj = (obj, depth = 0) => {
          if (depth > 5 || !obj || typeof obj !== 'object') return null;

          if (obj.bundled_variants) {
            const val = obj.bundled_variants;
            return typeof val === 'string' ? JSON.parse(val) : val;
          }

          for (const key in obj) {
            const result = searchObj(obj[key], depth + 1);
            if (result) return result;
          }

          return null;
        };

        const found = searchObj(data);

        if (found) return found;
      } catch (e) {
        continue;
      }
    }

    if (window.__SB_BUNDLED_VARIANTS__) {
      return typeof window.__SB_BUNDLED_VARIANTS__ === 'string'
        ? JSON.parse(window.__SB_BUNDLED_VARIANTS__)
        : window.__SB_BUNDLED_VARIANTS__;
    }

    return null;
  }

  function handleChange(select) {
    const selected = select.options[select.selectedIndex];

    if (!selected || !selected.value) {
      restoreOriginal();
      return;
    }

    const raw = selected.textContent;
    const normalized = normalizeOptionText(raw);
    const groupName = getSelectGroupName(select);
    const specificKey = buildGroupValueKey(groupName, raw);

    console.log('[SB-IMG] Dropdown changed:', {
      groupName,
      raw: raw.trim(),
      normalized,
      specificKey,
    });

    let imageSrc = null;

    if (groupName && imageMap[specificKey]) {
      imageSrc = imageMap[specificKey];
    }

    if (!imageSrc && imageMap[normalized]) {
      imageSrc = imageMap[normalized];
    }

    if (imageSrc) {
      console.log('[SB-IMG] Image found:', imageSrc);
      swapImage(imageSrc);
      return;
    }

    console.log('[SB-IMG] No image found for:', {
      groupName,
      selected: normalized,
      specificKey,
    });
  }

  function attachListeners(container) {
    const selects = container.querySelectorAll('select');

    selects.forEach((select) => {
      if (select.dataset.sbImgBound) return;

      select.dataset.sbImgBound = '1';

      const runImageSwap = () => {
        setTimeout(() => handleChange(select), 0);
      };

      select.addEventListener('change', runImageSwap);
      select.addEventListener('click', runImageSwap);
      select.addEventListener('keyup', runImageSwap);

      console.log(
        '[SB-IMG] Listener attached:',
        select.name || select.id || '(unnamed)'
      );
    });
  }

  async function init() {
    mainImageEl = findMainImage();

    if (!mainImageEl) {
      console.warn('[SB-IMG] Main product image not found. Retrying in 1s...');

      setTimeout(() => {
        mainImageEl = findMainImage();

        if (mainImageEl) {
          originalSrc = mainImageEl.src;
          originalSrcset = mainImageEl.getAttribute('srcset');
          console.log('[SB-IMG] Main image found on retry:', originalSrc);
        } else {
          console.error('[SB-IMG] Could not find main product image.');
        }
      }, 1000);
    } else {
      originalSrc = mainImageEl.src;
      originalSrcset = mainImageEl.getAttribute('srcset');
      console.log('[SB-IMG] Main image found:', originalSrc);
    }

    const bundledVariants = await getBundledVariants();

    if (bundledVariants) {
      console.log(
        '[SB-IMG] bundled_variants loaded:',
        bundledVariants.length,
        'entries'
      );

      await buildImageMap(bundledVariants);
    } else {
      console.warn(
        '[SB-IMG] Could not load bundled_variants. Add this Liquid snippet to the product template for guaranteed compatibility:',
        '<script>window.__SB_BUNDLED_VARIANTS__ = {{ product.metafields.simple_bundles.bundled_variants.value | json }};</script>'
      );
    }

    const ioContainer = document.querySelector(CONFIG.ioBundleContainer);

    if (ioContainer) {
      attachListeners(ioContainer);
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          const container =
            node.matches && node.matches(CONFIG.ioBundleContainer)
              ? node
              : node.querySelector
                ? node.querySelector(CONFIG.ioBundleContainer)
                : null;

          if (container) {
            attachListeners(container);
          }

          if (node.tagName === 'SELECT') {
            const parent = node.closest(CONFIG.ioBundleContainer);

            if (parent) {
              attachListeners(parent);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[SB-IMG] Initialized.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();