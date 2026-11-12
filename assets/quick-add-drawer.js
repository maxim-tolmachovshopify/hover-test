/* ========================================
   QUICK ADD DRAWER - Global State & Config
   ======================================== */

let selectedColor = null;
let selectedSize = null;
let productVariants = [];
let variantInventory = {};
const LOW_STOCK_THRESHOLD = 10;

/* ========================================
   QUICK ADD DRAWER - Initialization
   ======================================== */

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', initNotifyPopup);

function init() {
  const drawer = document.getElementById('quick-add-drawer');
  if (!drawer) return;

  document.body.appendChild(drawer);

  document.querySelectorAll('.card__quick-add-btn').forEach(btn => {
    btn.addEventListener('click', openDrawerWithProduct);
  });

  drawer.addEventListener('click', closeOnOverlayOrButton);
  document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());
}

/* ========================================
   DRAWER CORE - Open / Close Logic
   ======================================== */

function openDrawerWithProduct(e) {
  e.preventDefault();
  const productData = this.getAttribute('data-product');
  if (!productData) {
    console.error('❌ No product data');
    return;
  }

  try {
    const product = JSON.parse(productData);
    console.log('✅ Product loaded:', product.title);
    loadInventoryFromMetafields(product);
  } catch (err) {
    console.error('❌ Parse error:', err);
  }
}

/* ========================================
   DRAWER CONTENT - Product Info & Inventory
   ======================================== */

function loadInventoryFromMetafields(product) {

  if (product.variants && Array.isArray(product.variants)) {
    product.variants.forEach(v => {
      const qty = v.inventory_quantity || 0;
      variantInventory[v.id] = parseInt(qty) || 0;
      console.log(`Variant ${v.id}: ${qty} available`);
    });
    console.log('✅ Inventory loaded');
  }

  populateDrawer(product);
  openDrawer();
}

function populateDrawer(product) {
  const drawer = document.getElementById('quick-add-drawer');
  if (!drawer) return;

  productVariants = product.variants || [];
  selectedColor = null;

  const img = drawer.querySelector('.drawer-product-image');
  if (img && product.featured_image) {
    img.src = product.featured_image.split('?')[0] + '?width=300&height=300&crop=center';
  }

  set(drawer, '.drawer-product-title', product.title);
  const plainDescription = product.description?.replace(/<[^>]*>/g, '') || '';
  set(drawer, '.drawer-product-description', plainDescription);
  const currency = product.price_currency || 'USD';
  set(drawer, '.drawer-product-price', '$' + (product.price / 100).toFixed(2) + ' ' + currency);

  const compareEl = drawer.querySelector('.drawer-compare-price');
  const badgeEl = drawer.querySelector('.drawer-sale-badge');
  const hasSale = product.available && product.compare_at_price && product.compare_at_price > product.price;

  if (hasSale && compareEl) {
    const currency = product.price_currency || 'USD';
    compareEl.textContent = '$' + (product.compare_at_price / 100).toFixed(2) + ' ' + currency;
    compareEl.style.setProperty('display', 'inline', 'important');
    if (badgeEl) badgeEl.style.setProperty('display', 'inline', 'important');
  } else {
    if (compareEl) compareEl.style.display = 'none';
    if (badgeEl) badgeEl.style.display = 'none';
  }

  if (!productVariants.length || productVariants.length <= 1) {
    drawer.querySelectorAll('.quick-add-drawer__section').forEach(s => s.style.display = 'none');
    return;
  }

  const colorSection = drawer.querySelector('.drawer-color-section');
  const colorList = drawer.querySelector('.drawer-color-list');
  const colors = [...new Set(productVariants.map(v => v.option1).filter(Boolean))];

  if (colors.length > 0 && colorList && colorSection) {
    colorList.innerHTML = colors.map(c => {
      const colorVariants = productVariants.filter(v => v.option1 === c);
      const hasStock = colorVariants.some(v => {
        const qty = variantInventory[v.id];
        return qty > 0 && v.available;
      });
      const strikethrough = !hasStock ? 'style="text-decoration: line-through; opacity: 0.5;"' : '';
      return `<button class="quick-add-drawer__color-option" data-color="${c}" ${strikethrough}>${c}</button>`;
    }).join('');
    colorSection.style.setProperty('display', 'block', 'important');

    selectedColor = colors.find(c => {
      const colorVariants = productVariants.filter(v => v.option1 === c);
      return colorVariants.some(v => {
        const qty = variantInventory[v.id];
        return qty > 0 && v.available;
      });
    }) || colors[0];

    colorList.querySelector('[data-color="' + selectedColor + '"]')?.classList.add('active');
  } else {
    if (colorSection) colorSection.style.display = 'none';
  }

  renderSizes(drawer);
}

