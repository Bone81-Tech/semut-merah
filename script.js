(function() {
    // --- Registrasi Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').then(reg => console.log('SW terdaftar')).catch(err => console.log('SW Gagal', err));
        });
    }

    // --- State Aplikasi ---
    let cart = [];
    let favorites = [];
    let orderHistory = [
        {
            orderId: '#12345', date: '2024-07-28', total: 40000, status: 'Selesai',
            trackingDetails: [
                { step: 'Pesanan Diterima', time: '10:30 WIB', completed: true },
                { step: 'Sedang Dimasak', time: '10:35 WIB', completed: true },
                { step: 'Dalam Perjalanan', time: '10:55 WIB', completed: true },
                { step: 'Tiba di Tujuan', time: '11:15 WIB', completed: true },
            ]
        }
    ];

    let currentUser = null;

    const API_URL = 'https://script.google.com/macros/s/AKfycbywckU7WUg84x77b3WMyFSspigNsBRbzjNTH9KrZQ9w1-5HI4uetHbH03571rd2J0ILxQ/exec';
    let products = []; // Change to let so it can be reassigned

    // Helper function to load data from localStorage
    function loadData() {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        favorites = JSON.parse(localStorage.getItem('favorites')) || [];
        orderHistory = JSON.parse(localStorage.getItem('orderHistory')) || [];
        currentUser = JSON.parse(localStorage.getItem('currentUser'));
    }

    // Helper function to save data to localStorage
    function saveData() {
        localStorage.setItem('cart', JSON.stringify(cart));
        localStorage.setItem('favorites', JSON.stringify(favorites));
        localStorage.setItem('orderHistory', JSON.stringify(orderHistory));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
    }

    function showToast(message, isError = false) {
        let toastEl = document.getElementById('toastNotification');
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.id = 'toastNotification';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = message;
        toastEl.className = isError ? 'toast-error' : 'toast-success';
        toastEl.style.opacity = 1;
        setTimeout(() => {
            toastEl.style.opacity = 0;
        }, 3000);
    }

    loadData(); // Load data on script initialization

    // --- Elemen DOM ---
    const productListEl = document.getElementById('productList');
    const cartCountEl = document.getElementById('cartCount');
    const cartIconEl = document.getElementById('cartIcon');
    const cartOverlayEl = document.getElementById('cartOverlay');
    const closeCartBtnEl = document.getElementById('closeCartBtn');
    const cartItemsContainerEl = document.getElementById('cartItemsContainer');
    const checkoutBtnEl = document.getElementById('checkoutBtn');
    const searchInputEl = document.getElementById('searchInput');
    const searchButtonEl = document.getElementById('searchButton');
    const profileOverlayEl = document.getElementById('profileOverlay');
    const closeProfileBtnEl = document.getElementById('closeProfileBtn');
    const profileLinkEl = document.getElementById('profilLink');
    const favoritesContainerEl = document.getElementById('favoritesContainer');
    const orderHistoryContainerEl = document.getElementById('orderHistoryContainer');
    const trackingOverlayEl = document.getElementById('trackingOverlay');
    const closeTrackingBtnEl = document.getElementById('closeTrackingBtn');
    const trackingContentEl = document.getElementById('trackingContent');
    const checkoutFormOverlayEl = document.getElementById('checkoutFormOverlay');
    const closeCheckoutFormBtnEl = document.getElementById('closeCheckoutFormBtn');
    const checkoutFormEl = document.getElementById('checkoutForm');
    const loginOverlayEl = document.getElementById('loginOverlay');
    const closeLoginBtnEl = document.getElementById('closeLoginBtn');
    const loginFormEl = document.getElementById('loginForm');
    const registerOverlayEl = document.getElementById('registerOverlay');
    const closeRegisterBtnEl = document.getElementById('closeRegisterBtn');
    const registerFormEl = document.getElementById('registerForm');
    const loginLinkEl = document.getElementById('loginLink');
    const registerLinkEl = document.getElementById('registerLink');

    function generateStars(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        for (let i = 0; i < 5; i++) { stars += i < fullStars ? '<span>&#9733;</span>' : '<span>&#9734;</span>'; }
        return stars;
    }
    window.generateStars = generateStars; // Expose globally

    async function fetchProductsFromAPI() {
        try {
            const response = await fetch(API_URL);
            const result = await response.json();
            if (result.success && result.data) {
                console.log('Raw item.url_gambar from API:', result.data.map(item => item.url_gambar));
                return result.data.map(item => ({
                    id: parseInt(item.id_produk.replace('ujicoba_', '')), // Assuming id_produk is like ujicoba_001
                    name: item.nama_produk,
                    price: item.harga,
                    imageUrl: item.url_gambar,
                    rating: parseFloat(item.rating) || 0, // Convert to number, default to 0
                    reviewCount: parseInt(item.jumlah_ulasan) || 0 // Convert to number, default to 0
                }));
            } else {
                console.error('API returned an error:', result.message);
                return [];
            }
        } catch (error) {
            console.error('Error fetching products from API:', error);
            return [];
        }
    }

    function renderProducts(productsToRender) {
        if (!productListEl) return;
        productListEl.innerHTML = '';
        productsToRender.forEach(product => {
            const isFavorited = favorites.some(fav => fav.id === product.id);
            const productCard = document.createElement('div');
            productCard.className = 'produk-card';
            productCard.innerHTML = `
                <a href="product-detail.html?id=${product.id}" class="product-card-link">
                    <div class="produk-card-header">
                        <img src="${product.imageUrl}" alt="${product.name}">
                        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${product.id}">&#10084;</button>
                    </div>
                    <h3>${product.name}</h3>
                    <div class="rating">
                        <div class="stars">${generateStars(product.rating)}</div>
                        <span class="review-count">(${product.reviewCount})</span>
                    </div>
                    <p class="harga">Rp ${product.price.toLocaleString('id-ID')}</p>
                </a>
                <button class="add-to-cart-btn" data-id="${product.id}">Tambah ke Keranjang</button>
            `;
            productListEl.appendChild(productCard);
        });
    }

    function renderCart() {
        cartItemsContainerEl.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cartItemsContainerEl.innerHTML = '<p>Keranjang Anda kosong.</p>';
            checkoutBtnEl.disabled = true;
        } else {
            checkoutBtnEl.disabled = false;
            cart.forEach(item => {
                const cartItemEl = document.createElement('div');
                cartItemEl.className = 'cart-item';
                cartItemEl.innerHTML = `
                    <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p>Rp ${item.price.toLocaleString('id-ID')}</p>
                        <div class="quantity-controls">
                            <button class="minus-btn" data-id="${item.id}">-</button>
                            <input type="number" class="quantity-input" value="${item.quantity}" min="1" data-id="${item.id}">
                            <button class="plus-btn" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button class="remove-item-btn" data-id="${item.id}">&times;</button>
                `;
                cartItemsContainerEl.appendChild(cartItemEl);
                total += item.price * item.quantity;
            });
        }

        let cartTotalEl = document.getElementById('cartTotal');
        if (!cartTotalEl) {
            cartTotalEl = document.createElement('p');
            cartTotalEl.id = 'cartTotal';
            cartItemsContainerEl.parentNode.insertBefore(cartTotalEl, checkoutBtnEl);
        }
        cartTotalEl.innerHTML = `<strong>Total: Rp ${total.toLocaleString('id-ID')}</strong>`;

        saveData();
    }

    function renderFavorites() {
        favoritesContainerEl.innerHTML = '';
        if (favorites.length === 0) {
            favoritesContainerEl.innerHTML = '<p>Anda belum memiliki item favorit.</p>';
        } else {
            favorites.forEach(item => {
                const favoriteItemEl = document.createElement('div');
                favoriteItemEl.className = 'cart-item';
                favoriteItemEl.innerHTML = `
                    <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p>Rp ${item.price.toLocaleString('id-ID')}</p>
                    </div>
                    <button class="remove-item-btn" data-id="${item.id}" data-type="favorite">&times;</button>
                `;
                favoritesContainerEl.appendChild(favoriteItemEl);
            });
        }
    }

    function renderOrderHistory() {
        orderHistoryContainerEl.innerHTML = '';
        if (orderHistory.length === 0) {
            orderHistoryContainerEl.innerHTML = '<p>Anda belum memiliki riwayat pesanan.</p>';
        } else {
            orderHistory.forEach(order => {
                const orderItemEl = document.createElement('div');
                orderItemEl.className = 'cart-item order-item';
                orderItemEl.dataset.orderId = order.orderId;
                orderItemEl.innerHTML = `
                    <div class="cart-item-details">
                        <h4>Pesanan ${order.orderId}</h4>
                        <p>Tanggal: ${order.date}</p>
                        <p>Total: Rp ${order.total.toLocaleString('id-ID')}</p>
                        <p>Status: ${order.status}</p>
                    </div>
                `;
                orderHistoryContainerEl.appendChild(orderItemEl);
            });
        }
    }

    function renderTrackingDetails(orderId) {
        const order = orderHistory.find(o => o.orderId === orderId);
        trackingContentEl.innerHTML = '';
        if (order && order.trackingDetails) {
            const trackingList = document.createElement('ul');
            trackingList.className = 'tracking-timeline';
            order.trackingDetails.forEach(step => {
                const stepEl = document.createElement('li');
                stepEl.className = `tracking-step ${step.completed ? 'completed' : ''}`;
                stepEl.innerHTML = `<p>${step.step}</p><span class="step-time">${step.time}</span>`;
                trackingList.appendChild(stepEl);
            });
            trackingContentEl.appendChild(trackingList);
        } else {
            trackingContentEl.innerHTML = '<p>Detail pelacakan tidak tersedia.</p>';
        }
    }

    // --- Fungsi Logika ---
    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            const existingItem = cart.find(item => item.id === productId);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                cart.push({ ...product, quantity: 1 });
            }
            updateCartCount();
            renderCart();
            saveData();
            showToast(`${product.name} ditambahkan ke keranjang!`);
        }
    }

    function toggleFavorite(productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            const existingFavoriteIndex = favorites.findIndex(fav => fav.id === productId);
            if (existingFavoriteIndex > -1) {
                favorites.splice(existingFavoriteIndex, 1);
                showToast(`${product.name} dihapus dari favorit.`);
            } else {
                favorites.push(product);
                showToast(`${product.name} ditambahkan ke favorit!`);
            }
            renderProducts(products);
            saveData();
        }
    }

    function updateCartItemQuantity(productId, change) {
        const item = cart.find(i => i.id === productId);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                removeCartItem(productId);
            }
            updateCartCount();
            renderCart();
        }
    }

    function removeCartItem(productId) {
        cart = cart.filter(item => item.id !== productId);
        updateCartCount();
        renderCart();
    }

    function updateCartCount() { cartCountEl.textContent = cart.length; }

    function filterAndRenderProducts() {
        const searchTerm = searchInputEl.value.toLowerCase();
        const filteredProducts = products.filter(product => product.name.toLowerCase().includes(searchTerm));
        renderProducts(filteredProducts);
    }

    function processCheckout(event) {
        event.preventDefault();
        const customerName = document.getElementById('customerName').value.trim();
        const customerAddress = document.getElementById('customerAddress').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();

        if (!customerName || !customerAddress || !customerPhone) {
            showToast('Harap isi semua kolom formulir.');
            return;
        }

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const newOrder = {
            orderId: '#' + (Math.floor(Math.random() * 90000) + 10000),
            date: new Date().toISOString().slice(0, 10),
            total: total,
            status: 'Diproses',
            trackingDetails: [{ step: 'Pesanan Diterima', time: new Date().toLocaleTimeString('id-ID'), completed: true }]
        };

        orderHistory.unshift(newOrder);
        cart = [];
        updateCartCount();

        checkoutFormOverlayEl.classList.remove('active');
        cartOverlayEl.classList.remove('active');
        checkoutFormEl.reset();

        showToast(`Terima kasih, ${customerName}! Pesanan Anda (${newOrder.orderId}) sedang diproses.`);
        saveData();
    }

    function updateAuthUI() {
        const authButtonsContainer = document.querySelector('.auth-buttons');
        if (!authButtonsContainer) return;
        if (currentUser) {
            authButtonsContainer.innerHTML = `
                <span class="welcome-message">Halo, ${currentUser.nama_lengkap}!</span>
                <button id="logoutBtn" class="auth-btn">Logout</button>
            `;
            document.getElementById('logoutBtn').addEventListener('click', () => {
                currentUser = null;
                localStorage.removeItem('currentUser');
                updateAuthUI();
                showToast('Anda telah logout.');
            });
        } else {
            authButtonsContainer.innerHTML = `<button id="loginBtn" class="auth-btn">Login</button>`;
            document.getElementById('loginBtn').addEventListener('click', () => {
                loginOverlayEl.classList.add('active');
            });
        }
    }

    // --- Event Listeners ---
    if (searchButtonEl) searchButtonEl.addEventListener('click', filterAndRenderProducts);
    if (searchInputEl) searchInputEl.addEventListener('keyup', filterAndRenderProducts);
    if (cartIconEl) cartIconEl.addEventListener('click', () => { renderCart(); cartOverlayEl.classList.add('active'); });
    if (closeCartBtnEl) closeCartBtnEl.addEventListener('click', () => { cartOverlayEl.classList.remove('active'); });
    if (checkoutBtnEl) checkoutBtnEl.addEventListener('click', () => {
        if (cart.length === 0) {
            showToast('Keranjang Anda masih kosong.');
            return;
        }
        cartOverlayEl.classList.remove('active');
        checkoutFormOverlayEl.classList.add('active');
    });
    if (closeCheckoutFormBtnEl) closeCheckoutFormBtnEl.addEventListener('click', () => { checkoutFormOverlayEl.classList.remove('active'); });
    if (checkoutFormEl) checkoutFormEl.addEventListener('submit', processCheckout);
    if (cartItemsContainerEl) {
        cartItemsContainerEl.addEventListener('click', (event) => {
            const target = event.target;
            const productId = parseInt(target.dataset.id);
            if (target.classList.contains('minus-btn')) updateCartItemQuantity(productId, -1);
            else if (target.classList.contains('plus-btn')) updateCartItemQuantity(productId, 1);
            else if (target.classList.contains('remove-item-btn')) removeCartItem(productId);
        });
        cartItemsContainerEl.addEventListener('change', (event) => {
            const target = event.target;
            if (target.classList.contains('quantity-input')) {
                const productId = parseInt(target.dataset.id);
                const newQuantity = parseInt(target.value);
                const item = cart.find(i => i.id === productId);
                if (item && newQuantity > 0) {
                    item.quantity = newQuantity;
                    updateCartCount();
                    renderCart();
                } else if (item && newQuantity <= 0) {
                    removeCartItem(productId);
                }
            }
        });
    }
    if (profileLinkEl) profileLinkEl.addEventListener('click', (e) => { e.preventDefault(); renderFavorites(); renderOrderHistory(); profileOverlayEl.classList.add('active'); });
    if (closeProfileBtnEl) closeProfileBtnEl.addEventListener('click', () => { profileOverlayEl.classList.remove('active'); });
    if (orderHistoryContainerEl) orderHistoryContainerEl.addEventListener('click', (event) => {
        const orderItem = event.target.closest('.order-item');
        if (orderItem) {
            const orderId = orderItem.dataset.orderId;
            renderTrackingDetails(orderId);
            trackingOverlayEl.classList.add('active');
        }
    });
    if (closeTrackingBtnEl) closeTrackingBtnEl.addEventListener('click', () => { trackingOverlayEl.classList.remove('active'); });
    if (closeLoginBtnEl) closeLoginBtnEl.addEventListener('click', () => { loginOverlayEl.classList.remove('active'); });

    if (loginFormEl) loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Loading...';

        try {
            // --- PERBAIKAN ---
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // Menambahkan redirect follow
                headers: {
                    'Content-Type': 'application/json', // Mengganti Content-Type
                },
                body: JSON.stringify({ action: 'login', data: { email, password } })
            });
            const result = await response.json();
            if (result.success) {
                currentUser = result.data;
                saveData();
                showToast(`Selamat datang, ${currentUser.nama_lengkap}!`);
                loginOverlayEl.classList.remove('active');
                updateAuthUI();
            } else {
                showToast(result.message, true);
            }
        } catch (error) {
            showToast('Gagal menghubungi server. Coba lagi nanti.', true);
        }
        button.disabled = false;
        button.textContent = 'Login';
    });

    if (registerLinkEl) registerLinkEl.addEventListener('click', (e) => { e.preventDefault(); loginOverlayEl.classList.remove('active'); registerOverlayEl.classList.add('active'); });
    if (closeRegisterBtnEl) closeRegisterBtnEl.addEventListener('click', () => { registerOverlayEl.classList.remove('active'); });

    if (registerFormEl) registerFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nama_lengkap = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const nomor_telepon = '-'; // Placeholder, add phone input if needed
        const button = e.target.querySelector('button');

        if (password !== confirmPassword) {
            showToast('Password dan Konfirmasi Password tidak cocok.', true);
            return;
        }

        button.disabled = true;
        button.textContent = 'Loading...';

        try {
            // --- PERBAIKAN ---
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // Menambahkan redirect follow
                headers: {
                    'Content-Type': 'application/json', // Mengganti Content-Type
                },
                body: JSON.stringify({
                    action: 'register',
                    data: { nama_lengkap, email, password, nomor_telepon }
                })
            });
            const result = await response.json();
            if (result.success) {
                showToast('Terima kasih, Anda sudah terdaftar, silakan login.');
                registerOverlayEl.classList.remove('active');
                loginOverlayEl.classList.add('active');
            } else {
                showToast(result.message, true);
            }
        } catch (error) {
            showToast('Gagal menghubungi server. Coba lagi nanti.', true);
        }
        button.disabled = false;
        button.textContent = 'Daftar';
    });

    if (loginLinkEl) loginLinkEl.addEventListener('click', (e) => { e.preventDefault(); registerOverlayEl.classList.remove('active'); loginOverlayEl.classList.add('active'); });
    if (productListEl) productListEl.addEventListener('click', (event) => {
        const target = event.target;
        const targetId = parseInt(target.dataset.id);
        if (target.classList.contains('add-to-cart-btn')) { addToCart(targetId); }
        if (target.classList.contains('favorite-btn')) {
            event.preventDefault(); // Prevent link navigation
            toggleFavorite(targetId);
        }
    });

    // --- Inisialisasi Awal ---
    document.addEventListener('DOMContentLoaded', () => {
        updateAuthUI();
        (async () => {
            products = await fetchProductsFromAPI();
            renderProducts(products);
            updateCartCount(); // Initial cart count update
        })();
    });

})();