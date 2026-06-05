/* ==========================================================================
   Gaya Ji Traders E-Commerce Client - Core JavaScript Application
   ========================================================================== */

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : (window.location.origin.startsWith('http') ? '/api' : 'http://localhost:5000/api');

// --- Application State ---
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  cart: JSON.parse(localStorage.getItem('cart')) || [],
  wishlist: JSON.parse(localStorage.getItem('wishlist')) || [],
  notifications: [],
  activeCoupon: JSON.parse(localStorage.getItem('activeCoupon')) || null,
  products: [],
  categories: ['all', 'kitchen appliances', 'home appliances', 'smart living'],
  activeCategory: 'all',
  sortBy: 'default',
  searchQuery: ''
};

// --- API Client Wrapper ---
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = {
    method,
    headers
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      // Auto logout if auth expires
      if (response.status === 401 || response.status === 403) {
        if (state.token) {
          showToast('Session expired. Please log in again.', 'error');
          logout();
        }
      }
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error);
    throw error;
  }
}

// --- Toast System Alerts ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'info') icon = 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-content">${message}</div>
    <button class="toast-close">&times;</button>
  `;

  // Close toast trigger
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.animation = 'fadeOut 0.2s forwards';
    setTimeout(() => toast.remove(), 200);
  });

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'fadeOut 0.2s forwards';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}

// --- Auth Utilities ---
function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  updateNavigation();
  pollNotifications();
}

function logout() {
  state.token = null;
  state.user = null;
  state.activeCoupon = null;
  state.cart = [];
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('activeCoupon');
  localStorage.removeItem('cart');
  
  showToast('Logged out successfully', 'info');
  updateNavigation();
  window.location.hash = '#shop';
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const userProfile = await apiCall('/auth/me');
    state.user = userProfile;
    localStorage.setItem('user', JSON.stringify(userProfile));
    updateNavigation();
  } catch (error) {
    console.error('Error refreshing profile:', error);
  }
}

// --- Routing & Navigation ---
const routes = {
  '#shop': renderShopView,
  '#product': renderProductDetailView, // handles dynamic id
  '#login': renderLoginView,
  '#register': renderRegisterView,
  '#checkout': renderCheckoutView,
  '#orders': renderOrdersView,
  '#profile': renderProfileView,
  '#admin': renderAdminView,
  '#delivery': renderDeliveryView
};

function router() {
  const hash = window.location.hash || '#shop';
  const mainViews = document.querySelectorAll('.spa-view');
  
  // Close any overlay drawers/menus on route change
  document.getElementById('cart-drawer').classList.add('d-none');
  document.getElementById('cart-overlay').classList.add('d-none');
  document.getElementById('wishlist-drawer').classList.add('d-none');
  document.getElementById('wishlist-overlay').classList.add('d-none');
  document.getElementById('user-dropdown').classList.add('d-none');
  document.getElementById('notification-dropdown').classList.add('d-none');

  // Parse path and params
  let targetView = hash;
  let paramId = null;

  if (hash.startsWith('#product/')) {
    targetView = '#product';
    paramId = hash.split('/')[1];
  }

  // Auth Guardchecks (Mandatory Login Wall)
  if (!state.token && targetView !== '#login' && targetView !== '#register') {
    window.location.hash = '#login';
    return;
  }

  if (targetView === '#admin' && (!state.user || state.user.role !== 'admin')) {
    window.location.hash = '#shop';
    return;
  }

  if (targetView === '#delivery' && (!state.user || state.user.role !== 'delivery')) {
    window.location.hash = '#shop';
    return;
  }

  // Toggles SPA view containers visibility
  mainViews.forEach(view => view.classList.add('d-none'));

  const activeViewEl = document.querySelector(`.spa-view[id="view-${targetView.substring(1)}"]`);
  if (activeViewEl) {
    activeViewEl.classList.remove('d-none');
    
    // Highlight nav
    document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === targetView) {
        item.classList.add('active');
      }
    });

    // Highlight mobile bottom nav
    document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href') === targetView) {
        item.classList.add('active');
      }
    });

    // Execute route renderer
    const routeHandler = routes[targetView];
    if (routeHandler) {
      routeHandler(paramId);
    }
  } else {
    // Page not found -> Redirect to Shop
    window.location.hash = '#shop';
  }
}

// Update Header Navigation elements depending on user role
function updateNavigation() {
  const guestMenu = document.getElementById('user-guest-menu');
  const authMenu = document.getElementById('user-auth-menu');
  const userDisplayName = document.getElementById('user-display-name');
  const userInitials = document.getElementById('user-avatar-initials');
  const dropdownFullName = document.getElementById('dropdown-full-name');
  const dropdownRole = document.getElementById('dropdown-role');
  const notifBadge = document.getElementById('notif-badge');

  // Hide all conditional nav items first
  document.querySelectorAll('.customer-only').forEach(el => el.classList.add('d-none'));
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('d-none'));
  document.querySelectorAll('.delivery-only').forEach(el => el.classList.add('d-none'));

  if (state.token && state.user) {
    // Logged in
    guestMenu.classList.add('d-none');
    authMenu.classList.remove('d-none');
    
    userDisplayName.textContent = state.user.name.split(' ')[0];
    userInitials.textContent = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    dropdownFullName.textContent = state.user.name;
    dropdownRole.textContent = state.user.role;

    // Show menu links based on role
    if (state.user.role === 'customer') {
      document.querySelectorAll('.customer-only').forEach(el => el.classList.remove('d-none'));
    } else if (state.user.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
    } else if (state.user.role === 'delivery') {
      document.querySelectorAll('.delivery-only').forEach(el => el.classList.remove('d-none'));
    }
  } else {
    // Guest
    guestMenu.classList.remove('d-none');
    authMenu.classList.add('d-none');
    userDisplayName.textContent = 'Guest';
    userInitials.textContent = 'G';
    notifBadge.classList.add('d-none');
  }

  // Update header search box visibility
  const searchBox = document.getElementById('header-search-container');
  const hash = window.location.hash || '#shop';
  if (hash.startsWith('#shop') || hash === '') {
    searchBox.classList.remove('d-none');
  } else {
    searchBox.classList.add('d-none');
  }

  renderCartSummary();
  updateWishlistBadge();
}

// --- Cart Operations ---
function addToCart(product, quantity = 1) {
  const existingItem = state.cart.find(item => item.productId === product._id);
  
  if (existingItem) {
    const newQty = existingItem.quantity + quantity;
    if (newQty > product.stock) {
      showToast(`Cannot add more. Only ${product.stock} units available in stock.`, 'error');
      return;
    }
    existingItem.quantity = newQty;
  } else {
    if (quantity > product.stock) {
      showToast(`Only ${product.stock} units available.`, 'error');
      return;
    }
    state.cart.push({
      product,
      productId: product._id,
      quantity
    });
  }

  // If coupon is active, validate coupon against new cart total
  if (state.activeCoupon) {
    validateActiveCoupon();
  }

  saveCart();
  showToast(`${product.name} added to basket!`, 'success');
}

function updateCartQuantity(productId, newQty) {
  const item = state.cart.find(i => i.productId === productId);
  if (!item) return;

  if (newQty <= 0) {
    state.cart = state.cart.filter(i => i.productId !== productId);
    showToast(`${item.product.name} removed from basket.`, 'info');
  } else if (newQty > item.product.stock) {
    showToast(`Insufficient stock. Only ${item.product.stock} available.`, 'error');
    return;
  } else {
    item.quantity = newQty;
  }

  if (state.activeCoupon) {
    validateActiveCoupon();
  }

  saveCart();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  renderCartSummary();
  renderCartDrawer();
  // Update checkout page if active
  if (window.location.hash === '#checkout') {
    renderCheckoutView();
  }
}

function renderCartSummary() {
  const cartBadge = document.getElementById('cart-badge');
  const cartCount = document.getElementById('cart-count');
  const cartTotalHeader = document.querySelector('.cart-total-header');

  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  cartBadge.textContent = totalItems;
  cartCount.textContent = totalItems;

  const discount = state.activeCoupon ? state.activeCoupon.discount : 0;
  const grandTotal = Math.max(0, subtotal - discount);

  cartTotalHeader.textContent = `₹${grandTotal}`;
  if (totalItems > 0) {
    cartTotalHeader.classList.remove('d-none');
  } else {
    cartTotalHeader.classList.add('d-none');
  }
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items-container');
  const footer = document.getElementById('cart-footer');
  const subtotalEl = document.getElementById('cart-subtotal');
  const grandTotalEl = document.getElementById('cart-grand-total');
  const discountRow = document.getElementById('discount-row');
  const discountEl = document.getElementById('cart-discount');
  
  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty-state">
        <i class="fa-solid fa-basket-shopping"></i>
        <p>Your basket is empty!</p>
        <a href="#shop" class="btn btn-primary" id="start-shopping-btn">Start Shopping</a>
      </div>
    `;
    footer.classList.add('d-none');
    
    // Close Drawer when shopping button clicked
    const startShopBtn = container.querySelector('#start-shopping-btn');
    if (startShopBtn) {
      startShopBtn.addEventListener('click', () => {
        document.getElementById('cart-drawer').classList.add('d-none');
        document.getElementById('cart-overlay').classList.add('d-none');
      });
    }
    return;
  }

  footer.classList.remove('d-none');
  
  container.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <img src="${item.product.imageUrl}" alt="${item.product.name}" class="cart-item-img">
      <div class="cart-item-info">
        <h4>${item.product.name}</h4>
        <div class="cart-item-price">₹${item.product.price} / unit</div>
        <div class="cart-item-actions">
          <div class="qty-counter">
            <button class="qty-btn dec-qty" data-id="${item.productId}"><i class="fa-solid fa-minus"></i></button>
            <span class="qty-val">${item.quantity}</span>
            <button class="qty-btn inc-qty" data-id="${item.productId}"><i class="fa-solid fa-plus"></i></button>
          </div>
          <button class="remove-item-btn" data-id="${item.productId}"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    </div>
  `).join('');

  // Cart Subtotal & Coupon Logic Calculations
  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  subtotalEl.textContent = `₹${subtotal}`;

  // Apply Active Coupon Calculation
  let discount = 0;
  if (state.activeCoupon) {
    discount = state.activeCoupon.discount;
    discountRow.classList.remove('d-none');
    discountEl.textContent = `-₹${discount}`;
    
    // Render coupon badge
    document.getElementById('active-coupon-badge').classList.remove('d-none');
    document.getElementById('applied-code-text').textContent = state.activeCoupon.code;
    document.getElementById('coupon-input').value = '';
    document.getElementById('coupon-message').textContent = '';
  } else {
    discountRow.classList.add('d-none');
    document.getElementById('active-coupon-badge').classList.add('d-none');
  }

  const grandTotal = Math.max(0, subtotal - discount);
  grandTotalEl.textContent = `₹${grandTotal}`;

  // Hook event handlers
  container.querySelectorAll('.dec-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const item = state.cart.find(i => i.productId === id);
      updateCartQuantity(id, item.quantity - 1);
    });
  });

  container.querySelectorAll('.inc-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const item = state.cart.find(i => i.productId === id);
      updateCartQuantity(id, item.quantity + 1);
    });
  });

  container.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      updateCartQuantity(e.currentTarget.dataset.id, 0);
    });
  });
}

// Coupon validation
async function applyCoupon() {
  const input = document.getElementById('coupon-input');
  const code = input.value.trim().toUpperCase();
  const msgEl = document.getElementById('coupon-message');

  if (!state.token) {
    showToast('Please login to apply coupons.', 'info');
    window.location.hash = '#login';
    return;
  }

  if (!code) {
    msgEl.className = 'coupon-message error';
    msgEl.textContent = 'Please enter a coupon code';
    return;
  }

  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  try {
    const res = await apiCall('/orders/coupon/validate', 'POST', {
      code,
      cartSubtotal: subtotal
    });

    state.activeCoupon = {
      code: res.code,
      type: res.type,
      value: res.value,
      discount: res.discount
    };
    localStorage.setItem('activeCoupon', JSON.stringify(state.activeCoupon));
    
    showToast(`Coupon ${code} applied successfully!`, 'success');
    renderCartDrawer();
    renderCartSummary();
  } catch (err) {
    msgEl.className = 'coupon-message error';
    msgEl.textContent = err.message;
  }
}

async function validateActiveCoupon() {
  if (!state.activeCoupon) return;
  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  try {
    const res = await apiCall('/orders/coupon/validate', 'POST', {
      code: state.activeCoupon.code,
      cartSubtotal: subtotal
    });
    // Update discount
    state.activeCoupon.discount = res.discount;
    localStorage.setItem('activeCoupon', JSON.stringify(state.activeCoupon));
  } catch (err) {
    // Coupon invalid now (e.g. subtotal fell below minPurchase)
    showToast(`Coupon ${state.activeCoupon.code} removed: ${err.message}`, 'info');
    state.activeCoupon = null;
    localStorage.removeItem('activeCoupon');
  }
}

function removeCoupon() {
  state.activeCoupon = null;
  localStorage.removeItem('activeCoupon');
  showToast('Coupon removed.', 'info');
  renderCartDrawer();
  renderCartSummary();
}

// --- Wishlist Operations ---
function isInWishlist(productId) {
  return state.wishlist.some(item => item._id === productId);
}

function toggleWishlist(product) {
  const exists = isInWishlist(product._id);
  if (exists) {
    state.wishlist = state.wishlist.filter(item => item._id !== product._id);
    showToast(`${product.name} removed from wishlist`, 'info');
  } else {
    state.wishlist.push(product);
    showToast(`${product.name} added to wishlist!`, 'success');
  }
  localStorage.setItem('wishlist', JSON.stringify(state.wishlist));
  updateWishlistBadge();
  renderWishlistDrawer();
  
  // Re-render current page/catalog to update heart icons
  const hash = window.location.hash || '#shop';
  if (hash.startsWith('#shop') || hash === '') {
    renderShopView();
  } else if (hash.startsWith('#product/')) {
    const id = hash.split('/')[1];
    renderProductDetailView(id);
  }
}

function updateWishlistBadge() {
  const badge = document.getElementById('wishlist-badge');
  if (badge) {
    badge.textContent = state.wishlist.length;
  }
}

function renderWishlistDrawer() {
  const container = document.getElementById('wishlist-items-container');
  const countEl = document.getElementById('wishlist-count');
  
  if (countEl) {
    countEl.textContent = state.wishlist.length;
  }
  
  if (state.wishlist.length === 0) {
    container.innerHTML = `
      <div class="wishlist-empty-state">
        <i class="fa-solid fa-heart-crack"></i>
        <p>Your wishlist is empty!</p>
        <button class="btn btn-primary" id="wishlist-start-shopping-btn">Start Shopping</button>
      </div>
    `;
    
    const startBtn = container.querySelector('#wishlist-start-shopping-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        document.getElementById('wishlist-drawer').classList.add('d-none');
        document.getElementById('wishlist-overlay').classList.add('d-none');
        window.location.hash = '#shop';
      });
    }
    return;
  }

  container.innerHTML = state.wishlist.map(product => `
    <div class="wishlist-item">
      <img src="${product.imageUrl}" alt="${product.name}" class="wishlist-item-img">
      <div class="wishlist-item-info">
        <h4>${product.name}</h4>
        <div class="wishlist-item-price">₹${product.price}</div>
        <div class="wishlist-item-actions">
          <button class="btn btn-primary btn-sm btn-wishlist-add-cart" data-id="${product._id}" ${product.stock === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-cart-plus"></i> Add to Cart
          </button>
          <button class="remove-item-btn btn-wishlist-remove" data-id="${product._id}" title="Remove from Wishlist">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Bind actions
  container.querySelectorAll('.btn-wishlist-add-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const product = state.wishlist.find(p => p._id === id);
      addToCart(product, 1);
      // Remove from wishlist upon adding to cart
      toggleWishlist(product);
    });
  });

  container.querySelectorAll('.btn-wishlist-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const product = state.wishlist.find(p => p._id === id);
      toggleWishlist(product);
    });
  });
}


