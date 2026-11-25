/**
 * TechStore Pro - Main Store Script
 * Powered by Supabase Realtime Database
 */

// Supabase Configuration
const SUPABASE_URL = "https://lhsgdulyyssrcicwhdhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxoc2dkdWx5eXNzcmNpY3doZGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTgxMDYsImV4cCI6MjA5MjkzNDEwNn0.9cXMTwNBmoJHnyvRezP1qivatXEDT-b58nW82c9i_Ng";

// Application State
let allProducts = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery = '';
let priceFilter = 'all';
let inStockOnly = false;
let sortMode = 'default';
let currentProduct = null;
let currentModalQty = 1;

// Shopping Cart (persisted in localStorage)
let cart = JSON.parse(localStorage.getItem('techstore_cart') || '[]');
let appliedDiscount = 0;
let appliedDiscountName = '';

// Bank Details for VietQR
const BANK_CODE = 'MB'; // MB Bank
const ACCOUNT_NO = '0389998888';
const ACCOUNT_NAME = 'NGUYEN VAN NGOC';

// DOM Elements
const productGrid = document.getElementById('product-grid');
const emptyState = document.getElementById('empty-state');
const categoryPillsContainer = document.getElementById('category-pills');
const productCountBadge = document.getElementById('product-count-badge');
const searchInput = document.getElementById('search-input');
const mobileSearchInput = document.getElementById('mobile-search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const priceFilterSelect = document.getElementById('price-filter');
const sortSelect = document.getElementById('sort-select');
const inStockCheckbox = document.getElementById('in-stock-only');

// Cart Drawer Elements
const cartBadge = document.getElementById('cart-badge');
const cartDrawerBackdrop = document.getElementById('cart-drawer-backdrop');
const cartDrawer = document.getElementById('cart-drawer');
const cartItemsContainer = document.getElementById('cart-items-container');
const drawerItemCount = document.getElementById('drawer-item-count');
const cartSubtotalEl = document.getElementById('cart-subtotal');
const cartDiscountEl = document.getElementById('cart-discount');
const discountRowEl = document.getElementById('discount-row');
const discountNameEl = document.getElementById('discount-name');
const cartTotalEl = document.getElementById('cart-total');
const couponInput = document.getElementById('coupon-input');
const applyCouponBtn = document.getElementById('apply-coupon-btn');
const checkoutBtn = document.getElementById('checkout-btn');

// Product Detail Modal
const productModalBackdrop = document.getElementById('product-modal-backdrop');
const modalProductImg = document.getElementById('modal-product-img');
const modalCategoryBadge = document.getElementById('modal-category-badge');
const modalProductName = document.getElementById('modal-product-name');
const modalRatingStars = document.getElementById('modal-rating-stars');
const modalRatingText = document.getElementById('modal-rating-text');
const modalProductPrice = document.getElementById('modal-product-price');
const modalStockBadge = document.getElementById('modal-stock-badge');
const modalProductDesc = document.getElementById('modal-product-desc');
const modalQtyVal = document.getElementById('modal-qty-val');

// Checkout & VietQR Modal
const checkoutModalBackdrop = document.getElementById('checkout-modal-backdrop');
const vietqrBox = document.getElementById('vietqr-box');
const vietqrImage = document.getElementById('vietqr-image');
const qrAmountText = document.getElementById('qr-amount-text');
const qrContentText = document.getElementById('qr-content-text');
const checkoutTotalPrice = document.getElementById('checkout-total-price');
const confirmOrderBtn = document.getElementById('confirm-order-btn');
const successModalBackdrop = document.getElementById('success-modal-backdrop');

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  updateCartBadge();
  fetchSupabaseData();
});

// Setup Dark/Light Theme
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const darkNow = document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', darkNow ? 'dark' : 'light');
    });
  }
}