function renderSizes(drawer) {
  const sizeSection = drawer.querySelector('.drawer-size-section');
  const sizeList = drawer.querySelector('.drawer-size-list');

  if (!sizeSection || !sizeList) return;

  const filteredVariants = selectedColor
    ? productVariants.filter(v => v.option1 === selectedColor)
    : productVariants;

  const sizes = [...new Set(filteredVariants.map(v => v.option2).filter(Boolean))];

  if (sizes.length > 0) {
    sizeList.innerHTML = sizes.map(size => {
      const v = filteredVariants.find(variant => variant.option2 === size);

      let status = 'Check availability';
      let soldClass = '';

      if (v) {
        const quantity = variantInventory[v.id] !== undefined ? variantInventory[v.id] : 0;

        console.log(`Size ${size}: id=${v.id}, qty=${quantity}, available=${v.available}`);

        if (!v.available || quantity === 0) {
          status = 'Sold out';
          soldClass = 'sold-out';
        } else if (quantity > 0 && quantity < LOW_STOCK_THRESHOLD) {
          status = `Low stock : ${quantity} left`;
          console.log(`✅ Low stock : ${quantity} < ${LOW_STOCK_THRESHOLD}`);
        } else {
          status = 'In stock';
        }
      }

      const notifyBtn = (status === 'Sold out') ? `<button class="quick-add-drawer__notify-btn" title="Notify me when in stock">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2C6.2 2 3 5.2 3 9V11.5C3 14.5 1 16 1 16H19C19 16 17 14.5 17 11.5V9C17 5.2 13.8 2 10 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="8.5" y="16.5" width="3" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>
        <span>Notify me</span>
      </button>` : '';

      const cursorStyle = status !== 'Sold out' ? 'style="cursor: pointer;"' : '';

      return `<div class="quick-add-drawer__size-item ${soldClass}" data-size="${size}" ${cursorStyle}>
        <span class="quick-add-drawer__size-name">${size}</span>
        <span class="quick-add-drawer__size-status">
          <span class="quick-add-drawer__stock-status">${status}</span>
          ${notifyBtn}
        </span>
      </div>`;
    }).join('');

    sizeSection.style.setProperty('display', 'block', 'important');
    sizeSection.setAttribute('data-has-sizes', 'true');
  } else {
    sizeSection.style.display = 'none';
  }
}

function set(parent, selector, text) {
  const el = parent?.querySelector(selector);
  if (el) el.textContent = text;
}