// --- Customer View: Shop Products Catalog ---
async function renderShopView() {
  const loader = document.getElementById('shop-loader');
  const productsList = document.getElementById('products-list');
  const emptyState = document.getElementById('shop-empty-state');
  
  loader.classList.remove('d-none');
  productsList.classList.add('d-none');
  emptyState.classList.add('d-none');

  try {
    // Fetch products from backend api
    let endpoint = `/products?category=${state.activeCategory !== 'all' ? state.activeCategory : ''}`;
    if (state.searchQuery) {
      endpoint += `&search=${encodeURIComponent(state.searchQuery)}`;
    }

    const fetchedProducts = await apiCall(endpoint);
    state.products = fetchedProducts;

    // Apply client side sorting
    if (state.sortBy === 'price-low') {
      state.products.sort((a, b) => a.price - b.price);
    } else if (state.sortBy === 'price-high') {
      state.products.sort((a, b) => b.price - a.price);
    } else if (state.sortBy === 'rating') {
      state.products.sort((a, b) => b.rating - a.rating);
    }

    loader.classList.add('d-none');

    if (state.products.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }

    productsList.classList.remove('d-none');
    productsList.innerHTML = state.products.map(p => {
      const isLowStock = p.stock > 0 && p.stock <= 5;
      const isOutOfStock = p.stock === 0;
      
      let badgeHtml = '';
      if (isOutOfStock) {
        badgeHtml = `<span class="product-card-badge low-stock">Out of Stock</span>`;
      } else if (isLowStock) {
        badgeHtml = `<span class="product-card-badge low-stock">Only ${p.stock} Left!</span>`;
      } else {
        badgeHtml = `<span class="product-card-badge">${p.category}</span>`;
      }

      // Generate star rating string
      const fullStars = Math.floor(p.rating);
      const halfStar = p.rating % 1 >= 0.5 ? 1 : 0;
      const emptyStars = 5 - fullStars - halfStar;
      const starsHtml = 
        '<i class="fa-solid fa-star"></i>'.repeat(fullStars) +
        (halfStar ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
        '<i class="fa-regular fa-star"></i>'.repeat(emptyStars);

      return `
        <div class="product-card">
          ${badgeHtml}
          <button class="wishlist-card-btn" data-id="${p._id}" title="${isInWishlist(p._id) ? 'Remove from Wishlist' : 'Add to Wishlist'}">
            <i class="${isInWishlist(p._id) ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
          </button>
          <div class="product-card-img-wrapper" onclick="window.location.hash='#product/${p._id}'" style="cursor:pointer">
            <img src="${p.imageUrl}" alt="${p.name}" class="product-card-img" loading="lazy">
          </div>
          <div class="product-card-content">
            <span class="product-card-category">${p.category}</span>
            <h3 class="product-card-title" onclick="window.location.hash='#product/${p._id}'" style="cursor:pointer">${p.name}</h3>
            <div class="product-card-rating">
              ${starsHtml}
              <span>(${p.rating})</span>
            </div>
            <p class="product-card-desc">${p.description || 'Premium high quality selection.'}</p>
            <div class="product-card-footer">
              <span class="product-card-price">₹${p.price}</span>
              <button class="btn btn-primary btn-sm btn-add-cart" 
                data-id="${p._id}" 
                ${isOutOfStock ? 'disabled' : ''}>
                <i class="fa-solid fa-cart-plus"></i> Add
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners
    productsList.querySelectorAll('.btn-add-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const prod = state.products.find(p => p._id === id);
        addToCart(prod, 1);
      });
    });

    productsList.querySelectorAll('.wishlist-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const prod = state.products.find(p => p._id === id);
        toggleWishlist(prod);
      });
    });

  } catch (err) {
    loader.classList.add('d-none');
    showToast('Failed to load catalog products', 'error');
  }
}

// --- Customer View: Product Details Page ---
async function renderProductDetailView(id) {
  const container = document.getElementById('product-details-container');
  container.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Fetching product details...</p>
    </div>
  `;

  try {
    const product = await apiCall(`/products/${id}`);
    
    const isOutOfStock = product.stock === 0;
    const isLowStock = product.stock > 0 && product.stock <= 5;
    
    let stockClass = 'in-stock';
    let stockText = `In Stock (${product.stock} units available)`;
    if (isOutOfStock) {
      stockClass = 'out-of-stock';
      stockText = 'Out of Stock';
    } else if (isLowStock) {
      stockClass = 'low-stock';
      stockText = `Hurry! Only ${product.stock} units left!`;
    }

    const fullStars = Math.floor(product.rating);
    const halfStar = product.rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    const starsHtml = 
      '<i class="fa-solid fa-star"></i>'.repeat(fullStars) +
      (halfStar ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
      '<i class="fa-regular fa-star"></i>'.repeat(emptyStars);

    container.innerHTML = `
      <div class="product-details-grid">
        <div class="detail-img-box">
          <img src="${product.imageUrl}" alt="${product.name}">
        </div>
        <div class="detail-info-box">
          <span class="detail-category-tag">${product.category}</span>
          <h2>${product.name}</h2>
          <div class="detail-rating-row">
            ${starsHtml} <span>${product.rating} / 5.0 (Customer Rating)</span>
          </div>
          <div class="detail-price">₹${product.price}</div>
          <div class="detail-description">${product.description || 'Premium high-quality appliance from Gaya Ji Traders.'}</div>
          
          <div class="detail-action-card">
            <div>
              <small class="text-muted d-block">Availability</small>
              <span class="stock-status-indicator ${stockClass}">${stockText}</span>
            </div>
            
            <div class="quantity-picker-row">
              <div class="qty-counter">
                <button class="qty-btn" id="detail-dec"><i class="fa-solid fa-minus"></i></button>
                <span class="qty-val" id="detail-qty">1</span>
                <button class="qty-btn" id="detail-inc"><i class="fa-solid fa-plus"></i></button>
              </div>
              <button class="btn btn-success" id="detail-add-btn" ${isOutOfStock ? 'disabled' : ''}>
                <i class="fa-solid fa-cart-plus"></i> Add to Basket
              </button>
              <button class="btn btn-outline" id="detail-wish-btn" title="${isInWishlist(product._id) ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                <i class="${isInWishlist(product._id) ? 'fa-solid' : 'fa-regular'} fa-heart text-danger"></i> Wishlist
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Quantity selectors setup
    let currentQty = 1;
    const qtyValEl = container.querySelector('#detail-qty');
    const decBtn = container.querySelector('#detail-dec');
    const incBtn = container.querySelector('#detail-inc');
    const addBtn = container.querySelector('#detail-add-btn');
    const wishBtn = container.querySelector('#detail-wish-btn');

    decBtn.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty--;
        qtyValEl.textContent = currentQty;
      }
    });

    incBtn.addEventListener('click', () => {
      if (currentQty < product.stock) {
        currentQty++;
        qtyValEl.textContent = currentQty;
      } else {
        showToast(`Cannot add more than ${product.stock} items.`, 'error');
      }
    });

    addBtn.addEventListener('click', () => {
      addToCart(product, currentQty);
    });

    wishBtn.addEventListener('click', () => {
      toggleWishlist(product);
    });

  } catch (err) {
    container.innerHTML = `
      <div class="text-center p-4 text-danger">
        <i class="fa-solid fa-circle-exclamation" style="font-size:3rem"></i>
        <h4 class="mt-2">Product not found</h4>
        <p class="text-muted mt-2">${err.message}</p>
        <a href="#shop" class="btn btn-primary mt-3">Back to Shop</a>
      </div>
    `;
  }
}

// --- Customer View: Login & Registration ---
function renderLoginView() {
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.add('d-none');
}

function renderRegisterView() {
  document.getElementById('register-form').reset();
  document.getElementById('register-error').classList.add('d-none');
}

// --- Customer View: Checkout Page ---
function renderCheckoutView() {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  
  if (state.cart.length === 0) {
    window.location.hash = '#shop';
    return;
  }

  // 1. Populate Order Summary Items
  const itemsList = document.getElementById('checkout-items-list');
  itemsList.innerHTML = state.cart.map(item => `
    <div class="checkout-summary-item">
      <span>${item.product.name} <strong>x${item.quantity}</strong></span>
      <span>₹${item.product.price * item.quantity}</span>
    </div>
  `).join('');

  // 2. Pricing totals
  document.getElementById('checkout-subtotal').textContent = `₹${subtotal}`;
  const discountRow = document.getElementById('checkout-discount-row');
  const discountEl = document.getElementById('checkout-discount');
  const couponCodeEl = document.getElementById('checkout-coupon-code');
  const grandTotalEl = document.getElementById('checkout-grand-total');

  let discount = 0;
  if (state.activeCoupon) {
    discount = state.activeCoupon.discount;
    discountRow.classList.remove('d-none');
    discountEl.textContent = `-₹${discount}`;
    couponCodeEl.textContent = state.activeCoupon.code;
  } else {
    discountRow.classList.add('d-none');
  }

  const grandTotal = Math.max(0, subtotal - discount);
  grandTotalEl.textContent = `₹${grandTotal}`;

  // 3. Populate addresses
  renderCheckoutAddresses();
}

function renderCheckoutAddresses() {
  const container = document.getElementById('checkout-saved-addresses');
  if (!state.user || !state.user.addresses || state.user.addresses.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-muted border rounded text-center">
        <i class="fa-solid fa-map-location-dot" style="font-size:2rem"></i>
        <p class="mt-2">No saved addresses found. Please add a shipping address below.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.user.addresses.map((addr, idx) => `
    <label class="checkout-address-option ${addr.isDefault || idx === 0 ? 'selected' : ''}">
      <input type="radio" name="checkout-address-radio" value="${addr.id}" ${addr.isDefault || idx === 0 ? 'checked' : ''}>
      <div class="checkout-address-info">
        <h5>${addr.name} <small class="text-muted">(${addr.phone})</small></h5>
        <p>${addr.addressLine}, ${addr.city}, ${addr.state} - <strong>${addr.pincode}</strong></p>
      </div>
    </label>
  `).join('');

  // Add click toggle effect to selection
  container.querySelectorAll('.checkout-address-option').forEach(el => {
    el.addEventListener('click', (e) => {
      container.querySelectorAll('.checkout-address-option').forEach(opt => opt.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
    });
  });
}

// Handle Add Address inside Checkout
async function handleCheckoutAddAddress(e) {
  e.preventDefault();
  
  const name = document.getElementById('addr-name').value;
  const phone = document.getElementById('addr-phone').value;
  const addressLine = document.getElementById('addr-line').value;
  const city = document.getElementById('addr-city').value;
  const stateVal = document.getElementById('addr-state').value;
  const pincode = document.getElementById('addr-pincode').value;

  const newAddr = {
    id: 'addr_' + Date.now(),
    name,
    phone,
    addressLine,
    city,
    state: stateVal,
    pincode,
    isDefault: state.user.addresses.length === 0
  };

  const updatedAddresses = [...(state.user.addresses || []), newAddr];

  try {
    const res = await apiCall('/auth/address', 'PUT', { addresses: updatedAddresses });
    state.user.addresses = res.addresses;
    localStorage.setItem('user', JSON.stringify(state.user));
    
    showToast('Delivery address saved!', 'success');
    document.getElementById('checkout-add-address-form').reset();
    document.getElementById('checkout-add-address-form').classList.add('d-none');
    document.getElementById('show-add-address-btn').classList.remove('d-none');
    
    renderCheckoutAddresses();
  } catch (err) {
    showToast('Failed to save address: ' + err.message, 'error');
  }
}

// Verification OTP Global Variables & Flow
let generatedOtp = null;
let otpSuccessCallback = null;

// --- OTP Code Variables ---
let generatedOtp2 = null; // Second OTP for dual verification

function triggerCheckoutOtpFlow(onSuccess) {
  otpSuccessCallback = onSuccess;
  generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
  
  const phone = (state.user && state.user.phone) ? state.user.phone : '6207342872';
  const maskedPhone = phone.substring(0, 3) + '••••' + phone.substring(phone.length - 3);

  const descEl = document.querySelector('#otp-modal p');
  if (descEl) {
    descEl.innerHTML = `A 4-digit security code has been sent to your phone: <strong id="otp-phone-display">${maskedPhone}</strong>`;
  }
  
  const label1 = document.getElementById('otp-label-1');
  if (label1) {
    label1.style.display = 'none';
  }
  const group2 = document.getElementById('otp-group-2');
  if (group2) {
    group2.classList.add('d-none');
  }
  
  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Verify & Place Order';
  }

  const codeInput = document.getElementById('otp-code-input');
  if (codeInput) {
    codeInput.maxLength = 4;
    codeInput.placeholder = '••••';
  }

  setTimeout(() => {
    showToast(`🔑 GT-SECURE: Your verification OTP is ${generatedOtp}. Do not share this code.`, 'info');
  }, 800);

  document.getElementById('otp-code-input').value = '';
  document.getElementById('otp-modal').classList.remove('d-none');
}

function triggerRegisterOtpFlow(phone, onSuccess) {
  otpSuccessCallback = onSuccess;
  generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
  
  const maskedPhone = phone.substring(0, 3) + '••••' + phone.substring(phone.length - 3);

  const descEl = document.querySelector('#otp-modal p');
  if (descEl) {
    descEl.innerHTML = `A 4-digit security code has been sent to your phone: <strong id="otp-phone-display">${maskedPhone}</strong>`;
  }
  
  const label1 = document.getElementById('otp-label-1');
  if (label1) {
    label1.style.display = 'none';
  }
  const group2 = document.getElementById('otp-group-2');
  if (group2) {
    group2.classList.add('d-none');
  }
  
  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Verify & Register';
  }

  const codeInput = document.getElementById('otp-code-input');
  if (codeInput) {
    codeInput.maxLength = 4;
    codeInput.placeholder = '••••';
  }

  setTimeout(() => {
    showToast(`🔑 GT-SECURE: Your verification OTP is ${generatedOtp}. Do not share this code.`, 'info');
  }, 800);

  document.getElementById('otp-code-input').value = '';
  document.getElementById('otp-modal').classList.remove('d-none');
}

function triggerAdminTransferOtpFlow(targetEmail, targetPhone, onSuccess) {
  otpSuccessCallback = onSuccess;
  generatedOtp = Math.floor(100000 + Math.random() * 900000).toString(); // Email code (6-digit)
  generatedOtp2 = Math.floor(1000 + Math.random() * 9000).toString(); // Mobile code (4-digit)
  
  const email = targetEmail || 'admin@gayaji.com';
  const phone = targetPhone || '6207342872';
  const maskedEmail = email.substring(0, 3) + '••••@' + email.split('@')[1];
  const maskedPhone = phone.substring(0, 3) + '••••' + phone.substring(phone.length - 3);

  const descEl = document.querySelector('#otp-modal p');
  if (descEl) {
    descEl.innerHTML = `To transfer owner admin privileges, enter both verification codes sent to the new owner.`;
  }
  
  const label1 = document.getElementById('otp-label-1');
  if (label1) {
    label1.style.display = 'block';
    label1.textContent = `Email Verification OTP (sent to ${maskedEmail})`;
  }
  const codeInput = document.getElementById('otp-code-input');
  if (codeInput) {
    codeInput.maxLength = 6;
    codeInput.placeholder = '••••••';
  }

  const group2 = document.getElementById('otp-group-2');
  if (group2) {
    group2.classList.remove('d-none');
  }
  const label2 = document.getElementById('otp-label-2');
  if (label2) {
    label2.textContent = `Mobile Verification OTP (sent to +91 ${maskedPhone})`;
  }
  const codeInput2 = document.getElementById('otp-code-input-2');
  if (codeInput2) {
    codeInput2.maxLength = 4;
    codeInput2.placeholder = '••••';
    codeInput2.value = '';
  }

  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Verify & Transfer Admin Rights';
  }

  setTimeout(() => {
    showToast(`✉️ EMAIL-OTP: Simulated Email OTP is ${generatedOtp}`, 'info');
    showToast(`📱 MOBILE-OTP: Simulated SMS OTP is ${generatedOtp2}`, 'info');
  }, 800);

  document.getElementById('otp-code-input').value = '';
  document.getElementById('otp-modal').classList.remove('d-none');
}

function triggerAdminLoginOtpFlow(token, user) {
  otpSuccessCallback = () => {
    saveSession(token, user);
    showToast(`Welcome back, ${user.name}!`, 'success');
    window.location.hash = '#admin';
  };
  
  generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  
  const descEl = document.querySelector('#otp-modal p');
  if (descEl) {
    descEl.innerHTML = `Administrator Account 2FA required. Enter the 6-digit OTP code sent to your registered mobile/email. <br><small class="text-muted">(Simulated code is printed in the browser developer console for security)</small>`;
  }
  
  const label1 = document.getElementById('otp-label-1');
  if (label1) {
    label1.style.display = 'none';
  }
  const group2 = document.getElementById('otp-group-2');
  if (group2) {
    group2.classList.add('d-none');
  }
  
  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Verify Admin Identity';
  }

  const codeInput = document.getElementById('otp-code-input');
  if (codeInput) {
    codeInput.maxLength = 6;
    codeInput.placeholder = '••••••';
  }

  // Log OTP only in console to prevent normal users/guests seeing it on screen
  console.log(`🔒 [ADMIN 2FA CODE] OTP generated at ${new Date().toLocaleTimeString()} is: ${generatedOtp}`);
  showToast(`🔒 Security notification sent to Admin's registered channels.`, 'info');

  document.getElementById('otp-code-input').value = '';
  document.getElementById('otp-modal').classList.remove('d-none');
}

function triggerDeliveryOtpFlow(orderId, phone, onSuccess) {
  otpSuccessCallback = onSuccess;
  generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
  
  const displayPhone = phone || 'Customer Phone';
  const maskedPhone = displayPhone.length >= 10 ? (displayPhone.substring(0, 3) + '••••' + displayPhone.substring(displayPhone.length - 3)) : displayPhone;

  const descEl = document.querySelector('#otp-modal p');
  if (descEl) {
    descEl.innerHTML = `Please ask the customer for the 4-digit delivery verification OTP sent to: <strong id="otp-phone-display">${maskedPhone}</strong>`;
  }
  
  const label1 = document.getElementById('otp-label-1');
  if (label1) {
    label1.style.display = 'none';
  }
  const group2 = document.getElementById('otp-group-2');
  if (group2) {
    group2.classList.add('d-none');
  }
  
  const submitBtn = document.getElementById('otp-submit-btn');
  if (submitBtn) {
    submitBtn.textContent = 'Verify & Complete Delivery';
  }

  const codeInput = document.getElementById('otp-code-input');
  if (codeInput) {
    codeInput.maxLength = 4;
    codeInput.placeholder = '••••';
  }

  setTimeout(() => {
    showToast(`🔑 CUSTOMER-SMS: Simulated SMS sent to ${displayPhone}: "Your delivery verification code is ${generatedOtp}."`, 'info');
  }, 800);

  document.getElementById('otp-code-input').value = '';
  document.getElementById('otp-modal').classList.remove('d-none');
}

// Placing Order checkout logic
async function checkoutOrder() {
  const selectedAddressRadio = document.querySelector('input[name="checkout-address-radio"]:checked');
  if (!selectedAddressRadio) {
    showToast('Please select or add a delivery address.', 'error');
    return;
  }

  const selectedAddrId = selectedAddressRadio.value;
  const address = state.user.addresses.find(a => a.id === selectedAddrId);
  const paymentMode = document.querySelector('input[name="payment-method"]:checked').value;

  // Compile cart items
  const items = state.cart.map(item => ({
    productId: item.productId,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity
  }));

  if (paymentMode === 'COD') {
    // Direct placement
    try {
      const order = await apiCall('/orders', 'POST', {
        items,
        address,
        paymentMode: 'COD',
        couponCode: state.activeCoupon ? state.activeCoupon.code : null
      });

      showToast(`Order placed successfully! Order ID: ${order._id}`, 'success');
      state.cart = [];
      state.activeCoupon = null;
      localStorage.removeItem('cart');
      localStorage.removeItem('activeCoupon');
      renderCartSummary();

      window.location.hash = '#orders';
    } catch (err) {
      showToast('Checkout failed: ' + err.message, 'error');
    }
  } else {
    // Simulate Online Gateway
    const subtotal = state.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const discount = state.activeCoupon ? state.activeCoupon.discount : 0;
    const finalAmount = Math.max(0, subtotal - discount);

    openPaymentGateway(finalAmount, async (transactionId) => {
      showToast('💳 UPI Payment verified! Recording order...', 'info');
      try {
        const order = await apiCall('/orders', 'POST', {
          items,
          address,
          paymentMode: 'Online',
          paymentTransactionId: transactionId,
          couponCode: state.activeCoupon ? state.activeCoupon.code : null
        });

        showToast(`Online payment received! Order ID: ${order._id}`, 'success');
        state.cart = [];
        state.activeCoupon = null;
        localStorage.removeItem('cart');
        localStorage.removeItem('activeCoupon');
        renderCartSummary();

        window.location.hash = '#orders';
      } catch (err) {
        showToast('Failed to record order: ' + err.message, 'error');
      }
    });
  }
}

// --- Payment Gateway Simulator ---
let gatewaySuccessCallback = null;
let paymentTimerInterval = null;

async function openPaymentGateway(amount, onSuccess) {
  gatewaySuccessCallback = onSuccess;
  
  const modal = document.getElementById('payment-modal');
  const stageInit = document.getElementById('payment-stage-init');
  const stageInput = document.getElementById('payment-stage-input');
  const stageProcessing = document.getElementById('payment-stage-processing');
  const stageSuccess = document.getElementById('payment-stage-success');
  const amountText = document.getElementById('payment-amount-text');
  
  amountText.textContent = `₹${amount}`;
  
  // Set stage visibility
  stageInit.classList.remove('d-none');
  stageInput.classList.add('d-none');
  stageProcessing.classList.add('d-none');
  stageSuccess.classList.add('d-none');
  modal.classList.remove('d-none');

  // Load merchant payout details dynamically
  try {
    const settings = await apiCall('/auth/settings');
    const qrFallbackIcon = document.getElementById('checkout-qr-fallback-icon');
    const qrCustomImg = document.getElementById('checkout-qr-custom-img');
    const qrMerchantName = document.getElementById('checkout-qr-merchant-name');

    if (qrMerchantName) {
      qrMerchantName.innerHTML = `Gaya Ji Traders<br><small class="text-muted" style="font-size:0.8rem">UPI Merchant Ph: ${settings.phone || '6207342872'}</small>`;
    }

    if (settings.qrCodeUrl && qrCustomImg && qrFallbackIcon) {
      qrCustomImg.src = settings.qrCodeUrl;
      qrCustomImg.classList.remove('d-none');
      qrFallbackIcon.classList.add('d-none');
    } else if (qrCustomImg && qrFallbackIcon) {
      qrCustomImg.classList.add('d-none');
      qrFallbackIcon.classList.remove('d-none');
    }

    const bankAccDisplay = document.getElementById('checkout-bank-acc-display');
    if (bankAccDisplay) {
      bankAccDisplay.textContent = settings.accountNumber || '987654321098';
    }
  } catch (err) {
    console.error('Failed to load merchant settings for checkout:', err);
  }

  // Start 5 min timer simulator
  let secondsLeft = 300;
  const timerEl = document.getElementById('payment-timer');
  
  clearInterval(paymentTimerInterval);
  paymentTimerInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(paymentTimerInterval);
      closePaymentGateway();
      showToast('Payment session timed out.', 'error');
    }
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);

  // Transition from Init stage to Input stage after 1s
  setTimeout(() => {
    stageInit.classList.add('d-none');
    stageInput.classList.remove('d-none');
  }, 1000);
}

function submitMockPayment() {
  const stageInput = document.getElementById('payment-stage-input');
  const stageProcessing = document.getElementById('payment-stage-processing');
  const stageSuccess = document.getElementById('payment-stage-success');
  
  stageInput.classList.add('d-none');
  stageProcessing.classList.remove('d-none');

  // Simulate bank authorising transaction for 1.5s
  setTimeout(() => {
    stageProcessing.classList.add('d-none');
    stageSuccess.classList.remove('d-none');
    
    // Generate random transaction code
    const transactionId = 'TXN' + Math.floor(100000000 + Math.random() * 900000000);
    document.getElementById('gateway-auth-code').textContent = transactionId;
    
    clearInterval(paymentTimerInterval);

    // Call checkout completion callback after 1.5s success visual feedback
    setTimeout(() => {
      closePaymentGateway();
      if (gatewaySuccessCallback) {
        gatewaySuccessCallback(transactionId);
      }
    }, 1500);

  }, 1500);
}

function cancelPayment() {
  closePaymentGateway();
  showToast('Payment cancelled by user.', 'error');
}

function closePaymentGateway() {
  clearInterval(paymentTimerInterval);
  document.getElementById('payment-modal').classList.add('d-none');
}

// --- Customer View: Order History & Tracking ---
function getStatusMessage(status, history) {
  const lastUpdate = history && history.length > 0 ? history[history.length - 1] : null;
  const lastTime = lastUpdate ? new Date(lastUpdate.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
  
  if (status === 'Pending') return 'Order placed, awaiting confirmation';
  if (status === 'Confirmed') return `Confirmed on ${lastTime}. Processing for dispatch.`;
  if (status === 'Shipped') return `Shipped. Out for transit.`;
  if (status === 'Out for Delivery') return `Out for delivery today! Keep phone handy.`;
  if (status === 'Delivered') return `Delivered on ${lastTime}. Package was handed over directly.`;
  if (status === 'Cancelled') return 'Order has been cancelled.';
  return status;
}

function triggerMockInvoiceDownload(orderId) {
  showToast('Preparing invoice document for print...', 'info');
  setTimeout(() => {
    window.print();
  }, 1000);
}

async function renderOrdersView() {
  const loader = document.getElementById('orders-loader');
  const container = document.getElementById('customer-orders-list');
  const emptyState = document.getElementById('orders-empty-state');

  loader.classList.remove('d-none');
  container.classList.add('d-none');
  emptyState.classList.add('d-none');

  try {
    // Pre-fetch products catalog if empty to get images
    if (state.products.length === 0) {
      try {
        state.products = await apiCall('/products');
      } catch (err) {
        console.error('Failed to pre-fetch product list for images', err);
      }
    }

    const orders = await apiCall('/orders/my-orders');
    loader.classList.add('d-none');

    if (orders.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }

    container.classList.remove('d-none');
    container.innerHTML = orders.map(order => {
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Enforce 2 hours order cancellation limit client-side
      const timeDiff = Date.now() - new Date(order.createdAt).getTime();
      const twoHours = 2 * 60 * 60 * 1000;
      const canCancel = (order.orderStatus === 'Pending' || order.orderStatus === 'Confirmed') && (timeDiff < twoHours);

      const cancelBtnHtml = canCancel 
        ? `<button class="btn btn-danger btn-sm btn-cancel-order btn-block" data-id="${order._id}">
             <i class="fa-solid fa-ban"></i> Cancel Order
           </button>`
        : '';

      const itemsHtml = order.items.map(item => {
        // Find product in state.products to get image
        const product = state.products.find(p => p._id === item.productId);
        const imageUrl = item.imageUrl || (product ? product.imageUrl : 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=200');
        return `
          <div class="order-item-row">
            <img src="${imageUrl}" alt="${item.name}" class="order-item-thumb">
            <div class="order-item-details">
              <h4 class="order-item-name" onclick="window.location.hash='#product/${item.productId}'" style="cursor:pointer">${item.name}</h4>
              <span class="order-item-sub">Price: ₹${item.price} | Qty: ${item.quantity}</span>
              <div class="order-item-badges">
                <span class="badge-assured"><i class="fa-solid fa-circle-check"></i> Assured</span>
              </div>
            </div>
            <div class="order-item-buy-again">
              <button class="btn btn-outline btn-sm btn-buy-again" data-product-id="${item.productId}">
                <i class="fa-solid fa-rotate-left"></i> Buy again
              </button>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="order-card">
          <div class="order-card-header">
            <div class="order-card-meta">
              <div class="meta-group">
                <small>ORDER PLACED</small>
                <span>${orderDate}</span>
              </div>
              <div class="meta-group">
                <small>TOTAL</small>
                <span class="order-total-price">₹${order.total}</span>
              </div>
              <div class="meta-group">
                <small>SHIP TO</small>
                <span class="ship-to-link" title="${order.address.addressLine}, ${order.address.city}">${order.address.name} <i class="fa-solid fa-chevron-down" style="font-size:0.75rem"></i></span>
              </div>
            </div>
            <div class="order-card-right-header">
              <span class="order-id-label">ORDER ID #${order._id.toUpperCase()}</span>
            </div>
          </div>
          
          <div class="order-card-body">
            <div class="order-status-banner">
              <span class="status-bullet bullet-${order.orderStatus.toLowerCase()}"></span>
              <span class="status-main-text">${getStatusMessage(order.orderStatus, order.trackingHistory)}</span>
            </div>
            
            <div class="order-body-grid">
              <div class="order-items-container">
                ${itemsHtml}
              </div>
              <div class="order-actions-container">
                <button class="btn btn-primary btn-block order-track-timeline-trigger" data-id="${order._id}">
                  <i class="fa-solid fa-location-crosshairs"></i> Track Package
                </button>
                <button class="btn btn-outline btn-block btn-download-invoice" data-id="${order._id}">
                  <i class="fa-solid fa-file-pdf"></i> Download Invoice
                </button>
                ${cancelBtnHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners
    container.querySelectorAll('.order-track-timeline-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openTrackingModal(id);
      });
    });

    container.querySelectorAll('.btn-download-invoice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        triggerMockInvoiceDownload(id);
      });
    });

    container.querySelectorAll('.btn-buy-again').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prodId = e.currentTarget.dataset.productId;
        const prod = state.products.find(p => p._id === prodId);
        if (prod) {
          addToCart(prod, 1);
          toggleCart();
        } else {
          showToast('Product detail not found in catalog.', 'error');
        }
      });
    });

    container.querySelectorAll('.btn-cancel-order').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to cancel this order? It will automatically return the stock to our warehouse.')) {
          try {
            const res = await apiCall(`/orders/${id}/cancel`, 'POST');
            showToast(res.message, 'success');
            renderOrdersView();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    loader.classList.add('d-none');
    showToast('Failed to fetch order history', 'error');
  }
}

// Track Timeline & Invoice Modal
async function openTrackingModal(orderId) {
  const modal = document.getElementById('order-tracking-modal');
  const container = document.getElementById('tracking-modal-content');
  modal.classList.remove('d-none');
  
  container.innerHTML = `<div class="text-center p-4"><div class="spinner"></div><p>Retrieving dispatch tracker...</p></div>`;

  try {
    let orders = [];
    if (state.user.role === 'admin') {
      orders = await apiCall('/orders/all');
    } else {
      orders = await apiCall('/orders/my-orders');
    }

    const order = orders.find(o => o._id === orderId);
    if (!order) {
      container.innerHTML = `<p class="text-danger">Order details not found.</p>`;
      return;
    }

    // Build timeline progress stepper
    const steps = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentStatus = order.orderStatus;
    
    // Determine active index
    let activeIndex = steps.indexOf(currentStatus);
    if (currentStatus === 'Processing') activeIndex = 1; // Map Processing to Confirmed
    if (currentStatus === 'Cancelled') activeIndex = -1;

    let timelineHtml = '';
    if (currentStatus === 'Cancelled') {
      timelineHtml = `
        <div class="p-4 bg-danger-light border rounded text-danger text-center">
          <i class="fa-solid fa-ban" style="font-size:2.5rem"></i>
          <h4 class="mt-2" style="font-weight:700">Order Cancelled</h4>
          <p class="small text-secondary mt-1">This order has been cancelled and will not be dispatched further.</p>
        </div>
      `;
    } else {
      const percentage = activeIndex >= 0 ? (activeIndex / (steps.length - 1)) * 100 : 0;
      timelineHtml = `
        <div class="tracking-timeline">
          <div class="tracking-timeline-line">
            <div class="tracking-timeline-progress" style="width: ${percentage}%"></div>
          </div>
          ${steps.map((step, idx) => {
            let stepClass = '';
            let stepTime = '';
            
            // Check if step exists in tracking history
            const histItem = order.trackingHistory.find(h => {
              if (step === 'Order Placed' && h.status === 'Order Placed') return true;
              if (step === 'Confirmed' && (h.status === 'Confirmed' || h.status === 'Assigned for Delivery' || h.status === 'Processing')) return true;
              if (step === 'Shipped' && h.status === 'Shipped') return true;
              if (step === 'Out for Delivery' && h.status === 'Out for Delivery') return true;
              if (step === 'Delivered' && h.status === 'Delivered') return true;
              return false;
            });

            if (histItem) {
              stepClass = 'completed';
              stepTime = new Date(histItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            if (idx === activeIndex) {
              stepClass = 'active';
            }

            let icon = 'fa-check';
            if (step === 'Order Placed') icon = 'fa-receipt';
            if (step === 'Confirmed') icon = 'fa-thumbs-up';
            if (step === 'Shipped') icon = 'fa-truck-fast';
            if (step === 'Out for Delivery') icon = 'fa-motorcycle';
            if (step === 'Delivered') icon = 'fa-box-open';

            return `
              <div class="timeline-step ${stepClass}">
                <div class="timeline-dot"><i class="fa-solid ${icon}"></i></div>
                <div class="timeline-label">${step}</div>
                <div class="timeline-time">${stepTime}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Invoice content items
    const itemsHtml = order.items.map(item => {
      const product = state.products.find(p => p._id === item.productId);
      const imageUrl = item.imageUrl || (product ? product.imageUrl : 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=200');
      return `
        <tr class="invoice-item-row">
          <td style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem 0">
            <img src="${imageUrl}" alt="${item.name}" style="width:40px; height:40px; object-fit:contain; border:1px solid var(--border-color); border-radius:4px; background:#fff">
            <div>
              <div style="font-weight:600">${item.name}</div>
              <small class="text-muted">ID: ${item.productId}</small>
            </div>
          </td>
          <td>₹${item.price}</td>
          <td>${item.quantity}</td>
          <td class="text-right">₹${item.price * item.quantity}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="tracking-modal-grid">
        <!-- Left Column: Stepper and History Feed -->
        <div class="tracking-left-col">
          <div class="tracking-modal-card">
            <h4>Live Order Progress</h4>
            ${timelineHtml}
          </div>
          
          <div class="tracking-modal-card mt-3">
            <h4>Detailed Dispatch Logs</h4>
            <div class="dispatch-logs-timeline mt-2">
              ${order.trackingHistory.map(h => `
                <div class="dispatch-log-item">
                  <div class="log-marker"><i class="fa-solid fa-circle-check"></i></div>
                  <div class="log-info">
                    <strong class="log-status">${h.status}</strong>
                    <span class="log-comment">${h.comment || 'No comments left.'}</span>
                    <small class="log-time text-muted">${new Date(h.timestamp).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}</small>
                  </div>
                </div>
              `).reverse().join('')}
            </div>
          </div>
        </div>
        
        <!-- Right Column: Shipping Info, Payments, Invoice Summary -->
        <div class="tracking-right-col">
          <div class="tracking-modal-card">
            <h4>Shipping Destination</h4>
            <div style="font-size:0.9rem; line-height:1.4">
              <strong style="display:block; font-size:0.95rem">${order.address.name}</strong>
              <div class="text-secondary mt-1">${order.address.addressLine}</div>
              <div class="text-secondary">${order.address.city}, ${order.address.state} - <strong>${order.address.pincode}</strong></div>
              <div class="text-secondary mt-2"><i class="fa-solid fa-phone" style="font-size:0.8rem"></i> Phone: ${order.address.phone}</div>
            </div>
          </div>

          <div class="tracking-modal-card">
            <h4>Billing & Payment</h4>
            <div style="font-size:0.9rem; line-height:1.4">
              <div class="d-flex justify-content-between">
                <span>Payment Mode:</span>
                <strong>${order.paymentMode === 'Online' ? 'Prepaid Online UPI/Card' : 'Cash On Delivery (COD)'}</strong>
              </div>
              <div class="d-flex justify-content-between mt-1">
                <span>Payment Status:</span>
                <span class="badge ${order.paymentStatus === 'Paid' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}" style="font-weight:700">${order.paymentStatus}</span>
              </div>
              ${order.paymentTransactionId ? `
                <div class="d-flex justify-content-between mt-1">
                  <span>Transaction ID:</span>
                  <code style="word-break:break-all">${order.paymentTransactionId}</code>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="tracking-modal-card">
            <h4>Delivery Partner</h4>
            <div class="delivery-agent-summary-box">
              <div class="agent-avatar"><i class="fa-solid fa-user-ninja"></i></div>
              <div class="agent-info">
                <strong>${order.deliveryBoyName || 'Assigning soon...'}</strong>
                ${order.deliveryBoyPhone ? `
                  <a href="tel:${order.deliveryBoyPhone}" class="agent-phone-link">
                    <i class="fa-solid fa-phone"></i> ${order.deliveryBoyPhone}
                  </a>
                ` : '<span class="text-muted small">Awaiting route assignment</span>'}
              </div>
            </div>
          </div>

          <div class="tracking-modal-card">
            <div class="d-flex justify-content-between" style="align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; margin-bottom:0.75rem">
              <h4 style="margin:0; border:none; padding:0">Invoice Summary</h4>
              <button class="btn btn-outline btn-sm btn-print-invoice-modal">
                <i class="fa-solid fa-print"></i> Print
              </button>
            </div>
            <table class="invoice-summary-table" style="width:100%; font-size:0.85rem; border-collapse:collapse">
              <thead>
                <tr style="border-bottom:1.5px solid var(--border-color)">
                  <th style="text-align:left; padding-bottom:0.4rem">Item</th>
                  <th style="padding-bottom:0.4rem">Rate</th>
                  <th style="padding-bottom:0.4rem">Qty</th>
                  <th style="text-align:right; padding-bottom:0.4rem">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr style="border-top:1.5px solid var(--border-color)">
                  <td colspan="3" style="text-align:right; padding:0.4rem 0">Subtotal:</td>
                  <td style="text-align:right; padding:0.4rem 0">₹${order.subtotal}</td>
                </tr>
                ${order.discount ? `
                <tr>
                  <td colspan="3" style="text-align:right; padding:0.4rem 0" class="text-success">Coupon Discount (${order.couponCode}):</td>
                  <td style="text-align:right; padding:0.4rem 0" class="text-success">-₹${order.discount}</td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="3" style="text-align:right; padding:0.4rem 0">Delivery Charges:</td>
                  <td style="text-align:right; padding:0.4rem 0" class="text-success">FREE</td>
                </tr>
                <tr style="border-top:1.5px solid var(--border-color); font-size:1rem; font-weight:700">
                  <td colspan="3" style="text-align:right; padding:0.5rem 0">Grand Total:</td>
                  <td style="text-align:right; padding:0.5rem 0" class="text-success">₹${order.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Hook up print inside tracking details modal
    container.querySelector('.btn-print-invoice-modal').addEventListener('click', () => {
      triggerMockInvoiceDownload(orderId);
    });

  } catch (err) {
    container.innerHTML = `<p class="text-danger">Failed to fetch tracking details: ${err.message}</p>`;
  }
}

// --- Customer View: Profile Page ---
function renderProfileView() {
  if (!state.user) return;
  
  // Set contact text
  document.getElementById('profile-avatar-big').textContent = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  document.getElementById('profile-display-name').textContent = state.user.name;
  document.getElementById('profile-display-role').textContent = state.user.role;
  document.getElementById('profile-display-email').textContent = state.user.email;
  document.getElementById('profile-display-phone').textContent = state.user.phone;

  renderProfileAddresses();
}

function renderProfileAddresses() {
  const container = document.getElementById('profile-addresses-container');
  if (!state.user.addresses || state.user.addresses.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-muted text-center border rounded">
        <i class="fa-solid fa-address-book" style="font-size:2rem"></i>
        <p class="mt-2">No shipping addresses saved yet. Fill the form below to add one.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.user.addresses.map(addr => `
    <div class="profile-address-card">
      <h5>${addr.name} <span class="text-muted">(${addr.phone})</span></h5>
      <p class="mt-1">${addr.addressLine}</p>
      <p>${addr.city}, ${addr.state} - <strong>${addr.pincode}</strong></p>
      ${addr.isDefault ? `<span class="role-badge mt-2">Primary Address</span>` : ''}
      <button class="btn-delete-address" data-id="${addr.id}" title="Remove address">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');

  // Event handlers
  container.querySelectorAll('.btn-delete-address').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const updated = state.user.addresses.filter(a => a.id !== id);
      
      // If we deleted the primary, make another primary
      if (updated.length > 0 && !updated.some(a => a.isDefault)) {
        updated[0].isDefault = true;
      }

      try {
        const res = await apiCall('/auth/address', 'PUT', { addresses: updated });
        state.user.addresses = res.addresses;
        localStorage.setItem('user', JSON.stringify(state.user));
        showToast('Address removed.', 'info');
        renderProfileAddresses();
      } catch (err) {
        showToast('Delete address failed.', 'error');
      }
    });
  });
}

async function handleProfileAddAddress(e) {
  e.preventDefault();
  
  const name = document.getElementById('prof-addr-name').value;
  const phone = document.getElementById('prof-addr-phone').value;
  const addressLine = document.getElementById('prof-addr-line').value;
  const city = document.getElementById('prof-addr-city').value;
  const stateVal = document.getElementById('prof-addr-state').value;
  const pincode = document.getElementById('prof-addr-pincode').value;

  const newAddr = {
    id: 'addr_' + Date.now(),
    name,
    phone,
    addressLine,
    city,
    state: stateVal,
    pincode,
    isDefault: !state.user.addresses || state.user.addresses.length === 0
  };

  const updatedAddresses = [...(state.user.addresses || []), newAddr];

  try {
    const res = await apiCall('/auth/address', 'PUT', { addresses: updatedAddresses });
    state.user.addresses = res.addresses;
    localStorage.setItem('user', JSON.stringify(state.user));
    
    showToast('Address added to profile!', 'success');
    document.getElementById('profile-add-address-form').reset();
    renderProfileAddresses();
  } catch (err) {
    showToast('Failed to add address: ' + err.message, 'error');
  }
}

// --- Delivery Portal Console ---
async function renderDeliveryView() {
  document.getElementById('delivery-agent-name').textContent = state.user.name;

  const loader = document.getElementById('delivery-loader');
  const listContainer = document.getElementById('delivery-tasks-list');
  const emptyState = document.getElementById('delivery-empty-state');

  loader.classList.remove('d-none');
  listContainer.classList.add('d-none');
  emptyState.classList.add('d-none');

  try {
    const deliveries = await apiCall('/orders/assigned-deliveries');
    loader.classList.add('d-none');

    if (deliveries.length === 0) {
      emptyState.classList.remove('d-none');
      return;
    }

    listContainer.classList.remove('d-none');
    listContainer.innerHTML = deliveries.map(order => {
      const itemsText = order.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
      
      // Filter options based on current status
      let selectHtml = `
        <select class="delivery-status-select" data-id="${order._id}">
          <option value="">-- Change Status --</option>
          <option value="Confirmed" ${order.orderStatus === 'Confirmed' ? 'disabled' : ''}>Confirmed</option>
          <option value="Processing" ${order.orderStatus === 'Processing' ? 'disabled' : ''}>Processing</option>
          <option value="Shipped" ${order.orderStatus === 'Shipped' ? 'disabled' : ''}>Shipped</option>
          <option value="Out for Delivery" ${order.orderStatus === 'Out for Delivery' ? 'disabled' : ''}>Out for Delivery</option>
          <option value="Delivered" ${order.orderStatus === 'Delivered' ? 'disabled' : ''}>Delivered</option>
          <option value="Cancelled" ${order.orderStatus === 'Cancelled' ? 'disabled' : ''}>Cancelled</option>
        </select>
      `;

      return `
        <div class="delivery-task-card">
          <div class="delivery-task-details">
            <h5>Order ID: #${order._id}</h5>
            <div class="delivery-task-address">
              <strong>Deliver To:</strong> ${order.address.name} | <i class="fa-solid fa-phone"></i> ${order.address.phone}<br>
              <strong>Address:</strong> ${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}
            </div>
            <div class="delivery-task-meta">
              <span><strong>Items:</strong> ${itemsText}</span>
              <span><strong>Amount:</strong> ₹${order.total} (${order.paymentMode})</span>
            </div>
            <div class="mt-2">
              <span class="order-status-pill status-${order.orderStatus.toLowerCase()}">${order.orderStatus}</span>
              <span class="badge ${order.paymentStatus === 'Paid' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}">${order.paymentStatus}</span>
            </div>
          </div>
          
          <div class="delivery-task-actions">
            <label class="small text-muted font-weight-bold">Update Dispatch Status:</label>
            ${selectHtml}
            <input type="text" class="form-control mt-2" placeholder="Comment (e.g. Call before arrival)" id="comment-${order._id}">
            <button class="btn btn-primary btn-sm mt-2 btn-update-delivery" data-id="${order._id}" data-phone="${order.address.phone}">
              Apply Status Update <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Hook click updater
    listContainer.querySelectorAll('.btn-update-delivery').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const phone = e.currentTarget.dataset.phone;
        const select = listContainer.querySelector(`select[data-id="${id}"]`);
        const status = select.value;
        const comment = listContainer.querySelector(`#comment-${id}`).value.trim();

        if (!status) {
          showToast('Please select a target status first.', 'error');
          return;
        }

        if (status === 'Delivered') {
          triggerDeliveryOtpFlow(id, phone, async () => {
            try {
              await apiCall(`/orders/${id}/status`, 'PUT', { status, comment });
              showToast(`Order status updated to: ${status}`, 'success');
              renderDeliveryView();
            } catch (err) {
              showToast('Update failed: ' + err.message, 'error');
            }
          });
          return;
        }

        try {
          await apiCall(`/orders/${id}/status`, 'PUT', { status, comment });
          showToast(`Order status updated to: ${status}`, 'success');
          renderDeliveryView();
        } catch (err) {
          showToast('Update failed: ' + err.message, 'error');
        }
      });
    });

  } catch (err) {
    loader.classList.add('d-none');
    showToast('Failed to load active delivery portal task sheet.', 'error');
  }
}

// --- Admin Portal View ---
let adminUsersList = [];

async function renderAdminView() {
  // Select active tab
  const activeTabId = document.querySelector('.admin-tab-btn.active').dataset.adminTab;
  renderAdminTab(activeTabId);
  
  // Load statistical reports
  try {
    const reports = await apiCall('/orders/reports/payment-summary');
    
    // Fill stats cards
    document.getElementById('admin-stat-sales').textContent = `₹${reports.summary.totalSales}`;
    document.getElementById('admin-stat-completed').textContent = reports.summary.completedOrders;
    document.getElementById('admin-stat-pending').textContent = reports.summary.pendingOrders;
    document.getElementById('admin-stat-lowstock').textContent = reports.summary.lowStockCount;

    // Fill analytics info
    document.getElementById('analytics-cod-sales').textContent = `₹${reports.summary.codSales}`;
    document.getElementById('analytics-online-sales').textContent = `₹${reports.summary.onlineSales}`;
    document.getElementById('analytics-inventory-cost').textContent = `₹${reports.summary.totalInventoryCost}`;

    // Populate Daily Sales Chart
    renderSalesChart(reports.salesByDay);

  } catch (err) {
    showToast('Failed to pull admin reporting charts.', 'error');
  }
}

function renderSalesChart(salesByDay) {
  const chartContainer = document.getElementById('sales-bar-chart');
  const tableContainer = document.getElementById('admin-sales-by-day-list');
  
  const dates = Object.keys(salesByDay).sort().reverse().slice(0, 7).reverse(); // Last 7 days
  const salesArray = dates.map(d => ({ date: d, amount: salesByDay[d] || 0 }));

  if (salesArray.length === 0) {
    chartContainer.innerHTML = `<p class="text-muted w-100 text-center">No transactions completed yet.</p>`;
    tableContainer.innerHTML = `<tr><td colspan="2" class="text-center text-muted">No sales logs</td></tr>`;
    return;
  }

  // Find max sales for scale height
  const maxSales = Math.max(...salesArray.map(s => s.amount), 1);

  // Generate chart bars
  chartContainer.innerHTML = salesArray.map(s => {
    const percentHeight = Math.round((s.amount / maxSales) * 100);
    const dayName = s.date.split('-').slice(1).join('/'); // MM/DD
    
    return `
      <div class="chart-bar-wrapper">
        <div class="chart-bar" style="height: ${Math.max(5, percentHeight)}%">
          <span class="chart-bar-tooltip">₹${s.amount}</span>
        </div>
        <span class="chart-bar-label">${dayName}</span>
      </div>
    `;
  }).join('');

  // Generate chart table
  tableContainer.innerHTML = salesArray.map(s => `
    <tr>
      <td><strong>${s.date}</strong></td>
      <td class="text-success font-weight-bold">₹${s.amount}</td>
    </tr>
  `).reverse().join('');
}

// Router for sub-tabs inside Admin Dashboard
async function renderAdminTab(tabId) {
  // Hide all contents
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('d-none'));
  document.getElementById(tabId).classList.remove('d-none');

  if (tabId === 'admin-tab-orders') {
    loadAdminOrders();
  } else if (tabId === 'admin-tab-products') {
    loadAdminProducts();
  } else if (tabId === 'admin-tab-coupons') {
    loadAdminCoupons();
  } else if (tabId === 'admin-tab-settings') {
    loadAdminSettings();
  }
}

// Admin Sub-Tab: Orders Manager
async function loadAdminOrders() {
  const statusFilter = document.getElementById('admin-order-status-filter').value;
  const listContainer = document.getElementById('admin-orders-list');
  listContainer.innerHTML = `<tr><td colspan="8" class="text-center"><div class="spinner"></div></td></tr>`;

  try {
    const orders = await apiCall('/orders/all');
    
    // Load delivery boys user list for assignments
    const users = await apiCall('/auth/users');
    const deliveryBoys = users.filter(u => u.role === 'delivery');

    // Filter statuses
    let filtered = orders;
    if (statusFilter !== 'all') {
      filtered = orders.filter(o => o.orderStatus === statusFilter);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No orders found.</td></tr>`;
      return;
    }

    listContainer.innerHTML = filtered.map(order => {
      const orderDate = new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      // Dropdown to update status
      const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      const statusSelect = `
        <select class="admin-order-status-select" data-id="${order._id}">
          ${statuses.map(st => `<option value="${st}" ${order.orderStatus === st ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      `;

      // Dropdown to assign delivery boy
      const delSelect = `
        <div style="display: flex; gap: 0.25rem; flex-direction: column;">
          <select class="admin-order-delivery-select" data-id="${order._id}">
            <option value="">-- Unassigned --</option>
            ${deliveryBoys.map(db => `
              <option value="${db._id}" data-name="${db.name}" data-phone="${db.phone || ''}" ${order.deliveryBoyId === db._id ? 'selected' : ''}>
                ${db.name}
              </option>
            `).join('')}
          </select>
          <input type="tel" class="form-control form-control-sm admin-order-delivery-phone" 
            placeholder="Phone Number" 
            value="${order.deliveryBoyPhone || ''}" 
            data-id="${order._id}" 
            style="font-size:0.75rem; padding: 0.2rem 0.4rem; height: auto; margin-top: 2px;">
          <button class="btn btn-primary btn-sm btn-assign-delivery-go mt-1" data-id="${order._id}" style="font-size:0.7rem; padding:0.1rem 0.3rem;">
            Assign & Save
          </button>
        </div>
      `;

      return `
        <tr>
          <td><a href="javascript:void(0)" class="admin-invoice-link" data-id="${order._id}">#${order._id}</a></td>
          <td><strong>${order.customerName}</strong><br><small class="text-muted">${order.phone}</small></td>
          <td class="text-success font-weight-bold">₹${order.total}</td>
          <td>${orderDate}</td>
          <td><span class="badge ${order.paymentStatus === 'Paid' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}">${order.paymentStatus}</span></td>
          <td>${delSelect}</td>
          <td>${statusSelect}</td>
          <td>
            <button class="btn btn-outline btn-sm admin-invoice-link" data-id="${order._id}"><i class="fa-solid fa-file-invoice"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind event listeners
    listContainer.querySelectorAll('.admin-invoice-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openTrackingModal(id);
      });
    });

    listContainer.querySelectorAll('.admin-order-status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.currentTarget.dataset.id;
        const status = e.currentTarget.value;
        try {
          await apiCall(`/orders/${id}/status`, 'PUT', { status });
          showToast(`Order status updated to: ${status}`, 'success');
          renderAdminView(); // refresh reporting and lists
        } catch (err) {
          showToast('Status update failed: ' + err.message, 'error');
        }
      });
    });

    // Auto fill phone input when dropdown changes
    listContainer.querySelectorAll('.admin-order-delivery-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const opt = e.currentTarget.selectedOptions[0];
        const phone = opt.dataset.phone || '';
        const phoneInput = listContainer.querySelector(`.admin-order-delivery-phone[data-id="${id}"]`);
        if (phoneInput) {
          phoneInput.value = phone;
        }
      });
    });

    // Handle Assign & Save click
    listContainer.querySelectorAll('.btn-assign-delivery-go').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const select = listContainer.querySelector(`.admin-order-delivery-select[data-id="${id}"]`);
        const phoneInput = listContainer.querySelector(`.admin-order-delivery-phone[data-id="${id}"]`);
        
        const opt = select.selectedOptions[0];
        const dbId = opt.value;
        const dbName = opt.dataset.name;
        const dbPhone = phoneInput ? phoneInput.value.trim() : '';

        if (!dbId) {
          showToast('Please select a delivery personnel first.', 'error');
          return;
        }

        try {
          await apiCall(`/orders/${id}/assign-delivery`, 'PUT', {
            deliveryBoyId: dbId,
            deliveryBoyName: dbName,
            deliveryBoyPhone: dbPhone
          });
          showToast(`Assigned order delivery to: ${dbName}`, 'success');
          renderAdminView();
        } catch (err) {
          showToast('Assignment failed: ' + err.message, 'error');
        }
      });
    });

  } catch (err) {
    showToast('Failed to pull admin orders list.', 'error');
  }
}

// Admin Sub-Tab: Inventory Catalog CRUD
async function loadAdminProducts() {
  const container = document.getElementById('admin-products-list');
  container.innerHTML = `<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>`;
  try {
    const products = await apiCall('/products');
    
    container.innerHTML = products.map(p => `
      <tr>
        <td><img src="${p.imageUrl}" alt="${p.name}"></td>
        <td><strong>${p.name}</strong><br><small class="text-muted">${p.description.substring(0, 50)}...</small></td>
        <td><span class="role-badge">${p.category}</span></td>
        <td><strong>₹${p.price}</strong></td>
        <td>
          <span class="font-weight-bold ${p.stock <= 5 ? 'text-danger' : ''}">${p.stock} units</span>
          ${p.stock <= 5 ? `<br><small class="text-danger">⚠️ Low Stock</small>` : ''}
        </td>
        <td>
          <div class="d-flex" style="gap:0.4rem">
            <button class="btn btn-outline btn-sm btn-edit-prod" data-id="${p._id}"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="btn btn-danger btn-sm btn-delete-prod" data-id="${p._id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind operations
    container.querySelectorAll('.btn-edit-prod').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const prod = products.find(p => p._id === id);
        openProductModal(prod);
      });
    });

    container.querySelectorAll('.btn-delete-prod').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this product?')) {
          try {
            await apiCall(`/products/${id}`, 'DELETE');
            showToast('Product deleted successfully.', 'success');
            loadAdminProducts();
          } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    showToast('Failed to load warehouse product inventory.', 'error');
  }
}

// Modal Form handling for Product Add/Edit CRUD
function openProductModal(product = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('product-modal-title');
  const form = document.getElementById('product-form');

  form.reset();

  const previewContainer = document.getElementById('image-upload-preview');
  const previewImg = document.getElementById('upload-preview-img');
  const uploadZone = document.getElementById('image-upload-zone');

  if (product) {
    title.textContent = 'Edit Product Details';
    document.getElementById('prod-id').value = product._id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-category').value = product.category;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-stock').value = product.stock;
    document.getElementById('prod-image').value = product.imageUrl || '';
    document.getElementById('prod-desc').value = product.description;

    if (product.imageUrl) {
      previewImg.src = product.imageUrl;
      previewContainer.classList.remove('d-none');
      uploadZone.classList.add('d-none');
    } else {
      previewContainer.classList.add('d-none');
      uploadZone.classList.remove('d-none');
    }
  } else {
    title.textContent = 'Add New Product';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-image').value = '';
    previewImg.src = '';
    previewContainer.classList.add('d-none');
    uploadZone.classList.remove('d-none');
  }

  modal.classList.remove('d-none');
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value;
  const category = document.getElementById('prod-category').value;
  const price = Number(document.getElementById('prod-price').value);
  const stock = Number(document.getElementById('prod-stock').value);
  const imageUrl = document.getElementById('prod-image').value;
  const description = document.getElementById('prod-desc').value;

  const payload = { name, category, price, stock, imageUrl, description };

  try {
    if (id) {
      // Edit PUT
      await apiCall(`/products/${id}`, 'PUT', payload);
      showToast('Product updated successfully!', 'success');
    } else {
      // Create POST
      await apiCall('/products', 'POST', payload);
      showToast('Product created successfully!', 'success');
    }
    document.getElementById('product-modal').classList.add('d-none');
    loadAdminProducts();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

// Admin Sub-Tab: Coupons Manager
async function loadAdminCoupons() {
  const container = document.getElementById('admin-coupons-list');
  container.innerHTML = `<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>`;
  try {
    const coupons = await apiCall('/orders/coupon');
    if (coupons.length === 0) {
      container.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No discount coupons active.</td></tr>`;
      return;
    }

    container.innerHTML = coupons.map(c => {
      const expDate = c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'Never';
      const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
      
      return `
        <tr>
          <td><strong class="text-uppercase text-primary">${c.code}</strong></td>
          <td>${c.type === 'percent' ? `${c.value}% Off` : `₹${c.value} Flat`}</td>
          <td>₹${c.minPurchase}</td>
          <td class="${isExpired ? 'text-danger font-weight-bold' : ''}">${expDate}</td>
          <td>
            <span class="badge ${c.active && !isExpired ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}">
              ${c.active && !isExpired ? 'Active' : 'Expired'}
            </span>
          </td>
          <td>
            <button class="btn btn-danger btn-sm btn-delete-coupon" data-id="${c._id}"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    container.querySelectorAll('.btn-delete-coupon').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Delete this coupon?')) {
          try {
            await apiCall(`/orders/coupon/${id}`, 'DELETE');
            showToast('Coupon removed.', 'success');
            loadAdminCoupons();
          } catch (err) {
            showToast('Remove failed: ' + err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    showToast('Failed to pull coupons database.', 'error');
  }
}

async function handleCreateCoupon(e) {
  e.preventDefault();
  const code = document.getElementById('coup-code').value.trim().toUpperCase();
  const type = document.getElementById('coup-type').value;
  const value = Number(document.getElementById('coup-value').value);
  const minPurchase = Number(document.getElementById('coup-min').value || 0);
  const expiryDateInput = document.getElementById('coup-expiry').value;
  
  const expiryDate = expiryDateInput ? new Date(expiryDateInput).toISOString() : null;

  try {
    await apiCall('/orders/coupon', 'POST', { code, type, value, minPurchase, expiryDate });
    showToast(`Coupon ${code} generated!`, 'success');
    document.getElementById('admin-add-coupon-form').reset();
    loadAdminCoupons();
  } catch (err) {
    showToast('Generation failed: ' + err.message, 'error');
  }
}

// Admin Sub-Tab: Admin Privilege Transfer & Payout Settings
async function loadAdminSettings() {
  const select = document.getElementById('transfer-user-select');
  if (select) {
    select.innerHTML = `<option value="">-- Choose User --</option>`;
    try {
      const users = await apiCall('/auth/users');
      adminUsersList = users.filter(u => u._id !== state.user._id);

      select.innerHTML += adminUsersList.map(u => `
        <option value="${u._id}">${u.name} (${u.email} - ${u.role})</option>
      `).join('');
    } catch (err) {
      showToast('Failed to pull user registry.', 'error');
    }
  }

  // Load payout settings
  try {
    const settings = await apiCall('/auth/settings');
    document.getElementById('setting-account-number').value = settings.accountNumber || '';
    document.getElementById('setting-phone').value = settings.phone || '';

    const adminEmailInput = document.getElementById('admin-setting-email');
    if (adminEmailInput && state.user) {
      adminEmailInput.value = state.user.email;
    }
    
    const previewImg = document.getElementById('setting-qr-preview-img');
    const previewContainer = document.getElementById('setting-qr-preview-container');
    const uploadZone = document.getElementById('setting-qr-upload-zone');
    const hiddenQrInput = document.getElementById('setting-qr-code-url');

    hiddenQrInput.value = settings.qrCodeUrl || '';
    if (settings.qrCodeUrl) {
      previewImg.src = settings.qrCodeUrl;
      previewContainer.classList.remove('d-none');
      uploadZone.classList.add('d-none');
    } else {
      previewContainer.classList.add('d-none');
      uploadZone.classList.remove('d-none');
    }
  } catch (err) {
    showToast('Failed to load business settings.', 'error');
  }
}

async function handleAdminTransfer(e) {
  e.preventDefault();
  const targetUserId = document.getElementById('transfer-user-select').value;
  const checkboxChecked = document.getElementById('transfer-confirm-checkbox').checked;

  if (!targetUserId) {
    showToast('Please select a target user to promote.', 'error');
    return;
  }

  if (!checkboxChecked) {
    showToast('Please check the confirmation box.', 'error');
    return;
  }

  const targetUserObj = adminUsersList.find(u => u._id === targetUserId);
  if (!confirm(`Are you absolutely sure you want to promote ${targetUserObj.name} to Admin and demote yourself?`)) {
    return;
  }

  // Intercept with 2FA Email & Mobile OTP verification
  triggerAdminTransferOtpFlow(targetUserObj.email, targetUserObj.phone, async () => {
    try {
      const res = await apiCall('/auth/admin-transfer', 'POST', { targetUserId });
      showToast(res.message, 'success');
      
      // Auto logout as role changed to Customer
      logout();
    } catch (err) {
      showToast('Privilege transfer failed: ' + err.message, 'error');
    }
  });
}

// --- Notifications Center ---
let isInitialNotifPoll = true;

async function pollNotifications() {
  if (!state.token) {
    isInitialNotifPoll = true;
    return;
  }
  try {
    const notifications = await apiCall('/notifications');
    
    // Alert user / admin about new unread notifications that arrive in real-time
    if (!isInitialNotifPoll && state.notifications && state.notifications.length > 0) {
      notifications.forEach(n => {
        if (!n.read) {
          const alreadyExists = state.notifications.some(old => old._id === n._id);
          if (!alreadyExists) {
            // New unread notification detected! Alert with a Toast Notification
            showToast(n.message, n.type === 'order' ? 'info' : 'success');
          }
        }
      });
    }
    
    isInitialNotifPoll = false;
    state.notifications = notifications;
    renderNotifications();
  } catch (err) {
    console.error('Failed checking alerts feed:', err);
  }
}

function renderNotifications() {
  const bell = document.getElementById('notification-bell');
  const badge = document.getElementById('notif-badge');
  const container = document.getElementById('notif-list');

  const unreadCount = state.notifications.filter(n => !n.read).length;
  badge.textContent = unreadCount;

  if (unreadCount > 0) {
    badge.classList.remove('d-none');
    // Simple micro-animation on bell icon
    bell.querySelector('i').style.animation = 'spin 0.5s ease';
    setTimeout(() => { bell.querySelector('i').style.animation = ''; }, 500);
  } else {
    badge.classList.add('d-none');
  }

  if (state.notifications.length === 0) {
    container.innerHTML = `<div class="notif-empty">No new notifications</div>`;
    return;
  }

  container.innerHTML = state.notifications.map(n => {
    const itemTime = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n._id}" data-order="${n.orderId || ''}">
        <div>${n.message}</div>
        <span class="notif-time">${itemTime}</span>
      </div>
    `;
  }).join('');

  // Click single read and inspect details
  container.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const orderId = e.currentTarget.dataset.order;

      try {
        await apiCall(`/notifications/${id}/read`, 'PUT');
        pollNotifications();
        
        // If order notification, open details modal
        if (orderId) {
          openTrackingModal(orderId);
        }
      } catch (err) {
        console.error('Failed reading alert:', err);
      }
    });
  });
}

async function markAllNotificationsRead() {
  try {
    await apiCall('/notifications/read-all', 'PUT');
    showToast('All notifications marked read.', 'success');
    pollNotifications();
  } catch (err) {
    console.error('Failed reading all alerts:', err);
  }
}

let sliderInterval = null;
let currentSlideIndex = 0;

function initHeroSlider() {
  const slider = document.querySelector('.hero-slider');
  if (!slider) return;

  const slides = slider.querySelectorAll('.slide');
  const dots = slider.querySelectorAll('.slider-dot');
  const prevBtn = document.getElementById('slider-prev-btn');
  const nextBtn = document.getElementById('slider-next-btn');

  if (slides.length === 0) return;

  function showSlide(index) {
    if (index >= slides.length) index = 0;
    if (index < 0) index = slides.length - 1;
    
    currentSlideIndex = index;

    slides.forEach((slide, i) => {
      if (i === currentSlideIndex) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    dots.forEach((dot, i) => {
      if (i === currentSlideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    sliderInterval = setInterval(() => {
      showSlide(currentSlideIndex + 1);
    }, 4000);
  }

  function stopAutoSlide() {
    if (sliderInterval) {
      clearInterval(sliderInterval);
      sliderInterval = null;
    }
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      showSlide(currentSlideIndex - 1);
      startAutoSlide();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      showSlide(currentSlideIndex + 1);
      startAutoSlide();
    });
  }

  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      showSlide(index);
      startAutoSlide();
    });
  });

  showSlide(0);
  startAutoSlide();

  slider.addEventListener('mouseenter', stopAutoSlide);
  slider.addEventListener('mouseleave', startAutoSlide);
}

// --- DOM Event Listeners & Bootstrapping ---
document.addEventListener('DOMContentLoaded', () => {
  
  // Router hooks
  window.addEventListener('hashchange', router);
  
  // Initialize Theme from localStorage
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeToggle = document.getElementById('theme-toggle');
  
  if (savedTheme === 'dark') {
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }

  // Theme Toggler
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('theme', target);
    
    if (target === 'dark') {
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      showToast('Dark mode enabled', 'info');
    } else {
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      showToast('Light mode enabled', 'info');
    }
  });

  // UI Drawer/Menu Toggles
  const cartToggle = document.getElementById('cart-toggle-btn');
  const closeCart = document.getElementById('close-cart-btn');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  
  const wishlistToggle = document.getElementById('wishlist-toggle-btn');
  const closeWishlist = document.getElementById('close-wishlist-btn');
  const wishlistDrawer = document.getElementById('wishlist-drawer');
  const wishlistOverlay = document.getElementById('wishlist-overlay');

  const toggleCart = () => {
    wishlistDrawer.classList.add('d-none');
    wishlistOverlay.classList.add('d-none');
    cartDrawer.classList.toggle('d-none');
    cartOverlay.classList.toggle('d-none');
    if (!cartDrawer.classList.contains('d-none')) {
      renderCartDrawer();
    }
  };

  const toggleWishlistDrawer = () => {
    cartDrawer.classList.add('d-none');
    cartOverlay.classList.add('d-none');
    wishlistDrawer.classList.toggle('d-none');
    wishlistOverlay.classList.toggle('d-none');
    if (!wishlistDrawer.classList.contains('d-none')) {
      renderWishlistDrawer();
    }
  };

  cartToggle.addEventListener('click', toggleCart);
  closeCart.addEventListener('click', toggleCart);
  cartOverlay.addEventListener('click', toggleCart);

  wishlistToggle.addEventListener('click', toggleWishlistDrawer);
  closeWishlist.addEventListener('click', toggleWishlistDrawer);
  wishlistOverlay.addEventListener('click', toggleWishlistDrawer);

  // User Dropdown Trigger
  const userTrigger = document.getElementById('user-menu-trigger');
  const userDropdown = document.getElementById('user-dropdown');
  userTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('d-none');
    document.getElementById('notification-dropdown').classList.add('d-none');
  });

  // Notification Dropdown Trigger
  const bell = document.getElementById('notification-bell');
  const notifDropdown = document.getElementById('notification-dropdown');
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('d-none');
    userDropdown.classList.add('d-none');
  });

  // Click outside to close dropdowns
  document.addEventListener('click', () => {
    userDropdown.classList.add('d-none');
    notifDropdown.classList.add('d-none');
  });

  // Mark all read button
  document.getElementById('mark-all-read-btn').addEventListener('click', markAllNotificationsRead);

  // Header Search Input
  const searchInput = document.getElementById('global-search');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    if (window.location.hash !== '#shop' && window.location.hash !== '') {
      window.location.hash = '#shop';
    }
    renderShopView();
  });

  // Category filter tabs
  document.getElementById('category-tabs').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-tab')) {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeCategory = e.target.dataset.category;
      renderShopView();
    }
  });

  // Catalog Sort select option
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderShopView();
  });

  // Reset filter button
  document.getElementById('reset-filters-btn').addEventListener('click', () => {
    document.getElementById('global-search').value = '';
    state.searchQuery = '';
    state.activeCategory = 'all';
    document.querySelectorAll('.category-tab').forEach(t => {
      t.classList.remove('active');
      if (t.dataset.category === 'all') t.classList.add('active');
    });
    renderShopView();
  });

  // Coupon apply hooks
  document.getElementById('apply-coupon-btn').addEventListener('click', applyCoupon);
  document.getElementById('remove-coupon-btn').addEventListener('click', removeCoupon);
  
  // Checkout drawer transition
  document.getElementById('checkout-btn').addEventListener('click', () => {
    toggleCart();
    window.location.hash = '#checkout';
  });

  // Checkout address forms
  document.getElementById('show-add-address-btn').addEventListener('click', () => {
    document.getElementById('checkout-add-address-form').classList.remove('d-none');
    document.getElementById('show-add-address-btn').classList.add('d-none');
  });

  document.getElementById('cancel-add-address-btn').addEventListener('click', () => {
    document.getElementById('checkout-add-address-form').classList.add('d-none');
    document.getElementById('show-add-address-btn').classList.remove('d-none');
    document.getElementById('checkout-add-address-form').reset();
  });

  // Register checkout add address
  document.getElementById('checkout-add-address-form').addEventListener('submit', handleCheckoutAddAddress);

  // checkout radio change selection style wrapper
  document.getElementsByName('payment-method').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.payment-option-label').forEach(lbl => lbl.classList.remove('selected'));
      e.target.closest('.payment-option-label').classList.add('selected');
    });
  });

  // checkout submit order placement with OTP interception
  document.getElementById('place-order-btn').addEventListener('click', () => {
    const selectedAddressRadio = document.querySelector('input[name="checkout-address-radio"]:checked');
    if (!selectedAddressRadio) {
      showToast('Please select or add a delivery address.', 'error');
      return;
    }
    triggerCheckoutOtpFlow(() => {
      checkoutOrder();
    });
  });

  // OTP Modal Events
  document.getElementById('close-otp-modal-btn').addEventListener('click', () => {
    document.getElementById('otp-modal').classList.add('d-none');
    showToast('Verification cancelled.', 'error');
  });

  document.getElementById('otp-submit-btn').addEventListener('click', () => {
    const code = document.getElementById('otp-code-input').value.trim();
    const group2Visible = !document.getElementById('otp-group-2').classList.contains('d-none');

    if (group2Visible) {
      const code2 = document.getElementById('otp-code-input-2').value.trim();
      if (code === generatedOtp && code2 === generatedOtp2) {
        document.getElementById('otp-modal').classList.add('d-none');
        showToast('Both OTP codes verified successfully!', 'success');
        if (otpSuccessCallback) {
          otpSuccessCallback();
        }
      } else {
        showToast('Invalid verification codes. Please try again.', 'error');
      }
    } else {
      if (code === generatedOtp) {
        document.getElementById('otp-modal').classList.add('d-none');
        showToast('OTP verified successfully!', 'success');
        if (otpSuccessCallback) {
          otpSuccessCallback();
        }
      } else {
        showToast('Invalid OTP. Please try again.', 'error');
      }
    }
  });

  document.getElementById('otp-resend-btn').addEventListener('click', () => {
    const group2Visible = !document.getElementById('otp-group-2').classList.contains('d-none');
    if (group2Visible) {
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      generatedOtp2 = Math.floor(1000 + Math.random() * 9000).toString();
      showToast(`✉️ EMAIL-OTP: Your new email OTP is ${generatedOtp}`, 'info');
      showToast(`📱 MOBILE-OTP: Your new mobile OTP is ${generatedOtp2}`, 'info');
    } else {
      const maxLen = parseInt(document.getElementById('otp-code-input').maxLength || '4');
      if (maxLen === 6) {
        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const is2FA = document.querySelector('#otp-modal p').innerHTML.includes('2FA');
        if (is2FA) {
          console.log(`🔒 [ADMIN 2FA CODE] New OTP is: ${generatedOtp}`);
          showToast(`🔒 New security notification sent to Admin's registered channels.`, 'info');
        } else {
          showToast(`✉️ SECURE-AUTH: Your new verification code is ${generatedOtp}.`, 'info');
        }
      } else {
        generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
        showToast(`🔑 GT-SECURE: Your new verification OTP is ${generatedOtp}.`, 'info');
      }
    }
  });

  // Simulated gateway triggers
  document.getElementById('gateway-submit-pay-btn').addEventListener('click', submitMockPayment);
  document.getElementById('gateway-cancel-pay-btn').addEventListener('click', cancelPayment);

  // Bind custom payment tabs in gateway
  document.querySelectorAll('.pay-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.pay-tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const tabId = e.currentTarget.getAttribute('data-pay-tab'); // pay-tab-qr or pay-tab-card
      document.querySelectorAll('.pay-tab-content').forEach(c => c.classList.add('d-none'));
      document.getElementById(tabId).classList.remove('d-none');
    });
  });

  // Profile forms
  document.getElementById('profile-add-address-form').addEventListener('submit', handleProfileAddAddress);

  // Admin Dashboard main tab buttons
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      renderAdminView();
    });
  });

  // Admin orders filter select
  document.getElementById('admin-order-status-filter').addEventListener('change', () => {
    loadAdminOrders();
  });

  // Admin Product CRUD buttons
  document.getElementById('btn-add-product-modal').addEventListener('click', () => openProductModal(null));
  document.getElementById('close-product-modal-btn').addEventListener('click', () => {
    document.getElementById('product-modal').classList.add('d-none');
  });
  document.getElementById('btn-cancel-product-modal').addEventListener('click', () => {
    document.getElementById('product-modal').classList.add('d-none');
  });
  document.getElementById('product-form').addEventListener('submit', handleSaveProduct);

  // Custom premium Image Uploader hooks
  const fileInput = document.getElementById('prod-image-file');
  const uploadZone = document.getElementById('image-upload-zone');
  const previewContainer = document.getElementById('image-upload-preview');
  const previewImg = document.getElementById('upload-preview-img');
  const hiddenImgInput = document.getElementById('prod-image');
  const removePreviewBtn = document.getElementById('btn-remove-preview');

  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    removePreviewBtn.addEventListener('click', () => {
      fileInput.value = '';
      hiddenImgInput.value = '';
      previewImg.src = '';
      previewContainer.classList.add('d-none');
      uploadZone.classList.remove('d-none');
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      hiddenImgInput.value = event.target.result;
      previewImg.src = event.target.result;
      previewContainer.classList.remove('d-none');
      uploadZone.classList.add('d-none');
    };
    reader.readAsDataURL(file);
  }

  // Admin Payout QR code uploader
  const qrFileInput = document.getElementById('setting-qr-image-file');
  const qrUploadZone = document.getElementById('setting-qr-upload-zone');
  const qrPreviewContainer = document.getElementById('setting-qr-preview-container');
  const qrPreviewImg = document.getElementById('setting-qr-preview-img');
  const qrHiddenInput = document.getElementById('setting-qr-code-url');
  const qrRemoveBtn = document.getElementById('btn-remove-qr-preview');

  if (qrUploadZone && qrFileInput) {
    qrUploadZone.addEventListener('click', () => qrFileInput.click());

    qrFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
          showToast('Please upload a valid image file.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          qrHiddenInput.value = event.target.result;
          qrPreviewImg.src = event.target.result;
          qrPreviewContainer.classList.remove('d-none');
          qrUploadZone.classList.add('d-none');
        };
        reader.readAsDataURL(file);
      }
    });

    if (qrRemoveBtn) {
      qrRemoveBtn.addEventListener('click', () => {
        qrFileInput.value = '';
        qrHiddenInput.value = '';
        qrPreviewImg.src = '';
        qrPreviewContainer.classList.add('d-none');
        qrUploadZone.classList.remove('d-none');
      });
    }
  }

  // Admin Payout Settings Form submit
  const settingsForm = document.getElementById('admin-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accountNumber = document.getElementById('setting-account-number').value.trim();
      const phone = document.getElementById('setting-phone').value.trim();
      const qrCodeUrl = qrHiddenInput.value;

      try {
        await apiCall('/auth/settings', 'PUT', { accountNumber, phone, qrCodeUrl });
        showToast('Business credentials saved successfully!', 'success');
        loadAdminSettings();
      } catch (err) {
        showToast('Failed to save settings: ' + err.message, 'error');
      }
    });
  }

  // Admin Coupon form
  document.getElementById('admin-add-coupon-form').addEventListener('submit', handleCreateCoupon);

  // Admin privilege transfer forms
  document.getElementById('transfer-confirm-checkbox').addEventListener('change', (e) => {
    document.getElementById('transfer-admin-btn').disabled = !e.target.checked;
  });
  document.getElementById('admin-transfer-form').addEventListener('submit', handleAdminTransfer);

  // Admin credentials update
  const adminCredentialsForm = document.getElementById('admin-credentials-form');
  if (adminCredentialsForm) {
    adminCredentialsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-setting-email').value.trim();
      const password = document.getElementById('admin-setting-password').value;
      const confirmPassword = document.getElementById('admin-setting-confirm-password').value;

      if (password && password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      const payload = { email };
      if (password) {
        payload.password = password;
      }

      try {
        const res = await apiCall('/auth/update-credentials', 'PUT', payload);
        // Update local session
        state.user.email = res.user.email;
        localStorage.setItem('user', JSON.stringify(state.user));
        
        showToast('Admin credentials updated successfully!', 'success');
        
        // Clear password inputs
        document.getElementById('admin-setting-password').value = '';
        document.getElementById('admin-setting-confirm-password').value = '';
      } catch (err) {
        showToast('Failed to update credentials: ' + err.message, 'error');
      }
    });
  }

  // Close tracking timeline modal
  document.getElementById('close-tracking-modal-btn').addEventListener('click', () => {
    document.getElementById('order-tracking-modal').classList.add('d-none');
  });

  // Forms Auth triggers
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('d-none');

    try {
      const res = await apiCall('/auth/login', 'POST', { email, password });
      
      if (res.user.role === 'admin') {
        triggerAdminLoginOtpFlow(res.token, res.user);
      } else {
        saveSession(res.token, res.user);
        showToast(`Welcome back, ${res.user.name}!`, 'success');
        if (res.user.role === 'delivery') {
          window.location.hash = '#delivery';
        } else {
          window.location.hash = '#shop';
        }
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('d-none');
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');
    errorEl.classList.add('d-none');

    // Custom phone number validation
    const phonePattern = /^[6-9]\d{9}$/;
    if (!phonePattern.test(phone)) {
      errorEl.textContent = 'Invalid Mobile Number. Please enter a valid 10-digit mobile number starting with 6-9.';
      errorEl.classList.remove('d-none');
      showToast('Wrong mobile number format!', 'error');
      return;
    }

    // Custom email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errorEl.textContent = 'Invalid Email Address. Please enter a valid email.';
      errorEl.classList.remove('d-none');
      showToast('Wrong email format!', 'error');
      return;
    }

    // Trigger OTP flow before calling register API
    triggerRegisterOtpFlow(phone, async () => {
      try {
        const res = await apiCall('/auth/register', 'POST', { name, email, phone, password });
        saveSession(res.token, res.user);
        showToast(`Account registered! Welcome to Gaya Ji Traders, ${res.user.name}.`, 'success');
        window.location.hash = '#shop';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('d-none');
      }
    });
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  // Demo autofill click events
  document.querySelectorAll('.btn-demo-fill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.getElementById('login-email').value = e.target.dataset.email;
      document.getElementById('login-password').value = e.target.dataset.pass;
    });
  });

  // Bootstrapping
  updateNavigation();
  router();
  initHeroSlider();

  // Load initial profile details if session already exists
  if (state.token) {
    loadProfile();
  }

  // Periodic Polling (notifications checking)
  pollNotifications();
  setInterval(pollNotifications, 10000); // 10s intervals
});