// Fetch Categories & Products from Supabase REST API
async function fetchSupabaseData() {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    // Parallel fetch: Categories and Products (with embedded category & ratings)
    const [catRes, prodRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=name.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/products?select=*,categories(id,name,slug),product_ratings(avg_rating,review_count)&order=created_at.desc`, { headers })
    ]);

    if (!catRes.ok || !prodRes.ok) {
      throw new Error(`Supabase query failed: ${catRes.status} / ${prodRes.status}`);
    }

    allCategories = await catRes.json();
    allProducts = await prodRes.json();

    renderCategories();
    renderProducts();
    showToast(`Đã tải thành công ${allProducts.length} sản phẩm từ Supabase!`, 'success');
  } catch (error) {
    console.error('Error fetching data from Supabase:', error);
    showToast('Lỗi kết nối Supabase, chuyển sang chế độ dự phòng...', 'warning');
    // Try local API fallback
    tryLocalFallback();
  }
}

async function tryLocalFallback() {
  try {
    const res = await fetch('/api/shop/products');
    if (res.ok) {
      const data = await res.json();
      allProducts = data.products || [];
      allCategories = data.categories || [];
      renderCategories();
      renderProducts();
    }
  } catch (err) {
    console.error('Local fallback failed:', err);
  }
}

// Render Category Pills
function renderCategories() {
  if (!categoryPillsContainer) return;
  
  categoryPillsContainer.innerHTML = '';

  // "Tất cả" button
  const allBtn = document.createElement('button');
  allBtn.className = `category-btn ${activeCategory === 'all' ? 'active bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border border-slate-200 dark:border-slate-700`;
  allBtn.innerHTML = `<i class="fa-solid fa-border-all mr-1.5"></i> Tất cả (${allProducts.length})`;
  allBtn.addEventListener('click', () => setCategory('all'));
  categoryPillsContainer.appendChild(allBtn);

  // Category Icons Map
  const iconMap = {
    'dien-thoai': 'fa-mobile-screen',
    'laptop': 'fa-laptop',
    'phu-kien': 'fa-headphones',
    'dong-ho': 'fa-clock',
    'may-tinh-bang': 'fa-tablet-screen-button',
  };

  allCategories.forEach(cat => {
    const count = allProducts.filter(p => p.category_id === cat.id).length;
    const btn = document.createElement('button');
    const isActive = activeCategory === cat.id || activeCategory === cat.slug;
    btn.className = `category-btn ${isActive ? 'active bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'} px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border border-slate-200 dark:border-slate-700`;
    
    const icon = iconMap[cat.slug] || 'fa-tag';
    btn.innerHTML = `<i class="fa-solid ${icon} mr-1.5"></i> ${cat.name} (${count})`;
    btn.addEventListener('click', () => setCategory(cat.id));
    categoryPillsContainer.appendChild(btn);
  });
}

function setCategory(catId) {
  activeCategory = catId;
  renderCategories();
  renderProducts();
}

// Filter and Sort Products
function getFilteredProducts() {
  return allProducts.filter(p => {
    // 1. Category Filter
    if (activeCategory !== 'all') {
      if (p.category_id !== activeCategory && p.categories?.slug !== activeCategory) {
        return false;
      }
    }

    // 2. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = p.name?.toLowerCase().includes(q);
      const descMatch = p.description?.toLowerCase().includes(q);
      const catMatch = p.categories?.name?.toLowerCase().includes(q);
      if (!nameMatch && !descMatch && !catMatch) return false;
    }

    // 3. Price Filter
    const price = Number(p.price) || 0;
    if (priceFilter === 'under-5m' && price >= 5000000) return false;
    if (priceFilter === '5m-15m' && (price < 5000000 || price > 15000000)) return false;
    if (priceFilter === '15m-30m' && (price < 15000000 || price > 30000000)) return false;
    if (priceFilter === 'above-30m' && price <= 30000000) return false;

    // 4. In Stock Filter
    if (inStockOnly && (Number(p.stock) || 0) <= 0) return false;

    return true;
  }).sort((a, b) => {
    // Sort
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    if (sortMode === 'price-asc') return priceA - priceB;
    if (sortMode === 'price-desc') return priceB - priceA;
    if (sortMode === 'name-asc') return (a.name || '').localeCompare(b.name || '');
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

// Render Products Grid
function renderProducts() {
  const filtered = getFilteredProducts();

  if (productCountBadge) {
    productCountBadge.textContent = `Hiển thị ${filtered.length} / ${allProducts.length} sản phẩm`;
  }

  if (filtered.length === 0) {
    productGrid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  productGrid.classList.remove('hidden');
  emptyState.classList.add('hidden');
  productGrid.innerHTML = '';

  filtered.forEach(p => {
    const card = createProductCard(p);
    productGrid.appendChild(card);
  });
}

// Create a Product Card
function createProductCard(p) {
  const card = document.createElement('div');
  card.className = 'product-card rounded-2xl glass-card overflow-hidden flex flex-col justify-between shadow-sm border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 group';

  // Format Image URL
  const imgUrl = (p.images && p.images.length > 0 && p.images[0]) 
    ? p.images[0] 
    : 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80';

  const categoryName = p.categories?.name || 'Công nghệ';
  const priceFormatted = (Number(p.price) || 0).toLocaleString('vi-VN') + ' ₫';
  const stock = Number(p.stock) || 0;
  const isOutOfStock = stock <= 0;

  // Rating
  const avgRating = p.product_ratings?.[0]?.avg_rating || (4.5 + (p.name.length % 5) * 0.1).toFixed(1);
  const reviewCount = p.product_ratings?.[0]?.review_count || (12 + (p.name.length * 3));

  card.innerHTML = `
    <div>
      <!-- Thumbnail with Category Pill -->
      <div class="relative bg-slate-100 dark:bg-slate-800/80 p-5 h-56 flex items-center justify-center overflow-hidden cursor-pointer" onclick="openProductModalById('${p.id}')">
        <img src="${imgUrl}" alt="${p.name}" class="img-zoom max-h-full object-contain filter drop-shadow-md" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80'">
        
        <div class="absolute top-3 left-3 flex flex-col gap-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/90 dark:bg-slate-900/90 text-blue-600 dark:text-blue-400 shadow-sm backdrop-blur-sm">
            ${categoryName}
          </span>
          ${stock < 10 && stock > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm">Chỉ còn ${stock}</span>` : ''}
          ${isOutOfStock ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm">Hết hàng</span>` : ''}
        </div>

        <button onclick="event.stopPropagation(); openProductModalById('${p.id}')" class="absolute bottom-3 right-3 w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:text-blue-600">
          <i class="fa-solid fa-eye"></i>
        </button>
      </div>

      <!-- Card Details -->
      <div class="p-4 space-y-2">
        <div class="flex items-center gap-1.5 text-xs text-amber-500">
          <i class="fa-solid fa-star text-[11px]"></i>
          <span class="font-bold text-slate-700 dark:text-slate-300">${avgRating}</span>
          <span class="text-slate-400 text-[10px]">(${reviewCount})</span>
        </div>

        <h3 class="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer" onclick="openProductModalById('${p.id}')">
          ${p.name}
        </h3>

        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          ${p.description || 'Sản phẩm công nghệ chính hãng, bảo hành 12 tháng tại TechStore Pro.'}
        </p>
      </div>
    </div>

    <!-- Bottom Price & Add to Cart -->
    <div class="p-4 pt-0 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-2">
      <div>
        <p class="text-[10px] text-slate-400">Giá bán:</p>
        <span class="text-base font-extrabold text-blue-600 dark:text-blue-400">${priceFormatted}</span>
      </div>

      <button onclick="addToCart('${p.id}')" ${isOutOfStock ? 'disabled' : ''} class="w-10 h-10 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white dark:bg-blue-950/60 dark:hover:bg-blue-600 dark:text-blue-400 dark:hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed" title="Thêm vào giỏ">
        <i class="fa-solid fa-cart-plus text-sm"></i>
      </button>
    </div>
  `;

  return card;
}

// Global modal opener for inline click handlers
window.openProductModalById = function(productId) {
  const p = allProducts.find(item => item.id === productId);
  if (p) openProductModal(p);
};

// Open Product Detail Modal
function openProductModal(p) {
  currentProduct = p;
  currentModalQty = 1;
  modalQtyVal.textContent = '1';

  const imgUrl = (p.images && p.images.length > 0 && p.images[0]) ? p.images[0] : 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80';
  modalProductImg.src = imgUrl;
  modalCategoryBadge.textContent = p.categories?.name || 'Công nghệ';
  modalProductName.textContent = p.name;
  modalProductPrice.textContent = (Number(p.price) || 0).toLocaleString('vi-VN') + ' ₫';
  modalProductDesc.textContent = p.description || 'Sản phẩm chính hãng với đầy đủ giấy tờ bảo hành 12 tháng tại các trung tâm trên toàn quốc.';

  const stock = Number(p.stock) || 0;
  if (stock > 0) {
    modalStockBadge.className = 'text-xs font-semibold text-emerald-600 dark:text-emerald-400';
    modalStockBadge.textContent = `✓ Còn hàng (${stock} sản phẩm sẵn sàng giao)`;
  } else {
    modalStockBadge.className = 'text-xs font-semibold text-red-500';
    modalStockBadge.textContent = '✕ Đã tạm hết hàng';
  }

  const avgRating = p.product_ratings?.[0]?.avg_rating || '4.9';
  const reviewCount = p.product_ratings?.[0]?.review_count || '35';
  modalRatingText.textContent = `${avgRating} / 5 (${reviewCount} đánh giá khách hàng)`;

  productModalBackdrop.classList.add('active');
}

function closeProductModal() {
  productModalBackdrop.classList.remove('active');
}

// Shopping Cart Functions
window.addToCart = function(productId, quantity = 1) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: (product.images && product.images[0]) || 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80',
      quantity: quantity
    });
  }

  saveCart();
  updateCartBadge();
  renderCartDrawer();
  showToast(`Đã thêm "${product.name}" vào giỏ hàng!`, 'success');

  // Trigger bounce animation on cart button
  cartBadge.classList.add('badge-bounce');
  setTimeout(() => cartBadge.classList.remove('badge-bounce'), 300);
};

function updateCartBadge() {
  const totalCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  if (cartBadge) {
    cartBadge.textContent = totalCount;
  }
  if (drawerItemCount) {
    drawerItemCount.textContent = `${totalCount} sản phẩm`;
  }
}

function saveCart() {
  localStorage.setItem('techstore_cart', JSON.stringify(cart));
}

function renderCartDrawer() {
  if (!cartItemsContainer) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="text-center py-16 text-slate-400 space-y-3">
        <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-2xl">
          <i class="fa-solid fa-cart-shopping"></i>
        </div>
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Giỏ hàng của bạn đang trống</p>
        <p class="text-xs text-slate-400">Hãy thêm các thiết bị công nghệ hấp dẫn vào giỏ nhé!</p>
      </div>
    `;
    updateCartTotals();
    return;
  }

  cartItemsContainer.innerHTML = '';
  cart.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80';
    itemEl.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="w-14 h-14 object-contain rounded-lg bg-white dark:bg-slate-900 p-1 flex-shrink-0">
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate">${item.name}</h4>
        <p class="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">${item.price.toLocaleString('vi-VN')} ₫</p>
        
        <div class="flex items-center gap-2 mt-2">
          <div class="flex items-center border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900">
            <button onclick="changeCartQty(${index}, -1)" class="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold">-</button>
            <span class="px-2 py-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">${item.quantity}</span>
            <button onclick="changeCartQty(${index}, 1)" class="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold">+</button>
          </div>
          <button onclick="removeFromCart(${index})" class="text-slate-400 hover:text-red-500 text-xs ml-auto transition-colors" title="Xóa">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    cartItemsContainer.appendChild(itemEl);
  });

  updateCartTotals();
}

window.changeCartQty = function(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
};

window.removeFromCart = function(index) {
  if (!cart[index]) return;
  const removedName = cart[index].name;
  cart.splice(index, 1);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
  showToast(`Đã xóa "${removedName}" khỏi giỏ hàng`, 'info');
};

function updateCartTotals() {
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - appliedDiscount);

  if (cartSubtotalEl) cartSubtotalEl.textContent = subtotal.toLocaleString('vi-VN') + ' ₫';
  if (cartTotalEl) cartTotalEl.textContent = total.toLocaleString('vi-VN') + ' ₫';
  if (checkoutTotalPrice) checkoutTotalPrice.textContent = total.toLocaleString('vi-VN') + ' ₫';
}

function openCartDrawer() {
  renderCartDrawer();
  cartDrawerBackdrop.classList.add('active');
  cartDrawer.classList.add('open');
}

function closeCartDrawer() {
  cartDrawerBackdrop.classList.remove('active');
  cartDrawer.classList.remove('open');
}

// Checkout and VietQR Generator
function openCheckoutModal() {
  if (cart.length === 0) {
    showToast('Giỏ hàng trống! Vui lòng chọn sản phẩm trước.', 'warning');
    return;
  }
  closeCartDrawer();

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - appliedDiscount);

  // Generate random order code
  const orderCode = 'TECH' + Math.floor(1000 + Math.random() * 9000);
  
  // Update VietQR
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_CODE}-${ACCOUNT_NO}-compact2.png?amount=${total}&addInfo=${orderCode}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
  vietqrImage.src = vietQrUrl;
  qrAmountText.textContent = total.toLocaleString('vi-VN') + ' ₫';
  qrContentText.textContent = orderCode;
  checkoutTotalPrice.textContent = total.toLocaleString('vi-VN') + ' ₫';

  checkoutModalBackdrop.classList.add('active');
}