function openDrawer() {
  const drawer = document.getElementById('quick-add-drawer');
  if (drawer) {
    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeDrawer() {
  const drawer = document.getElementById('quick-add-drawer');
  if (drawer) {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeOnOverlayOrButton(e) {
  const drawer = document.getElementById('quick-add-drawer');
  if (!drawer) return;

  if (e.target.closest('[data-drawer-close]') || e.target === drawer) {
    closeDrawer();
    return;
  }

  if (e.target.classList.contains('quick-add-drawer__color-option')) {
    e.target.parentElement?.querySelectorAll('.quick-add-drawer__color-option').forEach(b => {
      b.classList.remove('active');
    });

    e.target.classList.add('active');
    selectedColor = e.target.getAttribute('data-color');
    console.log('🎯 Color selected:', selectedColor);
    renderSizes(drawer);
  }

  if (e.target.closest('.quick-add-drawer__notify-btn')) {
    e.stopPropagation();
    const sizeItem = e.target.closest('.quick-add-drawer__size-item');
    const size = sizeItem?.getAttribute('data-size');
    const productTitle = drawer.querySelector('.drawer-product-title')?.textContent;
    openNotifyPopup(size, productTitle);
    return;
  }

  if (e.target.closest('.quick-add-drawer__size-item')) {
    const sizeItem = e.target.closest('.quick-add-drawer__size-item');
    const size = sizeItem.getAttribute('data-size');

    if (sizeItem.classList.contains('sold-out')) {
      const productTitle = drawer.querySelector('.drawer-product-title')?.textContent;
      openNotifyPopup(size, productTitle);
    } else {
      selectedSize = size;
      addToCart();
    }
  }
}

/* ========================================
   NOTIFY POPUP - Modal for Stock Notifications
   ======================================== */

function initNotifyPopup() {
  const popup = document.getElementById('notify-popup');
  if (!popup) return;

  document.body.appendChild(popup);

  document.querySelectorAll('[data-notify-close]').forEach(el => {
    el.addEventListener('click', closeNotifyPopup);
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.quick-add-drawer__notify-btn')) {
      const sizeItem = e.target.closest('.quick-add-drawer__size-item');
      if (sizeItem) {
        const sizeName = sizeItem.querySelector('.quick-add-drawer__size-name')?.textContent;
        openNotifyPopup(sizeName);
      }
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('.card__notify-btn')) {
      const card = e.target.closest('.product-card-wrapper');
      if (card) {
        const productTitle = card.querySelector('.card__heading')?.textContent?.trim();
        openNotifyPopup(null, productTitle);
      }
    }
  });

  const form = popup.querySelector('[data-notify-form]');
  if (form) {
    form.addEventListener('submit', handleNotifySubmit);
  }
}

function openNotifyPopup(size, cardProductTitle) {
  const popup = document.getElementById('notify-popup');
  if (!popup) return;

  const selectEl = popup.querySelector('[data-notify-variant]');
  const productTitle = popup.querySelector('[data-notify-product-title]');

  if (productTitle) {
    const title = cardProductTitle || document.querySelector('.drawer-product-title')?.textContent || 'Product';
    productTitle.textContent = title;
  }

  if (selectEl && size) {
    selectEl.innerHTML = `<option value="${size}" selected>${size}</option>`;
  } else if (selectEl && !size) {
    selectEl.innerHTML = '<option value="">Select size</option>';
  }

  popup.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeNotifyPopup() {
  const popup = document.getElementById('notify-popup');
  if (popup) {
    popup.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/* ========================================
   NOTIFY FORM - Validation & Submission
   ======================================== */

function handleNotifySubmit(e) {
  e.preventDefault();
  const popup = document.getElementById('notify-popup');
  const form = popup.querySelector('[data-notify-form]');
  const emailInput = form.querySelector('#notify-email');
  const button = form.querySelector('button[type="submit"]');
  const variant = form.querySelector('[data-notify-variant]').value;
  const email = emailInput.value.trim();

  if (!variant) {
    showNotifyError('Please select a size');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showNotifyError('Please enter a valid email address');
    emailInput.focus();
    return;
  }

  console.log('📬 Notify request:', { variant, email });

  button.disabled = true;
  button.textContent = 'Sending...';
  setTimeout(() => {
    showNotifySuccess(`We'll notify you at ${email} when this size is back in stock!`);
    button.disabled = false;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2C6.2 2 3 5.2 3 9V11.5C3 14.5 1 16 1 16H19C19 16 17 14.5 17 11.5V9C17 5.2 13.8 2 10 2Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="8.5" y="16.5" width="3" height="1.5" rx="0.75" fill="currentColor"/>
      </svg>
      <span>Notify me when available</span>
    `;

    setTimeout(() => {
      closeNotifyPopup();
      form.reset();
    }, 1500);
  }, 500);
}

function showNotifyError(message) {
  const popup = document.getElementById('notify-popup');
  const form = popup.querySelector('[data-notify-form]');

  const existingError = form.querySelector('.notify-error-message');
  if (existingError) existingError.remove();

  const errorEl = document.createElement('div');
  errorEl.className = 'notify-error-message';
  errorEl.textContent = message;
  errorEl.style.cssText = `
    color: #d32f2f;
    font-size: 13px;
    margin-top: 8px;
    font-family: Assistant;
  `;

  form.insertBefore(errorEl, form.querySelector('button'));
  setTimeout(() => errorEl.remove(), 4000);
}

function showNotifySuccess(message) {
  const popup = document.getElementById('notify-popup');
  const content = popup.querySelector('.notify-popup__content');

  const successEl = document.createElement('div');
  successEl.className = 'notify-success-message';
  successEl.textContent = message;
  successEl.style.cssText = `
    background: #e8f5e9;
    border: 1px solid #4caf50;
    color: #2e7d32;
    padding: 12px;
    border-radius: 4px;
    font-size: 13px;
    margin-bottom: 16px;
    font-family: Assistant;
    text-align: center;
  `;

  const form = content.querySelector('[data-notify-form]');
  form.parentNode.insertBefore(successEl, form);
}

/* ========================================
   CART OPERATIONS - Add to Cart & Feedback
   ======================================== */

function addToCart() {
  if (!selectedColor || !selectedSize) {
    console.error('❌ Color or size not selected');
    return;
  }

  const variant = productVariants.find(v => v.option1 === selectedColor && v.option2 === selectedSize);

  if (!variant || !variant.available) {
    alert('This variant is not available');
    return;
  }

  console.log('🛒 Adding to cart:', variant);

  fetch(window.Shopify.routes.root + 'cart/add.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{
        id: variant.id,
        quantity: 1
      }]
    })
  })
  .then(response => response.json())
  .then(data => {
    console.log('✅ Added to cart:', data);

    updateCartCount(data.item_count);

    if (variantInventory[variant.id] !== undefined && variantInventory[variant.id] > 0) {
      variantInventory[variant.id]--;
      renderSizes(document.getElementById('quick-add-drawer'));
      console.log(`📦 Stock updated: ${variant.title} now has ${variantInventory[variant.id]} left`);
    }

    showSuccessNotification(`${variant.title} added to cart!`);

    setTimeout(() => refreshInventory(), 1000);
    setTimeout(() => closeDrawer(), 1500);
  })
  .catch(err => {
    console.error('❌ Error adding to cart:', err);
    alert('Error adding to cart. Please try again.');
  });
}

function updateCartCount(count) {
  const cartBubble = document.querySelector('.cart-count-bubble span[aria-hidden="true"]');
  if (cartBubble) {
    cartBubble.textContent = count;
  }

  if (window.publish) {
    window.publish('cart-update', { item_count: count });
  }

  fetch(window.Shopify.routes.root + 'cart.js')
    .then(response => response.json())
    .then(cart => {
      const bubble = document.querySelector('.cart-count-bubble span[aria-hidden="true"]');
      if (bubble) {
        bubble.textContent = cart.item_count;
      }
      console.log('✅ Cart count updated:', cart.item_count);
    })
    .catch(err => console.error('Error fetching cart:', err));
}

function showSuccessNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #000;
    color: white;
    padding: 16px 24px;
    border-radius: 4px;
    z-index: 2000;
    font-family: Assistant;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/* ========================================
   INVENTORY - Real-time Updates
   ======================================== */

function refreshInventory() {
  if (!productVariants || !productVariants[0]) return;

  const drawer = document.getElementById('quick-add-drawer');
  const productDataEl = drawer.querySelector('[data-product]');
  if (!productDataEl) return;

  const productJson = productDataEl.getAttribute('data-product');
  if (!productJson) return;

  try {
    const product = JSON.parse(productJson);
    const handle = product.handle;

    fetch(`${window.Shopify.routes.root}products/${handle}.json`)
      .then(response => response.json())
      .then(data => {
        if (data.product && data.product.variants) {
          data.product.variants.forEach(variant => {
            variantInventory[variant.id] = variant.inventory_quantity || 0;
          });

          renderSizes(drawer);
          console.log('✅ Inventory refreshed from server');
        }
      })
      .catch(err => console.error('Error refreshing inventory:', err));
  } catch (e) {
    console.error('Error parsing product data:', e);
  }
}