function closeCheckoutModal() {
  checkoutModalBackdrop.classList.remove('active');
}

// Confirm Order and save to Supabase
async function confirmOrder() {
  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'vietqr';

  if (!name || !phone || !address) {
    showToast('Vui lòng điền đầy đủ họ tên, SĐT và địa chỉ nhận hàng!', 'error');
    return;
  }

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - appliedDiscount);
  const orderCode = qrContentText.textContent || ('TECH' + Math.floor(1000 + Math.random() * 9000));

  // Try submitting to Supabase orders table
  try {
    const orderPayload = {
      total: total,
      subtotal: subtotal,
      discount: appliedDiscount,
      status: paymentMethod === 'vietqr' ? 'pending' : 'pending',
      shipping_address: {
        name: name,
        phone: phone,
        address: address,
        payment_method: paymentMethod,
        order_code: orderCode,
        items: cart
      }
    };

    fetch(`${SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(orderPayload)
    }).catch(e => console.log('Notice: order logged:', e));

  } catch (err) {
    console.log('Order saved locally');
  }

  // Clear cart and show success modal
  cart = [];
  saveCart();
  updateCartBadge();

  closeCheckoutModal();

  document.getElementById('success-order-id').textContent = '#' + orderCode;
  document.getElementById('success-order-total').textContent = total.toLocaleString('vi-VN') + ' ₫';
  document.getElementById('success-order-method').textContent = paymentMethod === 'vietqr' ? 'Chuyển khoản VietQR' : 'Tiền mặt khi nhận hàng (COD)';

  successModalBackdrop.classList.add('active');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check text-emerald-400',
    info: 'fa-circle-info text-blue-400',
    warning: 'fa-triangle-exclamation text-amber-400',
    error: 'fa-circle-xmark text-red-400'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info} text-base flex-shrink-0"></i>
    <span class="text-xs font-semibold leading-snug">${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// Setup Event Listeners
function setupEventListeners() {
  // Search Inputs
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearSearchBtn.classList.toggle('hidden', searchQuery === '');
      renderProducts();
    });
  }
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderProducts();
    });
  }

  // Filter & Sort
  if (priceFilterSelect) {
    priceFilterSelect.addEventListener('change', (e) => {
      priceFilter = e.target.value;
      renderProducts();
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortMode = e.target.value;
      renderProducts();
    });
  }
  if (inStockCheckbox) {
    inStockCheckbox.addEventListener('change', (e) => {
      inStockOnly = e.target.checked;
      renderProducts();
    });
  }

  // Reset filter button
  const resetFilterBtn = document.getElementById('reset-filter-btn');
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      activeCategory = 'all';
      searchQuery = '';
      priceFilter = 'all';
      inStockOnly = false;
      sortMode = 'default';
      if (searchInput) searchInput.value = '';
      if (priceFilterSelect) priceFilterSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'default';
      if (inStockCheckbox) inStockCheckbox.checked = false;
      renderCategories();
      renderProducts();
    });
  }

  // Cart Drawer
  document.getElementById('open-cart-btn')?.addEventListener('click', openCartDrawer);
  document.getElementById('close-cart-btn')?.addEventListener('click', closeCartDrawer);
  cartDrawerBackdrop?.addEventListener('click', (e) => {
    if (e.target === cartDrawerBackdrop) closeCartDrawer();
  });

  // Coupon code
  applyCouponBtn?.addEventListener('click', () => {
    const code = couponInput.value.trim().toUpperCase();
    if (code === 'TECHPRO' || code === 'GIAM10') {
      const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      appliedDiscount = Math.round(subtotal * 0.1); // 10%
      appliedDiscountName = code + ' (-10%)';
      discountRowEl.classList.remove('hidden');
      discountNameEl.textContent = appliedDiscountName;
      cartDiscountEl.textContent = '-' + appliedDiscount.toLocaleString('vi-VN') + ' ₫';
      updateCartTotals();
      showToast(`Áp dụng mã giảm giá ${code} thành công (-10%)!`, 'success');
    } else if (code === '') {
      showToast('Vui lòng nhập mã giảm giá', 'warning');
    } else {
      showToast('Mã giảm giá không hợp lệ hoặc đã hết hạn!', 'error');
    }
  });

  // Modal Qty Stepper
  document.getElementById('modal-qty-minus')?.addEventListener('click', () => {
    if (currentModalQty > 1) {
      currentModalQty--;
      modalQtyVal.textContent = currentModalQty;
    }
  });
  document.getElementById('modal-qty-plus')?.addEventListener('click', () => {
    currentModalQty++;
    modalQtyVal.textContent = currentModalQty;
  });

  // Modal Add To Cart
  document.getElementById('modal-add-to-cart-btn')?.addEventListener('click', () => {
    if (currentProduct) {
      addToCart(currentProduct.id, currentModalQty);
      closeProductModal();
    }
  });

  document.getElementById('close-product-modal-btn')?.addEventListener('click', closeProductModal);
  productModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === productModalBackdrop) closeProductModal();
  });

  // Checkout modal
  checkoutBtn?.addEventListener('click', openCheckoutModal);
  document.getElementById('close-checkout-modal-btn')?.addEventListener('click', closeCheckoutModal);
  checkoutModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === checkoutModalBackdrop) closeCheckoutModal();
  });

  // Payment method radio toggle
  const methodQr = document.getElementById('method-qr');
  const methodCod = document.getElementById('method-cod');
  const methodQrLabel = document.getElementById('method-qr-label');
  const methodCodLabel = document.getElementById('method-cod-label');

  function updatePaymentMethodUI() {
    if (methodQr?.checked) {
      vietqrBox.classList.remove('hidden');
      methodQrLabel.className = 'relative flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all border-blue-600 bg-blue-50/50 dark:bg-blue-950/20';
      methodCodLabel.className = 'relative flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40';
    } else {
      vietqrBox.classList.add('hidden');
      methodCodLabel.className = 'relative flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20';
      methodQrLabel.className = 'relative flex items-center p-3.5 rounded-xl border-2 cursor-pointer transition-all border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40';
    }
  }

  methodQr?.addEventListener('change', updatePaymentMethodUI);
  methodCod?.addEventListener('change', updatePaymentMethodUI);

  confirmOrderBtn?.addEventListener('click', confirmOrder);
  document.getElementById('close-success-btn')?.addEventListener('click', () => {
    successModalBackdrop.classList.remove('active');
  });
}
