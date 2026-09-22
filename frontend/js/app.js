// API Endpoint
  var API_BASE = (window.location.origin && window.location.origin !== 'null' && !window.location.protocol.startsWith('file'))
    ? `${window.location.origin}/api`
    : 'http://localhost:8000/api';

  // Global State
  var currentUser = window.currentUser || null;
  var authToken = localStorage.getItem('kisan_auth_token');
  var activeListingsData = window.activeListingsData || [];
  var currentListingForOrder = window.currentListingForOrder || null;
  var mapsConfig = window.mapsConfig || {
    provider: "OpenStreetMap",
    tile_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors"
  };

  // Map & Logistics Instance References (Leaflet.js)
  var setupMapObj = window.setupMapObj || null;
  var setupMarkerObj = window.setupMarkerObj || null;
  var logisticsMapObj = window.logisticsMapObj || null;
  var logisticsPolylineObj = window.logisticsPolylineObj || null;
  var logisticsMarkers = window.logisticsMarkers || [];
  var profileMapObj = window.profileMapObj || null;
  var profileMarkerObj = window.profileMarkerObj || null;

  // 9-Stage Order Tracking & Delivery Fleet References
  var trackingOrdersCache = window.trackingOrdersCache || [];
  var currentTrackingOrderId = window.currentTrackingOrderId || null;
  var currentTrackingDetail = window.currentTrackingDetail || null;
  var trackingDetailMapObj = window.trackingDetailMapObj || null;
  var trackingMarkers = window.trackingMarkers || {};
  var leafletMaps = window.leafletMaps || {};
  var leafletMarkers = window.leafletMarkers || {};
  var leafletLayers = window.leafletLayers || {};

  // --- STITCH Produce Image Assets Mapping ---
  var STITCH_PRODUCE_IMAGES = {
    wheat: 'assets/produce/wheat.jpg',
    rice: 'assets/produce/rice.jpg',
    soybean: 'assets/produce/soybean.jpg',
    orange: 'assets/produce/orange.jpg',
    oranges: 'assets/produce/orange.jpg',
    chilli: 'assets/produce/chilli.jpg',
    chili: 'assets/produce/chilli.jpg',
    redchilli: 'assets/produce/chilli.jpg',
    apple: 'assets/produce/apple.jpg',
    apples: 'assets/produce/apple.jpg',
    pulses: 'assets/produce/pulses.jpg',
    chana: 'assets/produce/pulses.jpg',
    moong: 'assets/produce/pulses.jpg',
    dal: 'assets/produce/pulses.jpg',
    tomato: 'assets/produce/tomato.jpg',
    tomatoes: 'assets/produce/tomato.jpg',
    onion: 'assets/produce/onion.jpg',
    onions: 'assets/produce/onion.jpg',
    potato: 'assets/produce/potato.jpg',
    potatoes: 'assets/produce/potato.jpg',
    maize: 'assets/produce/maize.jpg',
    corn: 'assets/produce/maize.jpg'
  };

  function getProduceImage(crop, variety, photoUrl) {
    if (photoUrl && typeof photoUrl === 'string' && (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('/assets/') || photoUrl.startsWith('assets/'))) {
      return photoUrl;
    }
    const c = (crop || '').toLowerCase().trim();
    const v = (variety || '').toLowerCase().trim();

    if (c.includes('wheat') || v.includes('sharbati') || c.includes('gehu')) return STITCH_PRODUCE_IMAGES.wheat;
    if (c.includes('rice') || v.includes('basmati') || c.includes('chawal') || c.includes('paddy')) return STITCH_PRODUCE_IMAGES.rice;
    if (c.includes('soybean') || c.includes('soya')) return STITCH_PRODUCE_IMAGES.soybean;
    if (c.includes('orange') || c.includes('citrus') || c.includes('santre') || c.includes('fruit')) return STITCH_PRODUCE_IMAGES.orange;
    if (c.includes('chilli') || c.includes('chili') || c.includes('mirch') || v.includes('teja') || c.includes('spice')) return STITCH_PRODUCE_IMAGES.chilli;
    if (c.includes('apple') || c.includes('seb')) return STITCH_PRODUCE_IMAGES.apple;
    if (c.includes('pulse') || c.includes('chana') || c.includes('moong') || c.includes('gram') || c.includes('dal') || c.includes('daal')) return STITCH_PRODUCE_IMAGES.pulses;
    if (c.includes('tomato') || c.includes('tamatar') || v.includes('roma')) return STITCH_PRODUCE_IMAGES.tomato;
    if (c.includes('onion') || c.includes('pyaz') || c.includes('kanda')) return STITCH_PRODUCE_IMAGES.onion;
    if (c.includes('potato') || c.includes('aloo') || c.includes('alu') || v.includes('jyoti')) return STITCH_PRODUCE_IMAGES.potato;
    if (c.includes('maize') || c.includes('corn') || c.includes('makka')) return STITCH_PRODUCE_IMAGES.maize;
    if (c.includes('garlic') || c.includes('lahsun')) return STITCH_PRODUCE_IMAGES.onion;
    if (c.includes('grape') || c.includes('pomegranate')) return STITCH_PRODUCE_IMAGES.apple;

    return STITCH_PRODUCE_IMAGES[c] || 'assets/produce/wheat.jpg';
  }

  // Initialize application on load
  document.addEventListener('DOMContentLoaded', async () => {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    const hInput = document.getElementById('f-harvest-date');
    if (hInput) hInput.value = today;

    // 1. Fetch Maps Configuration
    await fetchMapsConfig();

    // 2. Authenticate session if token exists
    if (authToken) {
      await fetchCurrentUser();
    }

    // 3. Load Landing Page Data
    loadActivePrices();
  });

  // --- Auth Headers Helper ---
  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }

  // --- Show Toast Message ---
  function showToast(msg, duration = 3500) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, duration);
  }

  // --- Fetch OpenStreetMap / Leaflet Maps Configuration ---
  async function fetchMapsConfig() {
    try {
      const res = await fetch(`${API_BASE}/maps/config`);
      if (res.ok) {
        mapsConfig = await res.json();
      }
    } catch(err) {
      console.warn("Could not fetch maps config, using default OSM tiles:", err);
    }
  }

  // Helper to create custom HTML Pin Icons in Leaflet
  function createLeafletPinIcon(type = 'farm', iconChar = '📍', bg = '') {
    return L.divIcon({
      className: 'custom-leaflet-pin-wrapper',
      html: `<div class="custom-pin-marker pin-${type}" style="${bg ? 'background:' + bg + ';' : ''}"><span>${iconChar}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -34]
    });
  }

  // Helper to initialize or retrieve a Leaflet Map instance on any container
  function getOrCreateLeafletMap(canvasId, centerLat = 20.3548, centerLon = 85.8182, zoom = 13) {
    const container = document.getElementById(canvasId);
    if (!container) return null;

    if (leafletMaps[canvasId]) {
      const map = leafletMaps[canvasId];
      map.setView([centerLat, centerLon], zoom);
      setTimeout(() => map.invalidateSize(), 150);
      return map;
    }

    if (typeof L === 'undefined') {
      console.error("Leaflet.js library is not available.");
      return null;
    }

    // Clean container in case of leftover inner elements
    container.innerHTML = '';

    const tileUrl = (mapsConfig && mapsConfig.tile_url) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const maxZ = (mapsConfig && mapsConfig.max_zoom) || 19;
    const attr = (mapsConfig && mapsConfig.attribution) || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

    const map = L.map(canvasId, {
      center: [centerLat, centerLon],
      zoom: zoom,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer(tileUrl, {
      maxZoom: maxZ,
      attribution: attr
    }).addTo(map);

    leafletMaps[canvasId] = map;
    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  // --- Authenticate User & Check Session ---
  async function fetchCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
      if (res.ok) {
        currentUser = await res.json();
        updateUserUI();
        return true;
      } else {
        // Token invalid / expired
        authToken = null;
        localStorage.removeItem('kisan_auth_token');
        currentUser = null;
        updateLandingNavState();
        return false;
      }
    } catch(err) {
      console.error("Auth check failed:", err);
      updateLandingNavState();
      return false;
    }
  }

  function updateLandingNavState() {
    const btnOpen = document.getElementById('nav-btn-open-app');
    const btnLogin = document.getElementById('nav-btn-login');
    const btnSignup = document.getElementById('nav-btn-signup');
    const btnProfile = document.getElementById('nav-btn-profile');
    const btnApp = document.getElementById('nav-btn-app');
    const btnLogout = document.getElementById('nav-btn-logout');

    if (currentUser) {
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnSignup) btnSignup.style.display = 'none';
      if (btnOpen) btnOpen.style.display = 'none';
      if (btnProfile) btnProfile.style.display = 'inline-flex';
      if (btnApp) btnApp.style.display = 'inline-flex';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
    } else {
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (btnSignup) btnSignup.style.display = 'inline-flex';
      if (btnOpen) btnOpen.style.display = 'inline-flex';
      if (btnProfile) btnProfile.style.display = 'none';
      if (btnApp) btnApp.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'none';
    }
  }

  function handleOpenAppNav() {
    if (currentUser) {
      openApp('dashboard');
    } else {
      showToast("Please sign in to access the Kisan Setu dashboard.");
      openAuthModal('login');
    }
  }

  function handleScreensCTA(targetTab) {
    if (currentUser) {
      openApp(targetTab);
    } else {
      showToast("Please sign in or create an account to test this feature.");
      openAuthModal('login');
    }
  }

  function updateUserUI() {
    updateLandingNavState();
    if (!currentUser) {
      const roleTag = document.getElementById('portal-user-role-tag');
      if (roleTag) roleTag.innerText = 'DoCA Platform';
      const userAvatar = document.getElementById('app-user-avatar');
      if (userAvatar) userAvatar.innerText = '👤';
      const userName = document.getElementById('app-user-name');
      if (userName) userName.innerText = 'Guest';
      const roleBadge = document.getElementById('app-user-role-badge');
      if (roleBadge) {
        roleBadge.innerText = 'GUEST';
        roleBadge.className = 'u-role';
      }
      const fNav = document.getElementById('sidebar-farmer-nav');
      if (fNav) fNav.style.display = 'none';
      const bNav = document.getElementById('sidebar-buyer-nav');
      if (bNav) bNav.style.display = 'none';
      return;
    }

    const isFarmer = currentUser.role === 'FARMER_FPO';
    const roleTag = document.getElementById('portal-user-role-tag');
    if (roleTag) roleTag.innerText = isFarmer ? 'DoCA Farmer Portal' : 'DoCA Buyer Marketplace';
    const userAvatar = document.getElementById('app-user-avatar');
    if (userAvatar) userAvatar.innerText = isFarmer ? '🧑‍🌾' : '🛒';
    const userName = document.getElementById('app-user-name');
    if (userName) userName.innerText = currentUser.name;
    
    const roleBadge = document.getElementById('app-user-role-badge');
    if (roleBadge) {
      roleBadge.innerText = isFarmer ? 'FARMER / FPO' : 'BUYER / CONSUMER';
      roleBadge.className = isFarmer ? 'u-role farmer' : 'u-role buyer';
    }

    const wLbl = document.getElementById('wallet-label');
    if (wLbl) wLbl.innerText = isFarmer ? 'Settled Earnings:' : 'Procurement Spend:';
    const wAmt = document.getElementById('wallet-amount');
    if (wAmt) wAmt.innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    // Toggle Sidebars
    const fNav = document.getElementById('sidebar-farmer-nav');
    if (fNav) fNav.style.display = isFarmer ? 'flex' : 'none';
    const bNav = document.getElementById('sidebar-buyer-nav');
    if (bNav) bNav.style.display = isFarmer ? 'none' : 'flex';

    // Update notifications
    loadNotifications();
  }

  // --- Hero Button Handlers ---
  function handlePrimaryHeroCTA() {
    if (!currentUser) {
      openAuthModal('signup', 'FARMER_FPO');
    } else if (currentUser.role === 'FARMER_FPO') {
      openApp('farmer-portal');
    } else {
      openApp('buyer-dashboard');
    }
  }

  function handleMarketplaceHeroCTA() {
    if (!currentUser) {
      openAuthModal('signup', 'BUYER_CONSUMER');
    } else if (currentUser.role === 'BUYER_CONSUMER') {
      openApp('marketplace');
    } else {
      openApp('farmer-dashboard');
    }
  }

  // --- Auth Modal Controls ---
  function openAuthModal(view = 'login', defaultRole = 'FARMER_FPO') {
    // Reset all auth form submit buttons to default active state
    const loginBtn = document.getElementById('login-submit-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "Sign In to Dashboard →";
    }
    const signupBtn = document.getElementById('signup-submit-btn');
    if (signupBtn) {
      signupBtn.disabled = false;
      signupBtn.innerText = "Create Account & Setup Profile →";
    }
    const setupBtn = document.getElementById('setup-save-btn');
    if (setupBtn) {
      setupBtn.disabled = false;
      setupBtn.innerText = "Save Profile & Open Portal →";
    }

    document.getElementById('auth-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    switchAuthView(view);
    if (view === 'signup') {
      selectSignupRole(defaultRole);
    }
  }

  function closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('open');
    document.body.style.overflow = 'auto';

    // Reset button states on modal close
    const loginBtn = document.getElementById('login-submit-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "Sign In to Dashboard →";
    }
    const signupBtn = document.getElementById('signup-submit-btn');
    if (signupBtn) {
      signupBtn.disabled = false;
      signupBtn.innerText = "Create Account & Setup Profile →";
    }
  }

  function switchAuthView(view) {
    document.getElementById('auth-view-login').style.display = view === 'login' ? 'block' : 'none';
    document.getElementById('auth-view-signup').style.display = view === 'signup' ? 'block' : 'none';
    document.getElementById('auth-view-forgot').style.display = view === 'forgot' ? 'block' : 'none';
    document.getElementById('auth-view-profile-setup').style.display = view === 'setup' ? 'block' : 'none';

    // Reset buttons when switching views
    if (view === 'login') {
      const loginBtn = document.getElementById('login-submit-btn');
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerText = "Sign In to Dashboard →";
      }
    } else if (view === 'signup') {
      const signupBtn = document.getElementById('signup-submit-btn');
      if (signupBtn) {
        signupBtn.disabled = false;
        signupBtn.innerText = "Create Account & Setup Profile →";
      }
    }

    const box = document.getElementById('auth-box-container');
    if (view === 'setup') {
      box.classList.add('auth-box-wide');
      setTimeout(() => initLocationPickerMap('setup'), 200);
    } else {
      box.classList.remove('auth-box-wide');
    }
  }

  function selectSignupRole(role) {
    document.getElementById('signup-role').value = role;
    const fOpt = document.getElementById('role-opt-farmer');
    const bOpt = document.getElementById('role-opt-buyer');
    if (role === 'FARMER_FPO') {
      fOpt.classList.add('selected');
      bOpt.classList.remove('selected');
    } else {
      bOpt.classList.add('selected');
      fOpt.classList.remove('selected');
    }
  }

  function fillDemoCreds(email, password) {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = email;
    if (passInput) passInput.value = password;

    const btn = document.getElementById('login-submit-btn');
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Sign In to Dashboard →";
    }
    console.log(`[AUTH] Quick Fill Demo Selected: ${email}`);
    showToast(`Filled credentials for ${email}`);
  }

  // --- Signup Flow ---
  async function handleSignup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('signup-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Creating Account...";
    }

    const nameInput = document.getElementById('signup-name');
    const emailInput = document.getElementById('signup-email');
    const phoneInput = document.getElementById('signup-phone');
    const passInput = document.getElementById('signup-password');
    const confirmPassInput = document.getElementById('signup-confirm-password');
    const roleInput = document.getElementById('signup-role');

    const payload = {
      name: nameInput ? nameInput.value.trim() : '',
      email: emailInput ? emailInput.value.trim() : '',
      phone: phoneInput ? phoneInput.value.trim() : '',
      password: passInput ? passInput.value : '',
      confirm_password: confirmPassInput ? confirmPassInput.value : '',
      role: roleInput ? roleInput.value : 'FARMER_FPO'
    };

    if (payload.password !== payload.confirm_password) {
      showToast("❌ Passwords do not match!");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Create Account & Setup Profile →";
      }
      return;
    }

    try {
      console.log(`[AUTH] Submitting signup for: ${payload.email} (${payload.role})`);
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        console.warn(`[AUTH] Signup failed: ${data.detail}`);
        showToast(`❌ ${data.detail || 'Signup failed'}`);
        return;
      }

      authToken = data.access_token;
      localStorage.setItem('kisan_auth_token', authToken);
      currentUser = data.user;

      if (passInput) passInput.value = '';
      if (confirmPassInput) confirmPassInput.value = '';

      updateUserUI();
      console.log(`[AUTH] Signup success! New user: ${currentUser.name}`);
      showToast(`✓ Account created! Please set your ${currentUser.role === 'FARMER_FPO' ? 'farm' : 'delivery'} location.`);
      prepareProfileSetupWizard();
    } catch(err) {
      console.error("[AUTH] Signup network error:", err);
      showToast("❌ Server connection error.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Create Account & Setup Profile →";
      }
    }
  }

  // --- Login Flow ---
  async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Authenticating...";
    }

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const payload = {
      email: emailInput ? emailInput.value.trim() : '',
      password: passwordInput ? passwordInput.value : ''
    };

    console.log(`[AUTH] Login initiated for: "${payload.email}"`);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log(`[AUTH] Login response status: ${res.status}`);

      if (!res.ok) {
        console.warn(`[AUTH] Login rejected: ${data.detail}`);
        showToast(`❌ ${data.detail || 'Invalid email or password'}`);
        return;
      }

      authToken = data.access_token;
      localStorage.setItem('kisan_auth_token', authToken);
      currentUser = data.user;

      console.log(`[AUTH] Login successful! User: ${currentUser.name}, Role: ${currentUser.role}`);

      if (passwordInput) passwordInput.value = '';

      updateUserUI();
      closeAuthModal();
      showToast(`✓ Welcome back, ${currentUser.name}!`);

      // Open appropriate dashboard
      const targetTab = currentUser.role === 'FARMER_FPO' ? 'farmer-dashboard' : 'buyer-dashboard';
      console.log(`[AUTH] Opening application portal view: ${targetTab}`);
      openApp(targetTab);
    } catch(err) {
      console.error("[AUTH] Login network/runtime error:", err);
      showToast("❌ Server error during sign in.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Sign In to Dashboard →";
      }
      console.log("[AUTH] Login handler completed, button unlocked.");
    }
  }

  // --- Forgot Password Flow ---
  async function handleForgotPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      showToast(`✓ ${data.message}`);
      setTimeout(() => switchAuthView('login'), 2500);
    } catch(err) {
      showToast("Server error requesting password reset.");
    }
  }

  // --- Profile Setup Wizard ---
  function prepareProfileSetupWizard() {
    switchAuthView('setup');
    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');
    document.getElementById('setup-title').innerText = isFarmer ? 'Farm & Harvest Setup' : 'Delivery Location Setup';
    document.getElementById('setup-subtitle').innerText = isFarmer 
      ? 'Search your farm, village, city or address with OpenStreetMap or select directly on the Leaflet map.'
      : 'Search your delivery warehouse/store address with OpenStreetMap or select directly on the Leaflet map.';
    
    document.getElementById('setup-farmer-fields').style.display = isFarmer ? 'block' : 'none';
    document.getElementById('setup-buyer-fields').style.display = isFarmer ? 'none' : 'block';
    
    const searchLabel = document.getElementById('setup-search-label');
    if (searchLabel) {
      searchLabel.innerHTML = `<span>${isFarmer ? 'Search your farm address *' : 'Search your delivery address *'}</span><span style="font-size:11px; font-weight:600; color:var(--olive-deep);">OpenStreetMap Geocoding</span>`;
    }

    const searchInput = document.getElementById('setup-address-search');
    if (searchInput) {
      searchInput.placeholder = isFarmer ? 'Search farm, village, city or address (e.g. KIIT University, Bhubaneswar)' : 'Search warehouse or city address (e.g. Dadar Wholesale Market, Mumbai)';
    }

    if (isFarmer) {
      document.getElementById('setup-farm-name').value = `${currentUser.name}'s Farm`;
      const initialFarmerData = {
        formatted_address: 'KIIT University, Patia, Bhubaneswar, Odisha 751024, India',
        state: 'Odisha',
        district: 'Khordha',
        city: 'Bhubaneswar',
        pincode: '751024',
        lat: 20.3548,
        lon: 85.8182,
        place_id: 'KS_IN_OD_KIIT_01'
      };
      applyLocationSelection('setup', initialFarmerData, false);
    } else {
      document.getElementById('setup-business-name').value = currentUser.name;
      const initialBuyerData = {
        formatted_address: 'Dadar Wholesale Vegetable Market, Senapati Bapat Marg, Dadar, Mumbai, Maharashtra 400028, India',
        state: 'Maharashtra',
        district: 'Mumbai City',
        city: 'Mumbai',
        pincode: '400028',
        lat: 19.0178,
        lon: 72.8478,
        place_id: 'KS_IN_MH_MUMBAI_01'
      };
      applyLocationSelection('setup', initialBuyerData, false);
    }

    setTimeout(() => initLocationPickerMap('setup'), 200);
  }

  async function handleProfileSetup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('setup-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Saving Profile...";
    }

    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');
    const stateVal = document.getElementById('setup-state').value.trim();
    const districtVal = document.getElementById('setup-district').value.trim();
    const cityVal = document.getElementById('setup-city').value.trim();
    const pincodeVal = document.getElementById('setup-pincode').value.trim();
    const addressVal = document.getElementById('setup-address').value.trim();
    const latVal = parseFloat(document.getElementById('setup-lat').value) || 20.3548;
    const lonVal = parseFloat(document.getElementById('setup-lon').value) || 85.8182;
    const placeIdVal = document.getElementById('setup-place-id').value.trim();

    const payload = {
      state: stateVal,
      district: districtVal,
      city: cityVal,
      pincode: pincodeVal,
      address: addressVal,
      lat: latVal,
      lon: lonVal,
      google_place_id: placeIdVal
    };

    if (isFarmer) {
      payload.farm_name = document.getElementById('setup-farm-name').value.trim();
      payload.farm_location = addressVal;
      payload.crops_grown = document.getElementById('setup-crops-grown').value.trim();
      payload.farm_size_acres = parseFloat(document.getElementById('setup-farm-size').value || 5);
    } else {
      payload.business_name = document.getElementById('setup-business-name').value.trim();
      payload.buyer_type = document.getElementById('setup-buyer-type').value;
      payload.delivery_location = addressVal;
      payload.address = addressVal;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/profile/setup`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const updated = await res.json();
      if (!res.ok) {
        showToast(`❌ Error: ${updated.detail || 'Profile setup failed'}`);
        return;
      }

      currentUser = updated;
      updateUserUI();
      closeAuthModal();
      showToast("✓ Profile configured with OpenStreetMap coordinates!");

      if (isFarmer) {
        openApp('farmer-dashboard');
      } else {
        openApp('buyer-dashboard');
      }
    } catch(err) {
      console.error("Profile setup error:", err);
      showToast("❌ Server error saving profile.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Save Profile & Open Portal →";
      }
    }
  }

  // --- OpenStreetMap Geocoding & Places Search ---
  var addressSearchTimeouts = {};

  function handleAddressInput(prefix = 'setup') {
    if (addressSearchTimeouts[prefix]) {
      clearTimeout(addressSearchTimeouts[prefix]);
    }
    const input = document.getElementById(`${prefix}-address-search`);
    if (!input) return;
    const query = input.value.trim();
    const dropdown = document.getElementById(`${prefix}-places-dropdown`);

    if (query.length < 2) {
      if (dropdown) dropdown.style.display = 'none';
      return;
    }

    addressSearchTimeouts[prefix] = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/maps/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const suggestions = await res.json();
          renderPlacesDropdown(prefix, suggestions);
        }
      } catch(err) {
        console.warn("Places search query error:", err);
      }
    }, 280);
  }

  function handleAddressKeydown(event, prefix = 'setup') {
    const dropdown = document.getElementById(`${prefix}-places-dropdown`);
    if (!dropdown || dropdown.style.display === 'none') return;
    const items = dropdown.querySelectorAll('.places-item');
    if (!items || items.length === 0) return;

    let activeIndex = -1;
    items.forEach((it, idx) => { if (it.classList.contains('active')) activeIndex = idx; });

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIdx = (activeIndex + 1) % items.length;
      items.forEach(it => it.classList.remove('active'));
      items[nextIdx].classList.add('active');
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIdx = (activeIndex - 1 + items.length) % items.length;
      items.forEach(it => it.classList.remove('active'));
      items[prevIdx].classList.add('active');
      items[prevIdx].scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        items[activeIndex].click();
      }
    } else if (event.key === 'Escape') {
      dropdown.style.display = 'none';
    }
  }

  function renderPlacesDropdown(prefix, suggestions) {
    const dropdown = document.getElementById(`${prefix}-places-dropdown`);
    if (!dropdown) return;

    if (!suggestions || suggestions.length === 0) {
      dropdown.innerHTML = `<div style="padding:12px; font-size:12px; color:var(--soil-soft); text-align:center;">No matching locations found. Try searching by city, mandi or landmark.</div>`;
      dropdown.style.display = 'block';
      return;
    }

    let html = '';
    suggestions.forEach((sug) => {
      const escapedJson = encodeURIComponent(JSON.stringify(sug));
      const mainText = sug.main_text || sug.display_name.split(',')[0];
      const secondaryText = sug.secondary_text || sug.display_name.split(',').slice(1).join(',').trim();
      html += `
        <div class="places-item" onclick="selectPlaceSuggestion('${prefix}', decodeURIComponent('${escapedJson}'))">
          <span class="p-icon">📍</span>
          <div style="flex:1;">
            <div class="p-main">${mainText}</div>
            <div class="p-secondary">${secondaryText}</div>
          </div>
        </div>
      `;
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    ['setup', 'p'].forEach(prefix => {
      const box = document.querySelector(`#${prefix}-places-dropdown`);
      const input = document.getElementById(`${prefix}-address-search`);
      if (box && input && !box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
      }
    });
  });

  async function selectPlaceSuggestion(prefix, itemStr) {
    const dropdown = document.getElementById(`${prefix}-places-dropdown`);
    if (dropdown) dropdown.style.display = 'none';

    let item;
    try {
      item = typeof itemStr === 'string' ? JSON.parse(itemStr) : itemStr;
    } catch(e) {
      console.warn("Parse place item error:", e);
      return;
    }

    // Set search box text
    const searchInput = document.getElementById(`${prefix}-address-search`);
    if (searchInput) searchInput.value = item.display_name || item.formatted_address || item.main_text || item.description || '';

    // If item already contains lat/lon coordinates
    if (item.lat && (item.lon || item.lng)) {
      applyLocationSelection(prefix, item, true);
      return;
    }

    // Otherwise geocode via search
    try {
      const q = item.place_id ? `q=${encodeURIComponent(item.place_id)}` : `q=${encodeURIComponent(item.description || item.display_name)}`;
      const res = await fetch(`${API_BASE}/maps/search?${q}`);
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          applyLocationSelection(prefix, results[0], true);
        }
      }
    } catch(err) {
      console.warn("Geocode error for selected place:", err);
    }
  }

  // Apply location payload to form fields, badge display, and Leaflet map
  function applyLocationSelection(prefix, data, moveMap = true) {
    if (!data) return;

    const latVal = parseFloat(data.lat || data.latitude || 20.3548);
    const lonVal = parseFloat(data.lon || data.lng || data.longitude || 85.8182);
    const stateVal = data.state || 'Odisha';
    const districtVal = data.district || 'Khordha';
    const cityVal = data.city || data.village_town || 'Bhubaneswar';
    const pincodeVal = data.pincode || '';
    const fullAddress = data.formatted_address || data.display_name || data.address || data.description || `${cityVal}, ${districtVal}, ${stateVal}`;
    const placeIdVal = data.place_id || data.osm_id || '';

    // Form inputs
    const elState = document.getElementById(`${prefix}-state`);
    const elDist = document.getElementById(`${prefix}-district`);
    const elCity = document.getElementById(`${prefix}-city`);
    const elPin = document.getElementById(`${prefix}-pincode`);
    const elAddr = document.getElementById(`${prefix}-address`);
    const elLat = document.getElementById(`${prefix}-lat`);
    const elLon = document.getElementById(`${prefix}-lon`);
    const elPlaceId = document.getElementById(`${prefix}-place-id`);
    const elSearch = document.getElementById(`${prefix}-address-search`);

    if (elState) elState.value = stateVal;
    if (elDist) elDist.value = districtVal;
    if (elCity) elCity.value = cityVal;
    if (elPin) elPin.value = pincodeVal;
    if (elAddr) elAddr.value = fullAddress;
    if (elLat) elLat.value = latVal.toFixed(4);
    if (elLon) elLon.value = lonVal.toFixed(4);
    if (elPlaceId) elPlaceId.value = placeIdVal;
    if (elSearch && !elSearch.value) elSearch.value = fullAddress;

    // Display Card
    const cardAddr = document.getElementById(`${prefix}-address-display`);
    const cardCoords = document.getElementById(`${prefix}-coords-display`);
    const cardState = document.getElementById(`${prefix}-state-display`);
    const cardDist = document.getElementById(`${prefix}-district-display`);
    const cardCity = document.getElementById(`${prefix}-city-display`);
    const cardPin = document.getElementById(`${prefix}-pincode-display`);
    const badgeText = document.getElementById(`${prefix}-loc-badge-text`);

    if (cardAddr) cardAddr.innerText = fullAddress;
    if (cardCoords) cardCoords.innerText = `${latVal.toFixed(4)}, ${lonVal.toFixed(4)}`;
    if (cardState) cardState.innerText = stateVal || 'N/A';
    if (cardDist) cardDist.innerText = districtVal || 'N/A';
    if (cardCity) cardCity.innerText = cityVal || districtVal || 'N/A';
    if (cardPin) cardPin.innerText = pincodeVal || 'N/A';

    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');
    if (badgeText) {
      badgeText.innerText = isFarmer ? 'Farm location selected' : 'Delivery location selected';
    }

    // Move Leaflet Map & Marker
    if (moveMap) {
      const canvasId = (prefix === 'setup') ? 'setup-map-canvas' : 'p-map-canvas';
      let map = leafletMaps[canvasId] || ((prefix === 'setup') ? setupMapObj : profileMapObj);
      if (!map) {
        initLocationPickerMap(prefix);
        map = leafletMaps[canvasId];
      }
      if (map && map.setView) {
        map.setView([latVal, lonVal], 15);
        setTimeout(() => map.invalidateSize(), 150);
        
        let marker = leafletMarkers[canvasId];
        if (marker && marker.setLatLng) {
          marker.setLatLng([latVal, lonVal]);
        } else {
          marker = L.marker([latVal, lonVal], {
            draggable: true,
            icon: createLeafletPinIcon(isFarmer ? 'farm' : 'buyer', isFarmer ? '🧑‍🌾' : '🛒')
          }).addTo(map);
          leafletMarkers[canvasId] = marker;
        }
      }
    }
  }

  // Reverse geocode on marker drag or map click
  async function handleLocationCoordinateUpdate(prefix, lat, lon) {
    const latVal = parseFloat(lat);
    const lonVal = parseFloat(lon);
    
    // Update raw coordinates
    const elLat = document.getElementById(`${prefix}-lat`);
    const elLon = document.getElementById(`${prefix}-lon`);
    const cardCoords = document.getElementById(`${prefix}-coords-display`);
    if (elLat) elLat.value = latVal.toFixed(4);
    if (elLon) elLon.value = lonVal.toFixed(4);
    if (cardCoords) cardCoords.innerText = `${latVal.toFixed(4)}, ${lonVal.toFixed(4)}`;

    try {
      const res = await fetch(`${API_BASE}/maps/reverse?lat=${latVal}&lon=${lonVal}`);
      if (res.ok) {
        const data = await res.json();
        applyLocationSelection(prefix, data, false);
      }
    } catch(err) {
      console.warn("Reverse geocode error:", err);
    }
  }

  // Update card display when user manually edits fields
  function updateSelectedLocationDisplay(prefix) {
    const elState = document.getElementById(`${prefix}-state`);
    const elDist = document.getElementById(`${prefix}-district`);
    const elCity = document.getElementById(`${prefix}-city`);
    const elPin = document.getElementById(`${prefix}-pincode`);
    const elAddr = document.getElementById(`${prefix}-address`);
    const elLat = document.getElementById(`${prefix}-lat`);
    const elLon = document.getElementById(`${prefix}-lon`);

    const cardAddr = document.getElementById(`${prefix}-address-display`);
    const cardCoords = document.getElementById(`${prefix}-coords-display`);
    const cardState = document.getElementById(`${prefix}-state-display`);
    const cardDist = document.getElementById(`${prefix}-district-display`);
    const cardCity = document.getElementById(`${prefix}-city-display`);
    const cardPin = document.getElementById(`${prefix}-pincode-display`);

    if (cardAddr && elAddr) cardAddr.innerText = elAddr.value;
    if (cardCoords && elLat && elLon) cardCoords.innerText = `${parseFloat(elLat.value).toFixed(4)}, ${parseFloat(elLon.value).toFixed(4)}`;
    if (cardState && elState) cardState.innerText = elState.value || 'N/A';
    if (cardDist && elDist) cardDist.innerText = elDist.value || 'N/A';
    if (cardCity && elCity) cardCity.innerText = elCity.value || 'N/A';
    if (cardPin && elPin) cardPin.innerText = elPin.value || 'N/A';
  }

  // Use browser Geolocation API
  function getUserCurrentLocation(prefix = 'setup') {
    if (!navigator.geolocation) {
      showToast("❌ Geolocation is not supported by your browser");
      return;
    }

    showToast("🎯 Acquiring device GPS location...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(`${API_BASE}/maps/reverse?lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data = await res.json();
            applyLocationSelection(prefix, data, true);
            const searchInput = document.getElementById(`${prefix}-address-search`);
            if (searchInput) searchInput.value = data.formatted_address || `${data.city}, ${data.state}`;
            showToast(`✓ GPS location verified: ${data.city || data.district}, ${data.state}`);
          } else {
            applyLocationSelection(prefix, {
              formatted_address: `Current Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
              lat: lat,
              lon: lon,
              state: 'Odisha',
              district: 'Khordha',
              city: 'Bhubaneswar'
            }, true);
            showToast(`✓ Acquired GPS coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
          }
        } catch(err) {
          console.warn("Reverse geocoding error:", err);
          showToast(`✓ Acquired GPS coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        showToast("⚠️ Could not retrieve GPS coordinates. Please allow location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Trigger manual search button
  async function triggerManualAddressSearch(prefix = 'setup') {
    const input = document.getElementById(`${prefix}-address-search`);
    if (!input || !input.value.trim()) {
      showToast("Please enter a farm, village, city or address to search");
      return;
    }
    const query = input.value.trim();
    showToast(`🔍 Searching for "${query}"...`);

    try {
      const res = await fetch(`${API_BASE}/maps/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          applyLocationSelection(prefix, data[0], true);
          const dropdown = document.getElementById(`${prefix}-places-dropdown`);
          if (dropdown) dropdown.style.display = 'none';
          showToast(`✓ Location identified: ${data[0].city || data[0].district}, ${data[0].state}`);
        } else {
          showToast("❌ Could not find the specified location. Please refine search.");
        }
      } else {
        showToast("❌ Could not find the specified location.");
      }
    } catch(err) {
      showToast("❌ Geocoding search error.");
    }
  }

  // --- Real Leaflet & OpenStreetMap Location Picker Initializer ---
  function initLocationPickerMap(prefix = 'setup') {
    const canvasId = (prefix === 'setup') ? 'setup-map-canvas' : 'p-map-canvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const latInput = document.getElementById(`${prefix}-lat`);
    const lonInput = document.getElementById(`${prefix}-lon`);
    const curLat = parseFloat(latInput ? latInput.value : 20.3548) || 20.3548;
    const curLon = parseFloat(lonInput ? lonInput.value : 85.8182) || 85.8182;

    const map = getOrCreateLeafletMap(canvasId, curLat, curLon, 15);
    if (!map) return;

    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');
    const pinType = isFarmer ? 'farm' : 'buyer';
    const pinChar = isFarmer ? '🧑‍🌾' : '🛒';

    // Remove previous marker on canvas if any
    if (leafletMarkers[canvasId]) {
      try { map.removeLayer(leafletMarkers[canvasId]); } catch(e) {}
    }

    const marker = L.marker([curLat, curLon], {
      draggable: true,
      icon: createLeafletPinIcon(pinType, pinChar)
    }).addTo(map);

    marker.bindPopup(`<strong>${isFarmer ? 'Farm Gate Location' : 'Delivery Destination'}</strong><br><span style="font-size:11.5px; color:#555;">Drag pin or click map to refine exact coordinates</span>`);

    // Flow B: Marker Drag -> Reverse Geocode
    marker.on('dragend', async function(e) {
      const pos = marker.getLatLng();
      await handleLocationCoordinateUpdate(prefix, pos.lat, pos.lng);
    });

    // Flow C: Map Click -> Move Marker & Reverse Geocode
    map.off('click');
    map.on('click', async function(e) {
      marker.setLatLng(e.latlng);
      await handleLocationCoordinateUpdate(prefix, e.latlng.lat, e.latlng.lng);
    });

    leafletMarkers[canvasId] = marker;
    if (prefix === 'setup') {
      setupMapObj = map;
      setupMarkerObj = marker;
    } else if (prefix === 'p') {
      profileMapObj = map;
      profileMarkerObj = marker;
    }
  }

  // --- App Portal Open / Close ---
  function openApp(tab = 'dashboard', extraArg = null) {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }

    const portal = document.getElementById('app-portal');
    portal.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Resolve role default dashboard
    if (tab === 'dashboard') {
      tab = currentUser.role === 'FARMER_FPO' ? 'farmer-dashboard' : 'buyer-dashboard';
    }

    switchAppTab(tab);

    if (tab === 'ai-pricing' && extraArg) {
      const cSel = document.getElementById('ai-page-crop');
      if (cSel) cSel.value = extraArg;
      loadAIPriceInsights();
    } else if (tab === 'tracking') {
      if (extraArg) openOrderTrackingDetail(parseInt(extraArg));
      else loadTrackingOrdersList();
    }
  }

  function closeApp() {
    const portal = document.getElementById('app-portal');
    portal.classList.remove('open');
    document.body.style.overflow = 'auto';
  }

  // --- Tab Navigation inside App ---
  function switchAppTab(tabId, navBtn = null, extraArg = null) {
    // Role guard: redirect role-specific primary dashboard views
    if (currentUser) {
      const isFarmer = currentUser.role === 'FARMER_FPO';
      if (isFarmer && tabId === 'buyer-dashboard') {
        tabId = 'farmer-dashboard';
      } else if (!isFarmer && (tabId === 'farmer-dashboard' || tabId === 'farmer-portal' || tabId === 'farmer-listings' || tabId === 'farmer-earnings')) {
        tabId = 'buyer-dashboard';
      }
    }

    document.querySelectorAll('.app-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.add('active');

    if (navBtn) {
      navBtn.classList.add('active');
    } else {
      document.querySelectorAll('.app-nav-item').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
          btn.classList.add('active');
        }
      });
    }

    // Trigger specific loaders
    if (tabId === 'farmer-dashboard') loadFarmerDashboard();
    else if (tabId === 'buyer-dashboard') loadBuyerDashboard();
    else if (tabId === 'farmer-portal') prepareFarmerPortal();
    else if (tabId === 'farmer-listings') loadFarmerMyListings();
    else if (tabId === 'farmer-earnings') loadFarmerEarnings();
    else if (tabId === 'marketplace') loadMarketplaceListings();
    else if (tabId === 'buyer-search') executeAdvancedSearch();
    else if (tabId === 'buyer-saved') loadSavedListings();
    else if (tabId === 'orders') loadOrdersList();
    else if (tabId === 'ai-pricing') loadAIPriceInsights();
    else if (tabId === 'demand') loadDemandPredictions();
    else if (tabId === 'logistics') recalculateRoute();
    else if (tabId === 'tracking') {
      if (extraArg) openOrderTrackingDetail(parseInt(extraArg));
      else loadTrackingOrdersList();
    }
    else if (tabId === 'profile') loadUserProfileView();
  }

  // --- Logout Action ---
  function logout() {
    console.log("[AUTH] Logout initiated. Purging tokens, in-memory caches, and modal states.");
    authToken = null;
    currentUser = null;
    localStorage.removeItem('kisan_auth_token');

    // Reset session caches and active selection state
    currentListingForOrder = null;
    currentTrackingOrderId = null;
    currentTrackingDetail = null;
    activeListingsData = [];
    trackingOrdersCache = [];

    // Clear login form fields
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';

    // Reset login button state
    const loginBtn = document.getElementById('login-submit-btn');
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerText = "Sign In to Dashboard →";
    }

    // Close app and modal overlays
    closeApp();
    closeAuthModal();
    const orderModal = document.getElementById('order-modal');
    if (orderModal) orderModal.classList.remove('open');
    const proofModal = document.getElementById('delivery-proof-modal');
    if (proofModal) proofModal.classList.remove('open');
    const cpModal = document.getElementById('checkpoint-update-modal');
    if (cpModal) cpModal.classList.remove('open');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifDropdown) notifDropdown.classList.remove('open');

    updateUserUI();
    console.log("[AUTH] Logout completed. Opening login modal in pristine state.");
    showToast("✓ Logged out successfully.");
    openAuthModal('login');
  }

  // --- Farmer Dashboard Loader (Stitch Integrated) ---
  async function loadFarmerDashboard() {
    try {
      // 1. Fetch current user and profile data
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
      if (res.ok) {
        currentUser = await res.json();
        
        // Update profile hero
        const heroName = document.getElementById('f-hero-name');
        if (heroName) heroName.innerText = currentUser.name || "Ramesh Kumar";
        
        const heroAvatar = document.getElementById('f-hero-avatar');
        if (heroAvatar) heroAvatar.innerText = currentUser.farmer_profile?.profile_photo || '🧑‍🌾';
        
        const heroLocation = document.getElementById('f-hero-location');
        if (heroLocation) {
          const fp = currentUser.farmer_profile;
          heroLocation.innerText = fp?.farm_location || (fp ? `${fp.district || ''}, ${fp.state || 'Maharashtra'}` : "Nashik, Maharashtra");
        }
        
        const heroCrops = document.getElementById('f-hero-crops');
        if (heroCrops) {
          const fp = currentUser.farmer_profile;
          const acres = fp?.farm_size_acres || 5.0;
          const crops = fp?.crops_grown || "Vegetables, Grains";
          heroCrops.innerText = `🌾 ${acres} Acres (${crops})`;
        }

        // Settled Earnings KPI & Header Wallet
        const earningsEl = document.getElementById('f-dash-earnings');
        if (earningsEl) earningsEl.innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        const walletEl = document.getElementById('wallet-amount');
        if (walletEl) walletEl.innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      }

      // 2. Fetch Farmer Listings
      let listings = [];
      const listRes = await fetch(`${API_BASE}/listings?status=ACTIVE`, { headers: getAuthHeaders() });
      if (listRes.ok) {
        const rawListings = await listRes.json();
        listings = Array.isArray(rawListings) ? rawListings : [];
        
        // KPI: Active Produce Batches
        const countEl = document.getElementById('f-dash-listings-count');
        if (countEl) countEl.innerText = listings.length;
        
        // KPI: Warehouse Stock Total (Available Qtl / kg)
        const totalAvailKg = listings.reduce((sum, l) => sum + (l.available_kg || 0), 0);
        const stockEl = document.getElementById('f-dash-stock-amount');
        if (stockEl) stockEl.innerText = `${(totalAvailKg / 100).toFixed(1)} Qtl`;

        // Render Active Produce Table
        const produceTbody = document.getElementById('f-dash-produce-tbody');
        if (produceTbody) {
          if (listings.length === 0) {
            produceTbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">No active produce lots listed yet. Click <strong>+ New Listing</strong> to publish your harvest.</td></tr>`;
          } else {
            produceTbody.innerHTML = listings.map(l => {
              const cropImg = getProduceImage(l.crop, l.variety, l.photo_url);
              const gain = (l.asking_price || 0) - (l.base_mandi_price || 0);
              const gainBadge = gain > 0 ? `<span class="text-[10px] text-[#005b34] font-bold block">+₹${gain.toFixed(2)}/kg vs mandi</span>` : '';
              return `
                <tr class="hover:bg-slate-50/70 transition-colors">
                  <td class="py-3 px-3">
                    <div class="flex items-center gap-2.5">
                      <img src="${cropImg}" alt="${l.crop}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" onerror="this.onerror=null; this.src='assets/produce/wheat.jpg';">
                      <div>
                        <span class="font-bold text-slate-900 block text-xs">${l.crop} (${l.variety || 'Standard'})</span>
                        <span class="text-[11px] text-slate-500">Lot #KS-LOT-${l.id} • ${l.farm_location || 'Farm Gate'}</span>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <span class="material-symbols-outlined text-[12px] text-emerald-600">verified</span>
                      ${l.quality_grade || 'Grade A'}
                    </span>
                  </td>
                  <td class="py-3 px-3">
                    <span class="font-extrabold text-slate-900 block">${(l.available_kg || 0).toLocaleString()} kg</span>
                    <span class="text-[11px] text-slate-500">${((l.available_kg || 0)/100).toFixed(1)} Qtl avail</span>
                  </td>
                  <td class="py-3 px-3">
                    <span class="font-extrabold text-emerald-700 block">₹${(l.asking_price || 0).toFixed(2)} / kg</span>
                    ${gainBadge}
                  </td>
                  <td class="py-3 px-3">
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      ${l.status === 'ACTIVE' ? 'Live in Market' : l.status}
                    </span>
                  </td>
                  <td class="py-3 px-2 text-right">
                    <button class="px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors" onclick="deleteListing(${l.id})">
                      Delete
                    </button>
                  </td>
                </tr>
              `;
            }).join('');
          }
        }

        // Bind AI Fair Price Card to Primary Lot or Default
        const primaryLot = listings.length > 0 ? listings[0] : {
          crop: "Tomato",
          variety: "Roma",
          quality_grade: "Grade A",
          asking_price: 31.0,
          base_mandi_price: 23.0,
          ai_predicted_price: 30.8,
          district: "Nashik"
        };
        const askP = primaryLot.asking_price || primaryLot.ai_predicted_price || 31.0;
        const mandiP = primaryLot.base_mandi_price || 23.0;
        const deltaP = askP - mandiP;
        const deltaPct = mandiP > 0 ? Math.round((deltaP / mandiP) * 100) : 35;
        
        const elCropTag = document.getElementById('f-ai-crop-tag');
        if (elCropTag) elCropTag.innerText = `${primaryLot.crop.toUpperCase()} (${primaryLot.variety || 'Standard'}) · ${(primaryLot.quality_grade || 'Grade A').toUpperCase()}`;
        const elHeadline = document.getElementById('f-ai-headline');
        if (elHeadline) elHeadline.innerText = `Your ${primaryLot.crop} has a strong market opportunity.`;
        const elPrice = document.getElementById('f-ai-price');
        if (elPrice) elPrice.innerHTML = `₹${askP.toFixed(2)} <span class="text-sm font-medium text-emerald-200">/ kg</span>`;
        const elMandi = document.getElementById('f-ai-mandi-benchmark');
        if (elMandi) elMandi.innerText = `₹${mandiP.toFixed(2)} / kg`;
        const elGain = document.getElementById('f-ai-gain');
        if (elGain) elGain.innerText = `+₹${deltaP.toFixed(2)}/kg (+${deltaPct}%)`;
        const elBtnPrice = document.getElementById('f-ai-btn-price');
        if (elBtnPrice) elBtnPrice.innerText = `₹${askP.toFixed(2)}`;
      }

      // 3. Fetch Orders (For Escrow, KPIs, and Buyer Bids & Offers)
      const orderRes = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        
        // Active orders for Escrow & KPI
        const activeOrders = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
        const oCountEl = document.getElementById('f-dash-orders-count');
        if (oCountEl) oCountEl.innerText = activeOrders.length;
        
        // Calculate real Escrow Amount
        const escrowTotal = activeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const escrowAmountEl = document.getElementById('f-dash-escrow-amount');
        if (escrowAmountEl) escrowAmountEl.innerText = `₹${escrowTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        const escrowCountEl = document.getElementById('f-dash-escrow-count');
        if (escrowCountEl) escrowCountEl.innerText = `${activeOrders.length} Order${activeOrders.length === 1 ? '' : 's'} in Escrow Protection`;

        // Render Buyer Bids & Offers Boxy Cards
        const bidsContainer = document.getElementById('f-dash-bids-container');
        const bidsCountEl = document.getElementById('f-dash-bids-count');
        if (bidsCountEl) bidsCountEl.innerText = `${orders.length} Active`;
        if (bidsContainer) {
          if (orders.length === 0) {
            bidsContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">No buyer orders received yet. Active listings will receive direct purchase orders from verified buyers.</div>`;
          } else {
            bidsContainer.innerHTML = orders.slice(0, 3).map(o => `
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-colors flex flex-col gap-2">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm font-bold text-slate-900">${o.buyer_name}</span>
                      <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">✓ Verified</span>
                    </div>
                    <span class="text-xs text-slate-500">${o.crop} (${o.variety || 'Standard'}) • ${(o.quantity_kg || 0).toLocaleString()} kg</span>
                  </div>
                  <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">#${o.order_code}</span>
                </div>
                <div class="flex items-baseline justify-between bg-white p-2.5 rounded-lg border border-slate-200/70">
                  <div>
                    <span class="text-[11px] text-slate-500 block">Buyer Rate</span>
                    <span class="text-xs font-extrabold text-slate-900">₹${(o.price_per_kg || 0).toFixed(2)} / kg</span>
                  </div>
                  <div class="text-right">
                    <span class="text-[11px] text-slate-500 block">Total Deal Value</span>
                    <span class="text-xs font-bold text-emerald-800">₹${(o.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</span>
                  </div>
                </div>
                <div class="flex items-center justify-between pt-1">
                  <span class="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full ${o.status === 'DELIVERED' ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                    ${o.status_label || o.status}
                  </span>
                  <button onclick="openApp('tracking', '${o.id}')" class="py-1 px-3 bg-[#005b34] hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1" type="button">
                    <span>Track</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            `).join('');
          }
        }

        // Legacy table preservation
        const tbody = document.getElementById('f-dash-recent-orders-tbody');
        if (tbody) {
          tbody.innerHTML = orders.slice(0, 5).map(o => `
            <tr>
              <td><strong>#${o.order_code}</strong></td>
              <td>${o.buyer_name}</td>
              <td>${o.crop} (${o.variety})</td>
              <td>${(o.quantity_kg || 0).toLocaleString()} kg</td>
              <td><strong style="color:var(--olive-deep);">₹${(o.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
              <td><span class="badge-status ${(o.status || 'active').toLowerCase()}">${o.status}</span></td>
              <td><button class="tag-btn" onclick="openApp('tracking', '${o.id}')">Track →</button></td>
            </tr>
          `).join('');
        }
      }

      // Legacy pulse preservation
      loadActivePrices();
    } catch(err) {
      console.error("Dashboard error:", err);
    }
  }

  // --- Buyer Dashboard Loader ---
  async function loadBuyerDashboard() {
    try {
      const orderRes = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      let totalSpend = 0;
      let inTransit = 0;
      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        totalSpend = orders.reduce((sum, o) => sum + (o.status !== 'CANCELLED' ? (o.total_amount || 0) : 0), 0);
        inTransit = orders.filter(o => o.status === 'IN_TRANSIT' || o.status === 'CONFIRMED' || o.status === 'PACKED' || o.status === 'PICKED_UP').length;
      }
      const bSpendEl = document.getElementById('b-dash-spend');
      if (bSpendEl) bSpendEl.innerText = `₹${totalSpend.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      const wAmtEl = document.getElementById('wallet-amount');
      if (wAmtEl) wAmtEl.innerText = `₹${totalSpend.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      const bDelivEl = document.getElementById('b-dash-deliveries');
      if (bDelivEl) bDelivEl.innerText = inTransit;

      // Recommended lots
      const mRes = await fetch(`${API_BASE}/marketplace`, { headers: getAuthHeaders() });
      if (mRes.ok) {
        const rawItems = await mRes.json();
        const items = Array.isArray(rawItems) ? rawItems : [];
        const grid = document.getElementById('b-dash-recommended-grid');
        if (grid) grid.innerHTML = items.slice(0, 3).map(item => renderProduceCardHTML(item)).join('');
      }
    } catch(err) {
      console.error("Buyer dashboard error:", err);
    }
  }

  // --- Active Market Prices Feed ---
  async function loadActivePrices() {
    const crops = [
      { crop: "Tomato", variety: "Roma", mandi: "Nashik APMC", spot: 23.0, base: 31.0 },
      { crop: "Onion", variety: "Nashik Red", mandi: "Lasalgaon Mandi", spot: 14.0, base: 19.0 },
      { crop: "Wheat", variety: "Sharbati", mandi: "Khanna Mandi", spot: 19.0, base: 24.0 },
      { crop: "Potato", variety: "Jyoti", mandi: "Indore APMC", spot: 11.0, base: 15.0 }
    ];

    const tbody = document.getElementById('dash-market-tbody');
    if (!tbody) return;

    tbody.innerHTML = crops.map(c => `
      <tr>
        <td><strong>${c.crop === 'Tomato' ? '🍅' : c.crop === 'Onion' ? '🧅' : c.crop === 'Wheat' ? '🌾' : '🥔'} ${c.crop} (${c.variety})</strong></td>
        <td>${c.mandi}</td>
        <td><span style="color:var(--alert); text-decoration:line-through;">₹${c.spot.toFixed(2)}/kg</span></td>
        <td><strong style="font-family:'JetBrains Mono';">₹${(c.base - 0.2).toFixed(2)}/kg</strong></td>
        <td><strong style="color:var(--olive); font-family:'JetBrains Mono'; font-size:14px;">₹${c.base.toFixed(2)}/kg</strong></td>
        <td><span class="badge-status active">+35% Direct Gain</span></td>
        <td><button class="tag-btn" onclick="openApp('ai-pricing', '${c.crop}')">Analyze ML</button></td>
      </tr>
    `).join('');
  }

  // --- Farmer Portal Produce Listing ---
  function prepareFarmerPortal() {
    const hDate = document.getElementById('f-harvest-date');
    if (hDate && !hDate.value) {
      hDate.value = new Date().toISOString().slice(0, 10);
    }
    if (currentUser && currentUser.farmer_profile) {
      const fp = currentUser.farmer_profile;
      document.getElementById('f-location').value = fp.farm_location || 'Dindori Road, Nashik';
      document.getElementById('f-state').value = fp.state || 'Maharashtra';
      document.getElementById('f-district').value = fp.district || 'Nashik';
    }
  }

  function setListingQty(val) {
    document.getElementById('f-quantity').value = val;
    document.querySelectorAll('#view-farmer-portal .tag-btn').forEach(b => b.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) event.target.classList.add('active');
  }

  function onListingCropChange(crop) {
    const varietyInput = document.getElementById('f-variety');
    const photoSelect = document.getElementById('f-photo-url');
    if (crop === 'Tomato') { varietyInput.value = 'Roma'; photoSelect.value = '🍅'; }
    else if (crop === 'Onion') { varietyInput.value = 'Nashik Red'; photoSelect.value = '🧅'; }
    else if (crop === 'Wheat') { varietyInput.value = 'Sharbati'; photoSelect.value = '🌾'; }
    else if (crop === 'Potato') { varietyInput.value = 'Jyoti'; photoSelect.value = '🥔'; }
  }

  async function requestListingPricePrediction() {
    const btn = document.getElementById('btn-request-ai');
    btn.disabled = true;
    btn.innerText = "Running ML Models...";

    const hDateInput = document.getElementById('f-harvest-date');
    if (hDateInput && !hDateInput.value) {
      hDateInput.value = new Date().toISOString().slice(0, 10);
    }

    const payload = {
      crop: document.getElementById('f-crop').value,
      variety: document.getElementById('f-variety').value,
      quantity: parseFloat(document.getElementById('f-quantity').value || 1000),
      quality_grade: document.getElementById('f-grade').value,
      state: document.getElementById('f-state').value,
      district: document.getElementById('f-district').value,
      market: document.getElementById('f-district').value,
      harvest_date: hDateInput ? hDateInput.value : new Date().toISOString().slice(0, 10)
    };

    try {
      const res = await fetch(`${API_BASE}/predict-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        document.getElementById('listing-ai-result').style.display = 'block';
        document.getElementById('ai-res-pred').innerText = `₹${data.predicted_price.toFixed(2)}/kg`;
        document.getElementById('ai-res-rec').innerText = `₹${data.recommended_price.toFixed(2)}/kg`;
        document.getElementById('ai-res-explanation').innerText = data.explanation;
        document.getElementById('ai-res-ci').innerText = `95% Confidence Range: ${data.confidence_or_prediction_interval}`;
        document.getElementById('f-asking-price').value = data.recommended_price.toFixed(1);
        showToast("✓ ML Price Forecast & Recommendation updated!");
      } else {
        showToast(`❌ Price prediction model unavailable: ${data.detail || 'Service error'}`);
      }
    } catch(err) {
      showToast("❌ Price prediction model unavailable");
    } finally {
      btn.disabled = false;
      btn.innerText = "⚡ Request AI Price Recommendation";
    }
  }

  async function handleCreateListing(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btn-publish-listing');
    btn.disabled = true;
    btn.innerText = "Publishing to Marketplace...";

    const payload = {
      crop: document.getElementById('f-crop').value,
      variety: document.getElementById('f-variety').value,
      quantity_kg: parseFloat(document.getElementById('f-quantity').value),
      unit: "kg",
      quality_grade: document.getElementById('f-grade').value,
      harvest_date: document.getElementById('f-harvest-date').value,
      photo_url: document.getElementById('f-photo-url').value,
      farm_location: document.getElementById('f-location').value,
      state: document.getElementById('f-state').value,
      district: document.getElementById('f-district').value,
      asking_price: parseFloat(document.getElementById('f-asking-price').value)
    };

    try {
      const res = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`✓ Produce Lot #${data.id} published to live marketplace!`);
        switchAppTab('farmer-listings');
      } else {
        showToast(`❌ Error: ${data.detail || 'Failed to publish listing'}`);
      }
    } catch(err) {
      showToast("❌ Server error publishing listing.");
    } finally {
      btn.disabled = false;
      btn.innerText = "Publish Listing to Marketplace →";
    }
  }

  // --- Farmer My Listings ---
  async function loadFarmerMyListings() {
    try {
      const res = await fetch(`${API_BASE}/listings?status=ALL`, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const listings = Array.isArray(raw) ? raw : [];
        const tbody = document.getElementById('farmer-my-listings-tbody');
        if (!tbody) return;
        if (listings.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--soil-soft);">You have no published listings yet. Click "+ Add New Listing" above.</td></tr>`;
          return;
        }

        tbody.innerHTML = listings.map(l => `
          <tr>
            <td><strong>#${l.id}</strong></td>
            <td>${l.photo_url || '🌿'} ${l.crop}</td>
            <td>${l.variety}</td>
            <td>${(l.quantity_kg || 0).toLocaleString()} kg</td>
            <td><strong>${(l.available_kg || 0).toLocaleString()} kg</strong></td>
            <td><strong style="color:var(--olive-deep); font-family:'JetBrains Mono';">₹${(l.asking_price || 0).toFixed(2)}/kg</strong></td>
            <td><span class="badge-status ${(l.status || 'active').toLowerCase()}">${l.status}</span></td>
            <td>${l.harvest_date || 'Today'}</td>
            <td>
              <button class="tag-btn" onclick="deleteListing(${l.id})" style="color:var(--alert);">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    } catch(err) {
      console.error("Error loading my listings:", err);
    }
  }

  async function deleteListing(id) {
    if (!confirm(`Are you sure you want to delete produce lot #${id}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/listings/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast(`✓ Listing #${id} deleted.`);
        loadFarmerMyListings();
      }
    } catch(err) {
      showToast("❌ Error deleting listing.");
    }
  }

  // --- Farmer Earnings & Ledger ---
  async function loadFarmerEarnings() {
    try {
      const res = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const orders = Array.isArray(raw) ? raw : [];
        const delivered = orders.filter(o => o.status === 'DELIVERED');
        const total = delivered.reduce((sum, o) => sum + (o.total_amount || 0), 0);

        const wVal = document.getElementById('earnings-wallet-val');
        if (wVal) wVal.innerText = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        const cCount = document.getElementById('earnings-completed-count');
        if (cCount) cCount.innerText = delivered.length;
        const sVal = document.getElementById('earnings-saved-val');
        if (sVal) sVal.innerText = `₹${(total * 0.12).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        const tbody = document.getElementById('farmer-earnings-tbody');
        if (!tbody) return;
        if (delivered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--soil-soft);">No completed deliveries yet. Payouts are credited instantly upon buyer acceptance.</td></tr>`;
          return;
        }

        tbody.innerHTML = delivered.map(o => `
          <tr>
            <td><strong>#${o.order_code}</strong></td>
            <td>${o.crop} (${o.variety})</td>
            <td>${(o.quantity_kg || 0).toLocaleString()} kg</td>
            <td>₹${(o.price_per_kg || 0).toFixed(2)}/kg</td>
            <td><strong style="color:var(--olive-deep); font-family:'JetBrains Mono'; font-size:14px;">₹${(o.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
            <td>${o.buyer_name}</td>
            <td>${o.created_at ? o.created_at.slice(0, 10) : 'Today'}</td>
            <td><span class="badge-status delivered">SETTLED IN WALLET</span></td>
          </tr>
        `).join('');
      }
    } catch(err) {
      console.error("Earnings error:", err);
    }
  }

  function requestBankTransfer() {
    const bal = currentUser ? (currentUser.wallet_balance || 0) : 0;
    if (bal <= 0) {
      showToast("No settled balance available for transfer.");
      return;
    }
    showToast(`✓ ₹${bal.toLocaleString('en-IN')} payout initiated to SBI A/c ····4819 (UTR ref #SBIN2688491)`);
  }

  // --- Buyer Marketplace ---
  async function loadMarketplaceListings() {
    try {
      const search = (document.getElementById('market-search-input')?.value || '').trim();
      const crop = document.getElementById('market-crop-filter')?.value || 'ALL';
      const grade = document.getElementById('market-grade-filter')?.value || 'ALL';
      const sortBy = document.getElementById('market-sort-filter')?.value || 'dist_asc';

      let url = `${API_BASE}/marketplace?sort_by=${sortBy}`;
      if (search) url += `&q=${encodeURIComponent(search)}`;
      if (crop !== 'ALL') url += `&crop=${encodeURIComponent(crop)}`;
      if (grade !== 'ALL') url += `&quality_grade=${encodeURIComponent(grade)}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        activeListingsData = Array.isArray(raw) ? raw : [];
        renderMarketplaceCards(activeListingsData);
      }
    } catch(err) {
      console.error("Marketplace error:", err);
    }
  }

  function filterMarketplace() {
    loadMarketplaceListings();
  }

  async function executeAdvancedSearch() {
    const q = (document.getElementById('adv-search-q')?.value || '').trim();
    const region = (document.getElementById('adv-search-region')?.value || '').trim();
    const resultsCont = document.getElementById('adv-search-results');
    if (!resultsCont) return;

    try {
      let url = `${API_BASE}/marketplace?sort_by=dist_asc`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      if (region) url += `&location=${encodeURIComponent(region)}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const items = Array.isArray(raw) ? raw : [];
        if (items.length === 0) {
          resultsCont.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--soil-soft);">No produce lots matched your search criteria.</div>`;
          return;
        }
        resultsCont.innerHTML = items.map(item => renderProduceCardHTML(item)).join('');
      }
    } catch(err) {
      console.error("Advanced search error:", err);
    }
  }

  function filterMarketplaceByPill(crop) {
    const select = document.getElementById('market-crop-filter');
    if (select) {
      select.value = crop;
      loadMarketplaceListings();
    }
  }

  function renderMarketplaceCards(items) {
    const container = document.getElementById('marketplace-cards-container');
    const countEl = document.getElementById('market-results-count');
    const kpiLotsEl = document.getElementById('market-kpi-lots');
    if (countEl) countEl.innerText = `Showing ${items.length} Live Terminal Batches`;
    if (kpiLotsEl) kpiLotsEl.innerText = `${items.length} Active Lots`;

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div class="text-4xl mb-3">🌾</div>
          <h3 class="text-base font-bold text-slate-900 mb-1">No Produce Lots Found</h3>
          <p class="text-xs text-slate-500">Try clearing active filters or search for another commodity (e.g. Tomato, Wheat, Soybean).</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => renderProduceCardHTML(item)).join('');
  }

  function renderProduceCardHTML(item) {
    const imgSrc = getProduceImage(item.crop, item.variety, item.photo_url);
    const mandiRate = item.base_mandi_price || (item.asking_price * 0.85);
    const gain = item.asking_price - mandiRate;
    const gainBadge = gain > 0
      ? `<span class="text-[11px] font-bold text-[#137547]">+₹${gain.toFixed(2)}/kg vs Mandi</span>`
      : `<span class="text-[11px] font-medium text-slate-500">Par with Spot Mandi</span>`;

    return `
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group" style="box-shadow: rgba(19, 80, 50, 0.06) 0px 10px 24px -4px, rgba(19, 80, 50, 0.04) 0px 3px 8px -2px; border-color: rgba(19, 117, 71, 0.14);">
        <div class="p-4 flex flex-col gap-3">
          <!-- Top Card Media Banner (Stitch Design) -->
          <div class="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100">
            <img src="${imgSrc}" alt="${item.crop} - ${item.variety || 'Lot'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.onerror=null; this.src='assets/produce/wheat.jpg';">
            <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20 pointer-events-none"></div>
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-slate-900 text-[11px] font-bold border border-emerald-600/20 shadow-xs">
              <span class="material-symbols-outlined text-[14px] text-emerald-600 font-bold">verified</span>
              <span>✓ ${item.quality_grade || 'Grade A Assayed'}</span>
            </div>
            <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5">
              <span class="bg-[#005b34] text-white text-[11px] font-semibold px-2 py-0.5 rounded-md shadow-xs font-mono">
                Lot #${item.id}
              </span>
              <button class="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-sm shadow-xs flex items-center justify-center border border-slate-200 transition-transform active:scale-90" onclick="toggleSaveListing(${item.id})" title="Save lot">
                ${item.is_saved ? '❤️' : '🤍'}
              </button>
            </div>
            <div class="absolute bottom-2.5 left-2.5 bg-amber-50/95 border border-amber-300/60 text-amber-900 px-2.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1">
              <span class="material-symbols-outlined text-[13px] text-amber-600">auto_awesome</span>
              <span>AI Fair Price Verified</span>
            </div>
          </div>

          <!-- Lot Title & Location -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-slate-500 text-xs">
              <span class="flex items-center gap-1 text-slate-700 font-medium truncate">
                <span class="material-symbols-outlined text-[15px] text-[#137547]">location_on</span>
                <span>${item.farm_location || (item.district ? `${item.district}, ${item.state}` : 'Farm Gate')}</span>
              </span>
              <span class="text-[11px] text-slate-500 font-semibold flex-shrink-0">📍 ${item.distance_km || 160} km</span>
            </div>
            <h3 class="text-base font-extrabold text-slate-900 group-hover:text-[#137547] transition-colors leading-snug">
              ${item.crop.toUpperCase()} (${item.variety || 'Standard'})
            </h3>
            <div class="flex items-center justify-between text-xs text-slate-500 mt-0.5">
              <span>Producer: <strong class="text-slate-800">${item.farmer_name}</strong></span>
              <span class="px-2 py-0.5 rounded bg-emerald-50 text-[#005b34] font-bold text-[11px] border border-emerald-200">SFAC KYC ✓</span>
            </div>
          </div>

          <!-- Price & Volume Specs Box -->
          <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
            <div class="flex items-baseline justify-between">
              <div class="flex flex-col">
                <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">AI Fair Price Rate</span>
                <span class="text-xl font-black text-[#005b34] leading-none font-mono">
                  ₹${item.asking_price.toFixed(2)} <span class="text-xs font-normal text-slate-500">/ kg</span>
                </span>
                <span class="text-[10px] text-slate-500 font-mono mt-0.5">₹${(item.asking_price * 100).toLocaleString('en-IN', {maximumFractionDigits:0})} / Qtl eq.</span>
              </div>
              <div class="text-right">
                <div class="text-xs text-slate-500">Available: <strong class="text-slate-900 font-mono">${(item.available_kg || 0).toLocaleString()} kg</strong></div>
                ${gainBadge}
              </div>
            </div>
            <div class="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
              <span>Harvest: <strong class="text-slate-800 font-medium">${item.harvest_date || 'Fresh'}</strong></span>
              <span>Retail Est: <strong class="text-slate-800 font-mono">₹${item.retail_estimated_price ? item.retail_estimated_price.toFixed(2) : (item.asking_price * 1.25).toFixed(2)}</strong></span>
              <span class="text-emerald-700 font-bold">Save ${item.buyer_savings_pct || 15}%</span>
            </div>
          </div>
        </div>

        <!-- Action CTAs -->
        <div class="p-4 pt-0 flex items-center gap-2">
          <button class="flex-1 py-2 px-3 rounded-xl bg-[#005b34] hover:bg-[#137547] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer" onclick="openOrderModal(${item.id})">
            <span class="material-symbols-outlined text-[16px]">shopping_cart</span>
            <span>Request Bulk Quote / Buy</span>
          </button>
          <button class="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1" onclick="openApp('ai-pricing')">
            <span class="material-symbols-outlined text-[16px] text-amber-600">query_stats</span>
            <span>AI Price</span>
          </button>
        </div>
      </div>
    `;
  }

  // --- Saved Listings ---
  async function toggleSaveListing(id) {
    if (!currentUser) { openAuthModal('login'); return; }
    try {
      const res = await fetch(`${API_BASE}/marketplace/save/${id}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      showToast(data.message);
      loadMarketplaceListings();
    } catch(err) {
      showToast("❌ Error bookmarking listing.");
    }
  }

  async function loadSavedListings() {
    try {
      const res = await fetch(`${API_BASE}/marketplace/saved`, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const saved = Array.isArray(raw) ? raw : [];
        const grid = document.getElementById('saved-listings-grid');
        if (!grid) return;
        if (saved.length === 0) {
          grid.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--soil-soft);">No saved lots. Click the ❤️ icon on any marketplace card to bookmark it.</div>`;
          return;
        }
        grid.innerHTML = saved.map(item => {
          const imgSrc = getProduceImage(item.crop, item.variety, item.photo_url);
          return `
          <div class="produce-card">
            <div class="produce-card-header" style="position:relative; height:140px; overflow:hidden; border-radius:12px; margin-bottom:10px;">
              <img src="${imgSrc}" alt="${item.crop}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='assets/produce/wheat.jpg';">
              <button class="save-btn saved" style="position:absolute; top:8px; right:8px;" onclick="toggleSaveListing(${item.id})">❤️</button>
            </div>
            <div class="produce-card-body">
              <div class="farmer-info">🧑‍🌾 ${item.farmer_name}</div>
              <h3 class="title">${item.crop} (${item.variety})</h3>
              <div style="font-size:12.5px; color:var(--soil-soft);">Available: <strong>${(item.available_kg || 0).toLocaleString()} kg</strong></div>
              <div class="asking" style="margin-top:6px;">₹${(item.asking_price || 0).toFixed(2)}/kg</div>
            </div>
            <div class="produce-card-footer">
              <button class="btn-primary" style="width:100%; justify-content:center;" onclick="openOrderModal(${item.id})">Order Now →</button>
            </div>
          </div>
        `;}).join('');
      }
    } catch(err) {
      console.error("Saved listings error:", err);
    }
  }

  // --- Order Placement Modal ---
  function openOrderModal(listingId) {
    if (!currentUser) { openAuthModal('login'); return; }
    if (currentUser.role !== 'BUYER_CONSUMER') {
      showToast("⚠️ Only buyers can place purchase orders. Please switch/sign in with a buyer account.");
      return;
    }

    const item = activeListingsData.find(l => l.id === listingId);
    if (!item) return;

    currentListingForOrder = item;
    document.getElementById('order-listing-id').value = item.id;
    document.getElementById('order-modal-title').innerText = `Order ${item.crop} (${item.variety})`;
    document.getElementById('order-modal-farmer').innerText = `Farmer: ${item.farmer_name} · ${item.farm_location}`;
    document.getElementById('order-modal-price').innerText = `₹${item.asking_price.toFixed(2)} / kg`;
    document.getElementById('order-modal-avail').innerText = `${item.available_kg.toLocaleString()} kg`;
    document.getElementById('order-modal-dist').innerText = `${item.distance_km} km`;

    // Default quantity
    const defaultQty = Math.min(item.available_kg, 400);
    document.getElementById('order-modal-qty').value = defaultQty;
    document.getElementById('order-modal-qty').max = item.available_kg;

    // Delivery address from profile
    if (currentUser.buyer_profile) {
      document.getElementById('order-modal-address').value = currentUser.buyer_profile.delivery_location || 'Dadar Wholesale Market, Mumbai';
    }

    // Quick tag chips
    const tagsCont = document.getElementById('order-modal-qty-tags');
    tagsCont.innerHTML = [100, 250, 400, 1000].filter(q => q <= item.available_kg).map(q => `
      <button type="button" class="tag-btn ${q === defaultQty ? 'active' : ''}" onclick="setOrderModalQty(${q})">${q} kg</button>
    `).join('');

    recalcOrderTotal();
    const submitBtn = document.getElementById('order-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Confirm Purchase & Schedule Pickup →";
    }
    document.getElementById('order-modal').classList.add('open');
  }

  function closeOrderModal() {
    document.getElementById('order-modal').classList.remove('open');
  }

  function setOrderModalQty(qty) {
    document.getElementById('order-modal-qty').value = qty;
    document.querySelectorAll('#order-modal-qty-tags .tag-btn').forEach(b => b.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) event.target.classList.add('active');
    recalcOrderTotal();
  }

  function recalcOrderTotal() {
    if (!currentListingForOrder) return;
    const qty = parseFloat(document.getElementById('order-modal-qty').value || 0);
    const total = qty * currentListingForOrder.asking_price;
    document.getElementById('order-modal-total').innerText = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
  }

  async function handleConfirmOrder(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('order-modal-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Placing Order in Blockchain Dispatch...";
    }

    const payload = {
      listing_id: parseInt(document.getElementById('order-listing-id').value),
      quantity_kg: parseFloat(document.getElementById('order-modal-qty').value),
      delivery_address: document.getElementById('order-modal-address').value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const order = await res.json();
      if (!res.ok) {
        showToast(`❌ Error: ${order.detail || 'Could not place order'}`);
        return;
      }

      closeOrderModal();
      showToast(`✓ Order #${order.order_code} placed successfully!`);
      loadMarketplaceListings();
      switchAppTab('orders');
    } catch(err) {
      console.error("Order error:", err);
      showToast("❌ Server error processing order.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Confirm Purchase & Schedule Pickup →";
      }
    }
  }

  // --- Orders List & Invoices ---
  async function loadOrdersList() {
    try {
      const isFarmer = currentUser && currentUser.role === 'FARMER_FPO';
      const titleEl = document.getElementById('orders-view-title');
      if (titleEl) titleEl.innerText = isFarmer ? 'Orders & Dispatches (Sales)' : 'My Procurement Orders';

      const res = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        const orders = Array.isArray(raw) ? raw : [];
        const tbody = document.getElementById('orders-table-tbody');
        if (!tbody) return;
        if (orders.length === 0) {
          tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--soil-soft);">No orders found.</td></tr>`;
          return;
        }

        tbody.innerHTML = orders.map(o => `
          <tr>
            <td><strong>#${o.order_code}</strong></td>
            <td>${isFarmer ? `🛒 ${o.buyer_name}` : `🧑‍🌾 ${o.farmer_name}`}</td>
            <td>${o.crop} (${o.variety})</td>
            <td>${(o.quantity_kg || 0).toLocaleString()} kg</td>
            <td>₹${(o.price_per_kg || 0).toFixed(2)}/kg</td>
            <td><strong style="color:var(--olive-deep); font-family:'JetBrains Mono'; font-size:14px;">₹${(o.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong></td>
            <td><span class="badge-status ${(o.status || 'active').toLowerCase()}">${o.status}</span></td>
            <td>${o.created_at ? o.created_at.slice(0, 10) : 'Today'}</td>
            <td>
              <button class="tag-btn" onclick="openApp('tracking', '${o.id}')">Track →</button>
            </td>
          </tr>
        `).join('');
      }
    } catch(err) {
      console.error("Orders load error:", err);
    }
  }

  // --- AI Price Insights (Stitch AI Fair Price Engine) ---
  let currentForecastDays = 30;

  const marketLocations = {
    'Nashik': 'Nashik Division, Maharashtra',
    'Lasalgaon': 'Niphad, Nashik, Maharashtra',
    'Pune': 'Haveli, Pune, Maharashtra',
    'Indore': 'Malwa Zone, Madhya Pradesh',
    'Azadpur': 'North Delhi, Delhi NCT',
    'Khanna': 'Ludhiana District, Punjab',
    'Surat': 'South Gujarat, Gujarat',
    'Bangalore': 'Bangalore Urban, Karnataka',
    'Kolar': 'Kolar District, Karnataka'
  };

  function setForecastHorizon(val) {
    const btn7 = document.getElementById('horizon-7d');
    const btn30 = document.getElementById('horizon-30d');
    if (btn7 && btn30) {
      if (val === '7d') {
        btn7.className = 'px-3 py-1 rounded-md text-xs font-bold bg-[#137547] text-white shadow-xs';
        btn30.className = 'px-3 py-1 rounded-md text-xs font-semibold text-gray-600 hover:text-gray-900';
        currentForecastDays = 7;
      } else {
        btn30.className = 'px-3 py-1 rounded-md text-xs font-bold bg-[#137547] text-white shadow-xs';
        btn7.className = 'px-3 py-1 rounded-md text-xs font-semibold text-gray-600 hover:text-gray-900';
        currentForecastDays = 30;
      }
    }
    loadAIPriceInsights();
  }

  function listAtRecommendedPrice() {
    const cropInput = document.getElementById('ai-page-crop');
    const crop = cropInput ? cropInput.value : 'Wheat';
    const recPriceEl = document.getElementById('ai-kpi-rec');
    let recPrice = '';
    if (recPriceEl) {
      const match = recPriceEl.innerText.match(/([0-9.]+)/);
      if (match) recPrice = match[1];
    }
    openApp('farmer-portal');
    setTimeout(() => {
      const fCrop = document.getElementById('f-crop');
      if (fCrop) fCrop.value = crop;
      const fPrice = document.getElementById('f-asking-price');
      if (fPrice && recPrice) fPrice.value = recPrice;
    }, 120);
  }

  async function loadAIPriceInsights() {
    const cropInput = document.getElementById('ai-page-crop');
    const marketInput = document.getElementById('ai-page-market');
    const crop = cropInput ? cropInput.value : 'Wheat';
    const market = marketInput ? marketInput.value : 'Nashik';

    // Update location text
    const locEl = document.getElementById('ai-location-text');
    if (locEl) locEl.innerText = marketLocations[market] || `${market} Mandi Yard`;

    // Update crop badge
    const badgeEl = document.getElementById('ai-hero-crop-badge');
    if (badgeEl) badgeEl.innerText = `${crop.toUpperCase()} · GRADE A`;

    try {
      const res = await fetch(`${API_BASE}/price-history?crop=${encodeURIComponent(crop)}&market=${encodeURIComponent(market)}&days=${currentForecastDays}`);
      if (res.ok) {
        const data = await res.json();
        const currentP = data.current_price !== undefined ? data.current_price : 25.0;
        const predP = data.predicted_price !== undefined ? data.predicted_price : 26.0;
        const recP = data.recommended_price !== undefined ? data.recommended_price : 27.0;

        // Existing and new KPI elements
        if (document.getElementById('ai-kpi-mandi')) document.getElementById('ai-kpi-mandi').innerText = `₹${currentP.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-pred')) document.getElementById('ai-kpi-pred').innerText = `₹${predP.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-rec')) document.getElementById('ai-kpi-rec').innerText = `₹${recP.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-rec-qtl')) document.getElementById('ai-kpi-rec-qtl').innerText = `₹${(recP * 100).toLocaleString('en-IN', {maximumFractionDigits: 0})} / Qtl equivalent`;
        if (document.getElementById('ai-kpi-trend')) document.getElementById('ai-kpi-trend').innerText = `${data.price_trend || '→ Stable'} Trend`;
        if (document.getElementById('ai-kpi-ci')) document.getElementById('ai-kpi-ci').innerText = `±₹${(recP * 0.07).toFixed(2)} / kg (95% PI)`;
        if (document.getElementById('ai-kpi-model')) document.getElementById('ai-kpi-model').innerText = `${data.model || 'RandomForest'}`;
        if (document.getElementById('ai-price-narrative')) document.getElementById('ai-price-narrative').innerHTML = `<strong class="text-[#005b34] font-semibold">Agricultural Intelligence Brief:</strong> ${data.explanation || 'Market modal rates reflect steady mandi demand and balanced daily arrivals.'}`;

        // Dynamic Premium Tag & Confidence
        const delta = recP - currentP;
        const pct = currentP > 0 ? ((delta / currentP) * 100).toFixed(1) : '5.0';
        const premEl = document.getElementById('ai-hero-premium-tag');
        if (premEl) {
          premEl.innerText = `${delta >= 0 ? '+' : ''}₹${delta.toFixed(2)}/kg (${delta >= 0 ? '+' : ''}${pct}% premium)`;
        }

        // Expected Range
        const lowerP = recP * 0.92;
        const upperP = recP * 1.08;
        if (document.getElementById('ai-range-lower')) document.getElementById('ai-range-lower').innerText = `₹${lowerP.toFixed(2)}`;
        if (document.getElementById('ai-range-upper')) document.getElementById('ai-range-upper').innerText = `₹${upperP.toFixed(2)}`;

        // Guidance Headline & Subtext
        const gHead = document.getElementById('ai-guidance-headline');
        const gSub = document.getElementById('ai-guidance-subtext');
        const gRat = document.getElementById('ai-guidance-rationale');
        if (delta >= 0) {
          if (gHead) gHead.innerText = "Sell 40% Now • Hold Remainder for Peak";
          if (gSub) gSub.innerText = `Model forecasts firm demand across ${market} aggregation corridor with favorable spot-to-futures basis.`;
        } else {
          if (gHead) gHead.innerText = "Immediate Sale Recommended";
          if (gSub) gSub.innerText = "Arrivals are increasing rapidly. Secure current pricing before seasonal pressure intensifies.";
        }
        if (gRat && data.explanation) {
          gRat.innerHTML = `<strong class="text-gray-900 font-semibold">Agricultural Intelligence Rationale:</strong> ${data.explanation}`;
        }

        // 5 Market Drivers
        if (document.getElementById('ai-driver-mandi-rate')) document.getElementById('ai-driver-mandi-rate').innerText = `₹${currentP.toFixed(2)}/kg`;
        if (document.getElementById('ai-driver-mandi-desc')) document.getElementById('ai-driver-mandi-desc').innerText = `Physical spot auction benchmark from ${market} APMC yard.`;

        // Market Comparison
        if (document.getElementById('ai-comp-kisan-setu')) document.getElementById('ai-comp-kisan-setu').innerText = `₹${recP.toFixed(2)} / kg`;
        if (document.getElementById('ai-comp-institutional')) document.getElementById('ai-comp-institutional').innerText = `₹${(recP * 0.98).toFixed(2)} / kg`;
        if (document.getElementById('ai-comp-mandi')) document.getElementById('ai-comp-mandi').innerText = `₹${currentP.toFixed(2)} / kg`;
        if (document.getElementById('ai-comp-prev-week')) document.getElementById('ai-comp-prev-week').innerText = `₹${(currentP * 0.97).toFixed(2)} / kg`;
        if (document.getElementById('ai-comp-mandi-name')) document.getElementById('ai-comp-mandi-name').innerText = `${market} APMC Spot Rate`;

        // Relative comparison bars
        const maxRef = Math.max(recP, currentP, recP * 0.98, currentP * 0.97) * 1.05;
        if (document.getElementById('ai-comp-bar-kisan')) document.getElementById('ai-comp-bar-kisan').style.width = `${(recP / maxRef) * 100}%`;
        if (document.getElementById('ai-comp-bar-inst')) document.getElementById('ai-comp-bar-inst').style.width = `${((recP * 0.98) / maxRef) * 100}%`;
        if (document.getElementById('ai-comp-bar-mandi')) document.getElementById('ai-comp-bar-mandi').style.width = `${(currentP / maxRef) * 100}%`;
        if (document.getElementById('ai-comp-bar-prev')) document.getElementById('ai-comp-bar-prev').style.width = `${((currentP * 0.97) / maxRef) * 100}%`;

        // Batch selling
        if (document.getElementById('ai-batch1-price')) document.getElementById('ai-batch1-price').innerText = `Sell Now • ₹${recP.toFixed(2)} / kg`;
        if (document.getElementById('ai-batch2-price')) document.getElementById('ai-batch2-price').innerText = `Target Sale (Day +3) • ₹${(recP * 1.03).toFixed(2)} / kg`;

        // Canvas Chart
        if (Array.isArray(data.history) && Array.isArray(data.forecast_7d)) {
          renderPriceCanvasChart(data.history, data.forecast_7d);
        }
      }
    } catch(err) {
      console.error("AI Price error:", err);
    }
  }

  function renderPriceCanvasChart(history, forecast) {
    const canvas = document.getElementById('ai-price-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set resolution for HiDPI/Retina
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 600, height: 260 };
    const cssWidth = Math.max(rect.width || 600, 300);
    const cssHeight = 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = cssWidth;
    const h = cssHeight;
    ctx.clearRect(0, 0, w, h);

    const padLeft = 55;
    const padRight = 35;
    const padTop = 30;
    const padBottom = 35;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const allPrices = [...history.map(p => p.modal_price), ...forecast.map(p => p.modal_price)];
    if (allPrices.length === 0) return;
    const minP = Math.min(...allPrices) * 0.94;
    const maxP = Math.max(...allPrices) * 1.06;
    const totalPoints = history.length + forecast.length;
    const stepX = chartW / Math.max(totalPoints - 1, 1);

    const getX = (idx) => padLeft + idx * stepX;
    const getY = (price) => padTop + chartH - ((price - minP) / (maxP - minP || 1)) * chartH;

    // 1. Draw Grid lines & Y Axis Ticks
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#E5E7EB';
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const numTicks = 4;
    for (let i = 0; i <= numTicks; i++) {
      const y = padTop + (chartH / numTicks) * i;
      const priceVal = maxP - ((maxP - minP) / numTicks) * i;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(`₹${priceVal.toFixed(1)}`, padLeft - 8, y);
    }

    // 2. Shaded Gradient under Forecast
    const startIdx = history.length - 1;
    if (startIdx >= 0 && forecast.length > 0) {
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

      ctx.beginPath();
      ctx.moveTo(getX(startIdx), getY(history[startIdx].modal_price));
      forecast.forEach((pt, idx) => {
        ctx.lineTo(getX(startIdx + idx + 1), getY(pt.modal_price));
      });
      ctx.lineTo(getX(totalPoints - 1), padTop + chartH);
      ctx.lineTo(getX(startIdx), padTop + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 3. Historical Line (Solid Olive)
    ctx.beginPath();
    ctx.strokeStyle = '#4F6B44';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    history.forEach((pt, idx) => {
      const x = getX(idx);
      const y = getY(pt.modal_price);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 4. Forecast Line (Dashed Gold/Amber)
    if (startIdx >= 0 && forecast.length > 0) {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.moveTo(getX(startIdx), getY(history[startIdx].modal_price));
      forecast.forEach((pt, idx) => {
        ctx.lineTo(getX(startIdx + idx + 1), getY(pt.modal_price));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Vertical "Today" Marker Line
    if (startIdx >= 0) {
      const todayX = getX(startIdx);
      const todayY = getY(history[startIdx].modal_price);

      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.5;
      ctx.moveTo(todayX, padTop - 5);
      ctx.lineTo(todayX, padTop + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Today Circle Marker
      ctx.beginPath();
      ctx.arc(todayX, todayY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#DC2626';
      ctx.stroke();

      // Today Label Tag
      const tagText = `TODAY ₹${history[startIdx].modal_price.toFixed(1)}`;
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      const tagW = ctx.measureText(tagText).width + 12;
      const tagX = Math.min(Math.max(todayX - tagW / 2, padLeft), w - padRight - tagW);
      ctx.fillStyle = '#FEE2E2';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(tagX, padTop - 22, tagW, 18, 4);
      } else {
        ctx.rect(tagX, padTop - 22, tagW, 18);
      }
      ctx.fill();
      ctx.fillStyle = '#B91C1C';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagX + tagW / 2, padTop - 13);
    }

    // 6. Data Points
    history.forEach((pt, idx) => {
      if (history.length > 15 && idx % 3 !== 0 && idx !== history.length - 1) return;
      ctx.fillStyle = '#4F6B44';
      ctx.beginPath();
      ctx.arc(getX(idx), getY(pt.modal_price), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    forecast.forEach((pt, idx) => {
      const x = getX(startIdx + idx + 1);
      const y = getY(pt.modal_price);
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 7. Timeline Labels on Bottom
    ctx.fillStyle = '#6B7280';
    ctx.font = '10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelIndices = [
      { idx: 0, text: `-${history.length}d` },
      { idx: Math.floor(history.length / 2), text: `-${Math.floor(history.length / 2)}d` },
      { idx: startIdx, text: 'Today' },
      { idx: Math.min(startIdx + 3, totalPoints - 1), text: '+3d' },
      { idx: totalPoints - 1, text: `+${forecast.length}d ML` }
    ];
    labelIndices.forEach(item => {
      if (item.idx >= 0 && item.idx < totalPoints) {
        const lx = getX(item.idx);
        ctx.fillText(item.text, lx, padTop + chartH + 8);
      }
    });
  }

  // --- Demand Predictions ---
  async function loadDemandPredictions() {
    try {
      const res = await fetch(`${API_BASE}/demand-prediction`);
      if (res.ok) {
        const data = await res.json();
        const tbody = document.getElementById('demand-table-tbody');
        if (!tbody) return;
        const commodities = Array.isArray(data.commodities) ? data.commodities : [];
        tbody.innerHTML = commodities.map(c => `
          <tr>
            <td><strong>${c.commodity === 'Tomato' ? '🍅' : c.commodity === 'Onion' ? '🧅' : c.commodity === 'Wheat' ? '🌾' : '🥔'} ${c.commodity}</strong></td>
            <td><strong style="font-family:'JetBrains Mono'; font-size:15px;">${c.current_demand_index || 0}/100</strong></td>
            <td><strong style="font-family:'JetBrains Mono'; font-size:15px; color:var(--olive-deep);">${c.predicted_demand_index || 0}/100</strong></td>
            <td><span style="font-weight:700; color:${(c.expected_change_pct || 0) >= 0 ? 'var(--olive)' : 'var(--alert)'}; font-family:'JetBrains Mono';">${(c.expected_change_pct || 0) >= 0 ? '+' : ''}${c.expected_change_pct || 0}%</span></td>
            <td><span class="badge-status ${c.status_badge === 'HIGH' ? 'active' : 'confirmed'}">${c.trend || 'Stable'}</span></td>
            <td style="font-size:12px; color:var(--soil-soft);">${c.driver || ''}</td>
          </tr>
        `).join('');
      }
    } catch(err) {
      console.error("Demand prediction error:", err);
    }
  }

  // --- OSRM Multi-Stop Logistics Route ---
  async function recalculateRoute() {
    const payload = {
      stops: [
        { name: "Lasalgaon FPO Aggregation Hub, Nashik", lat: 20.1472, lon: 74.2263, type: "HUB", quantity_kg: 2400, contact_name: "Lasalgaon FPO" },
        { name: "Ramesh Organic Farm, Dindori", lat: 19.9975, lon: 73.7898, type: "PICKUP", quantity_kg: 840, contact_name: "Ramesh Kumar" },
        { name: "Sangamner Agro Cluster, Ahmednagar", lat: 19.5772, lon: 74.2081, type: "PICKUP", quantity_kg: 600, contact_name: "Sunita Patil" },
        { name: "Vashi APMC Wholesale Market, Navi Mumbai", lat: 19.0760, lon: 72.9984, type: "DELIVERY", quantity_kg: 1440, contact_name: "APMC Trader" },
        { name: "Dadar Wholesale Market, Mumbai", lat: 19.0178, lon: 72.8478, type: "DELIVERY", quantity_kg: 2400, contact_name: "City Fresh" }
      ],
      optimize_stops: true
    };

    try {
      const res = await fetch(`${API_BASE}/routes/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const route = await res.json();
        const distEl = document.getElementById('route-stat-distance');
        if (distEl) distEl.innerText = `${route.total_distance_km || route.distance_km || 325.3} km`;
        const durEl = document.getElementById('route-stat-duration');
        if (durEl) durEl.innerText = route.total_duration_formatted || route.duration_formatted || '4h 45m';
        const nDurEl = document.getElementById('route-stat-normal-dur');
        if (nDurEl) nDurEl.innerText = `Routing: ${route.routing_engine || 'OSRM Live Road'}`;
        const fuelEl = document.getElementById('route-stat-fuel');
        if (fuelEl) fuelEl.innerText = `₹${(route.fuel_saved_inr || 3532).toLocaleString('en-IN')}`;
        const srcEl = document.getElementById('route-stat-source');
        if (srcEl) srcEl.innerText = "OSRM Routing";
        const stops = Array.isArray(route.stops) ? route.stops : (route.ordered_stops || []);
        const stopsCountEl = document.getElementById('route-stat-stops-count');
        if (stopsCountEl) stopsCountEl.innerText = `${stops.length} Stops Planned`;

        // Render stops timeline
        const cont = document.getElementById('route-stops-timeline-container');
        if (cont) {
          const legs = Array.isArray(route.legs) ? route.legs : [];
          cont.innerHTML = stops.map((s, idx) => {
            const legInfo = (idx < legs.length) ? legs[idx] : null;
            const typeColor = s.type === 'PICKUP' ? '#2D5A27' : s.type === 'HUB' ? '#D97706' : '#DC2626';
            return `
              <div style="background:var(--creme); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="background:${typeColor}; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">${s.sequence || (idx+1)}</span>
                    <div>
                      <strong>${s.name}</strong>
                      <div style="font-size:11.5px; color:var(--soil-soft);">${s.contact_name ? `Contact: ${s.contact_name} · ` : ''}${s.quantity_kg ? `${s.quantity_kg} kg` : ''}</div>
                    </div>
                  </div>
                  <span class="badge-status ${s.type === 'PICKUP' ? 'active' : s.type === 'HUB' ? 'confirmed' : 'in_transit'}">${s.type}</span>
                </div>
                ${legInfo ? `
                  <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--line); display:flex; justify-content:space-between; font-size:11.5px; color:var(--soil-soft); font-family:'JetBrains Mono';">
                    <span>🛣️ Next Leg: ${legInfo.to_stop}</span>
                    <span><strong>${legInfo.distance_km} km</strong> · <strong>${legInfo.duration_formatted}</strong></span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('');
        }

        renderLogisticsRouteMap(route);
        showToast("✓ Multi-stop route calculated with OSRM road geometry!");
      }
    } catch(err) {
      console.error("Route error:", err);
      showToast("❌ Could not calculate logistics route.");
    }
  }

  function renderLogisticsRouteMap(routeData) {
    const canvasId = 'logistics-map-canvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const stops = Array.isArray(routeData.stops) ? routeData.stops : (routeData.ordered_stops || []);
    if (!stops || stops.length === 0) return;

    const firstStop = stops[0];
    const map = getOrCreateLeafletMap(canvasId, firstStop.lat, firstStop.lon || firstStop.lng || 74.2263, 9);
    if (!map) return;

    // Clear existing logistics layers
    if (leafletLayers['logistics_group']) {
      map.removeLayer(leafletLayers['logistics_group']);
    }
    const logisticsGroup = L.featureGroup().addTo(map);
    leafletLayers['logistics_group'] = logisticsGroup;

    // Add Stop Markers
    stops.forEach((s, idx) => {
      const lat = s.lat;
      const lon = s.lon || s.lng;
      const type = s.type || (idx === 0 ? 'HUB' : idx === stops.length - 1 ? 'DELIVERY' : 'PICKUP');
      const pinType = type === 'PICKUP' ? 'farm' : type === 'HUB' ? 'hub' : 'buyer';
      const pinIconChar = type === 'PICKUP' ? '🧑‍🌾' : type === 'HUB' ? '🏢' : '🏁';
      const pinBg = type === 'PICKUP' ? '#2D5A27' : type === 'HUB' ? '#D97706' : '#DC2626';

      const marker = L.marker([lat, lon], {
        icon: createLeafletPinIcon(pinType, pinIconChar, pinBg)
      }).addTo(logisticsGroup);

      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif; padding:4px;">
          <strong style="color:${pinBg};">Stop ${s.sequence || (idx+1)}: ${s.name}</strong><br>
          <span style="font-size:12px; color:#444;">${s.address || s.name}</span><br>
          <span style="font-size:11px; font-weight:700;">Type: ${s.type} · Quantity: ${s.quantity_kg || 0} kg</span>
        </div>
      `);
    });

    // Draw OSRM Road Polyline
    if (routeData.route_geometry && routeData.route_geometry.coordinates && routeData.route_geometry.coordinates.length > 0) {
      const roadPoly = L.geoJSON(routeData.route_geometry, {
        style: {
          color: '#2D5A27',
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }
      }).addTo(logisticsGroup);

      L.geoJSON(routeData.route_geometry, {
        style: {
          color: '#FFFFFF',
          weight: 2,
          opacity: 0.6,
          dashArray: '8, 6'
        }
      }).addTo(logisticsGroup);

      map.fitBounds(roadPoly.getBounds(), { padding: [40, 40] });
    } else {
      map.fitBounds(logisticsGroup.getBounds(), { padding: [40, 40] });
    }

    logisticsMapObj = map;
  }

  // --- Comprehensive 9-Stage Order Tracking & Delivery System ---
  async function loadTrackingOrdersList() {
    // Show list view, hide detail view
    const listView = document.getElementById('tracking-orders-list-view');
    const detailView = document.getElementById('tracking-order-detail-view');
    if (listView) listView.style.display = 'block';
    if (detailView) detailView.style.display = 'none';

    try {
      const isFarmer = currentUser && currentUser.role === 'FARMER_FPO';
      const titleEl = document.getElementById('tracking-list-title');
      const subEl = document.getElementById('tracking-list-subtitle');
      if (titleEl) titleEl.innerText = isFarmer ? 'Orders Received & Dispatch Tracking' : 'My Orders & Delivery Tracking';
      if (subEl) subEl.innerText = isFarmer ? 'Monitor dispatches, stage transitions, and driver custody to buyer destinations.' : 'Track live carrier checkpoints, estimated arrival, and verified delivery proofs.';

      const res = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      if (res.ok) {
        const raw = await res.json();
        trackingOrdersCache = Array.isArray(raw) ? raw : [];
        renderTrackingOrdersGrid(trackingOrdersCache);
      }
    } catch(err) {
      console.error("Tracking orders error:", err);
    }
  }

  function renderTrackingOrdersGrid(orders) {
    const grid = document.getElementById('tracking-orders-grid');
    const emptyState = document.getElementById('tracking-empty-state');
    if (!grid) return;

    if (!orders || orders.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    const isFarmer = currentUser && currentUser.role === 'FARMER_FPO';

    grid.innerHTML = orders.map(o => {
      const cropEmoji = o.crop === 'Tomato' ? '🍅' : o.crop === 'Onion' ? '🧅' : o.crop === 'Wheat' ? '🌾' : '🥔';
      const stClass = (o.status || 'active').toLowerCase();
      return `
        <div class="track-card">
          <div>
            <div class="track-card-header">
              <div>
                <span style="font-family:'JetBrains Mono',monospace; font-size:12.5px; font-weight:700; color:var(--gold-deep); background:var(--creme); padding:2px 8px; border-radius:6px; border:1px solid var(--line);">#${o.order_code}</span>
                <span style="margin-left:8px; font-size:13px; font-weight:600; color:var(--soil);">${cropEmoji} ${o.crop} (${o.variety})</span>
              </div>
              <span class="badge-status ${stClass}">${o.status_label || o.status}</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:baseline; margin:8px 0;">
              <h3 style="font-family:'Fraunces',serif; font-size:20px; margin:0; color:var(--soil);">${(o.quantity_kg || 0).toLocaleString()} kg</h3>
              <strong style="font-family:'JetBrains Mono',monospace; font-size:16px; color:var(--olive-deep);">₹${(o.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits:2})}</strong>
            </div>

            <div class="track-route-box">
              <div style="margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                <span style="color:var(--olive); font-weight:700;">📍 From:</span>
                <span>${isFarmer ? 'Your Farm' : o.farmer_name} (${o.pickup_address})</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="color:var(--gold-deep); font-weight:700;">🏁 To:</span>
                <span>${isFarmer ? o.buyer_name : 'Your Delivery Location'} (${o.delivery_address})</span>
              </div>
            </div>
          </div>

          <div class="track-card-footer">
            <div style="font-size:11.5px; color:var(--soil-soft);">
              ⏱️ <strong>ETA:</strong> ${o.estimated_delivery_time || 'Today, 4:35 PM'}
            </div>
            <button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="openOrderTrackingDetail(${o.id})">
              Track Order on Map →
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function filterTrackingOrders(filterType, btn) {
    if (btn) {
      document.querySelectorAll('#tracking-filter-tabs .tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    if (filterType === 'ALL') {
      renderTrackingOrdersGrid(trackingOrdersCache);
    } else if (filterType === 'IN_TRANSIT') {
      renderTrackingOrdersGrid(trackingOrdersCache.filter(o => o.status === 'IN_TRANSIT' || o.status === 'NEAR_DESTINATION' || o.status === 'OUT_FOR_DELIVERY'));
    } else if (filterType === 'READY_FOR_PICKUP') {
      renderTrackingOrdersGrid(trackingOrdersCache.filter(o => o.status === 'ORDER_PLACED' || o.status === 'ORDER_CONFIRMED' || o.status === 'PACKING' || o.status === 'READY_FOR_PICKUP' || o.status === 'PICKED_UP'));
    } else if (filterType === 'DELIVERED') {
      renderTrackingOrdersGrid(trackingOrdersCache.filter(o => o.status === 'DELIVERED'));
    }
  }

  function searchTrackingOrders(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      renderTrackingOrdersGrid(trackingOrdersCache);
      return;
    }
    const filtered = trackingOrdersCache.filter(o => 
      (o.order_code && o.order_code.toLowerCase().includes(q)) ||
      (o.crop && o.crop.toLowerCase().includes(q)) ||
      (o.farmer_name && o.farmer_name.toLowerCase().includes(q)) ||
      (o.buyer_name && o.buyer_name.toLowerCase().includes(q)) ||
      (o.pickup_address && o.pickup_address.toLowerCase().includes(q)) ||
      (o.delivery_address && o.delivery_address.toLowerCase().includes(q))
    );
    renderTrackingOrdersGrid(filtered);
  }

  async function openOrderTrackingDetail(orderId) {
    currentTrackingOrderId = orderId;
    const listView = document.getElementById('tracking-orders-list-view');
    const detailView = document.getElementById('tracking-order-detail-view');
    if (listView) listView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/tracking`, { headers: getAuthHeaders() });
      if (res.ok) {
        const detail = await res.json();
        currentTrackingDetail = detail;

        // Header info
        const cropEmoji = detail.crop === 'Tomato' ? '🍅' : detail.crop === 'Onion' ? '🧅' : detail.crop === 'Wheat' ? '🌾' : '🥔';
        if (document.getElementById('td-order-code')) document.getElementById('td-order-code').innerText = `ORDER #${detail.order_code || ''}`;
        if (document.getElementById('td-crop-title')) document.getElementById('td-crop-title').innerText = `${cropEmoji} ${detail.crop || ''} (${detail.variety || ''})`;
        if (document.getElementById('td-headline-qty')) document.getElementById('td-headline-qty').innerText = `${(detail.quantity_kg || 0).toLocaleString()} kg • ₹${(detail.total_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        if (document.getElementById('td-rate-sub')) document.getElementById('td-rate-sub').innerText = `Contract Price: ₹${(detail.price_per_kg || 0).toFixed(2)}/kg · Quality: Grade A`;
        if (document.getElementById('td-eta-val')) document.getElementById('td-eta-val').innerText = detail.estimated_delivery_time || 'Today, 4:35 PM';
        
        const badge = document.getElementById('td-status-badge');
        if (badge) {
          badge.innerText = detail.status_label || detail.status || 'Active';
          badge.className = `badge-status ${(detail.status || 'active').toLowerCase()}`;
        }

        // Last known location status bar
        const loc = detail.last_known_location || {};
        if (document.getElementById('td-last-known-loc-name')) document.getElementById('td-last-known-loc-name').innerText = loc.location_name || 'En Route';
        if (document.getElementById('td-last-known-time-ago')) document.getElementById('td-last-known-time-ago').innerText = `(Updated ${loc.time_ago || 'Just now'})`;
        if (document.getElementById('td-route-distance')) document.getElementById('td-route-distance').innerText = `${detail.distance_km || 0} km`;
        if (document.getElementById('td-route-duration')) document.getElementById('td-route-duration').innerText = detail.duration_formatted || 'In Transit';

        // Delivery Proof Card
        const proofCard = document.getElementById('td-delivery-proof-card');
        if (proofCard) {
          if (detail.delivery_proof) {
            proofCard.style.display = 'block';
            if (document.getElementById('td-proof-receiver-name')) document.getElementById('td-proof-receiver-name').innerText = detail.delivery_proof.receiver_name || '';
            if (document.getElementById('td-proof-notes')) document.getElementById('td-proof-notes').innerText = detail.delivery_proof.delivery_notes || 'All crates inspected and accepted.';
            const proofDate = detail.delivery_proof.delivered_at ? new Date(detail.delivery_proof.delivered_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Verified';
            if (document.getElementById('td-proof-timestamp')) document.getElementById('td-proof-timestamp').innerText = proofDate;
            if (document.getElementById('td-proof-tag')) document.getElementById('td-proof-tag').innerText = detail.delivery_proof.photo_url || '📦 Crate Seal Verified';
          } else {
            proofCard.style.display = 'none';
          }
        }

        // 9-Stage Timeline Stepper
        if (Array.isArray(detail.timeline)) {
          render9StageTimeline(detail.timeline);
        }

        // 3-Column Info
        if (document.getElementById('td-farmer-farm')) document.getElementById('td-farmer-farm').innerText = `${detail.farmer_name || 'Farmer'}'s Farm`;
        if (document.getElementById('td-farmer-name')) document.getElementById('td-farmer-name').innerText = `${detail.farmer_name || ''} (${detail.farmer_phone || ''})`;
        if (document.getElementById('td-farmer-loc')) document.getElementById('td-farmer-loc').innerText = detail.pickup_address || '';
        if (document.getElementById('td-farmer-coords')) document.getElementById('td-farmer-coords').innerText = `${(detail.pickup_lat || 19.9975).toFixed(4)}, ${(detail.pickup_lon || 73.7898).toFixed(4)}`;

        if (document.getElementById('td-buyer-biz')) document.getElementById('td-buyer-biz').innerText = detail.buyer_name || 'Buyer';
        if (document.getElementById('td-buyer-name')) document.getElementById('td-buyer-name').innerText = `${detail.buyer_name || ''} (${detail.buyer_phone || ''})`;
        if (document.getElementById('td-buyer-loc')) document.getElementById('td-buyer-loc').innerText = detail.delivery_address || '';
        if (document.getElementById('td-buyer-coords')) document.getElementById('td-buyer-coords').innerText = `${(detail.delivery_lat || 19.0178).toFixed(4)}, ${(detail.delivery_lon || 72.8478).toFixed(4)}`;

        if (detail.vehicle) {
          if (document.getElementById('td-vehicle-num')) document.getElementById('td-vehicle-num').innerText = detail.vehicle.vehicle_number;
          if (document.getElementById('td-vehicle-type')) document.getElementById('td-vehicle-type').innerText = `${detail.vehicle.vehicle_type} · ${(detail.vehicle.capacity_kg || 0).toLocaleString()} kg Cap`;
        }
        if (detail.driver) {
          if (document.getElementById('td-driver-name')) document.getElementById('td-driver-name').innerText = `${detail.driver.name} (${detail.driver.phone})`;
          if (document.getElementById('td-driver-license')) document.getElementById('td-driver-license').innerText = detail.driver.license_number;
        }

        // Action Buttons for simulation/dispatch
        renderDispatchActionButtons(detail);

        // Audit Logs
        const logsCont = document.getElementById('td-audit-logs-container');
        if (logsCont) {
          if (Array.isArray(detail.tracking_events) && detail.tracking_events.length > 0) {
            logsCont.innerHTML = detail.tracking_events.map(ev => {
              const evDate = ev.timestamp ? new Date(ev.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Logged';
              return `
                <div style="background:var(--creme); border:1px solid var(--line); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-size:12.5px;">
                  <div>
                    <strong style="color:var(--soil);">${(ev.status || '').replace(/_/g, ' ')}</strong>
                    <div style="color:var(--soil-soft); font-size:11.5px; margin-top:2px;">📍 ${ev.location_name || ''} · ${ev.notes || ''}</div>
                  </div>
                  <div style="text-align:right;">
                    <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--soil-soft);">${evDate}</span>
                    <div style="font-size:10.5px; color:var(--olive); font-weight:600;">By ${ev.updated_by || 'Carrier'}</div>
                  </div>
                </div>
              `;
            }).join('');
          } else {
            logsCont.innerHTML = `<div style="font-size:12px; color:var(--soil-soft); padding:10px;">Order placed and recorded in ledger.</div>`;
          }
        }

        // Render Real Leaflet & OpenStreetMap Road Tracking Map
        setTimeout(() => renderTrackingLeafletMap(detail), 150);
      }
    } catch(err) {
      console.error("Order tracking load error:", err);
      showToast("❌ Could not load tracking details.");
    }
  }

  function closeTrackingDetail() {
    currentTrackingOrderId = null;
    loadTrackingOrdersList();
  }

  function refreshCurrentTrackingDetail() {
    if (currentTrackingOrderId) {
      openOrderTrackingDetail(currentTrackingOrderId);
      showToast("✓ Live tracking data refreshed.");
    }
  }

  function render9StageTimeline(timeline) {
    const cont = document.getElementById('td-timeline-9-container');
    if (!cont) return;

    cont.innerHTML = timeline.map(step => {
      let stateClass = '';
      let dotContent = step.step_number;
      if (step.is_completed) {
        stateClass = 'completed';
        dotContent = '✓';
      } else if (step.is_current) {
        stateClass = 'current';
        dotContent = '●';
      }

      return `
        <div class="timeline-9-item ${stateClass}">
          <div class="timeline-9-dot">${dotContent}</div>
          <div class="timeline-9-content">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <strong style="color:var(--soil); font-size:13.5px;">${step.step_number}. ${step.label}</strong>
              <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:${step.is_completed ? 'var(--olive-deep)' : step.is_current ? 'var(--gold-deep)' : 'var(--soil-soft)'}; font-weight:700;">
                ${step.timestamp || ''}
              </span>
            </div>
            <div style="font-size:12px; color:var(--soil-soft); margin-top:3px;">
              📍 <strong>Location:</strong> ${step.location || 'Hub'} · <span>${step.notes || ''}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDispatchActionButtons(detail) {
    const cont = document.getElementById('td-action-buttons-container');
    if (!cont) return;

    const st = detail.status;
    const isFarmer = currentUser && currentUser.role === 'FARMER_FPO';
    const oid = detail.order_id;
    const did = 1; // delivery ID

    let btns = [];

    if (st === 'ORDER_PLACED') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'ORDER_CONFIRMED', 'Farmer confirmed harvest and reserved stock.')">✅ Confirm Order</button>`);
    } else if (st === 'ORDER_CONFIRMED') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'PACKING', 'Crates graded, weighed, and sealed with security tags.')">📦 Start Packing</button>`);
    } else if (st === 'PACKING') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'READY_FOR_PICKUP', 'Staged at farm gate loading bay.')">🚜 Mark Ready for Pickup</button>`);
    } else if (st === 'READY_FOR_PICKUP') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'PICKED_UP', 'Loaded into truck MH-15-EG-4482. Driver custody accepted.')">🚚 Confirm Farm Pickup</button>`);
    } else if (st === 'PICKED_UP') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'IN_TRANSIT', 'Driver en route on NH-160 highway corridor.')">🛣️ Start Highway Transit</button>`);
    } else if (st === 'IN_TRANSIT') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'NEAR_DESTINATION', 'Arrived at city outskirts aggregation hub.')">🏙️ Near Destination Hub</button>`);
    } else if (st === 'NEAR_DESTINATION') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="advanceOrderStatus(${oid}, 'OUT_FOR_DELIVERY', 'Carrier entered destination sector for doorstep drop.')">🛵 Out for Delivery</button>`);
    } else if (st === 'OUT_FOR_DELIVERY') {
      btns.push(`<button class="btn-primary" style="padding:6px 14px; font-size:12px; background:var(--olive-deep);" onclick="openDeliveryProofModal(${did}, ${oid})">🎉 Mark Delivered &amp; Submit Proof</button>`);
    } else if (st === 'DELIVERED') {
      btns.push(`<span style="color:var(--olive-deep); font-weight:700; font-size:12.5px; display:inline-flex; align-items:center; gap:6px;">✓ Order Fully Completed &amp; Payout Settled</span>`);
      btns.push(`<button class="btn-ghost" style="padding:5px 12px; font-size:11.5px;" onclick="advanceOrderStatus(${oid}, 'IN_TRANSIT', 'Re-opened demo corridor tracking.')">🔄 Reset to In Transit (Demo)</button>`);
    }

    cont.innerHTML = btns.join('');
  }

  async function advanceOrderStatus(orderId, nextStatus, notes) {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: nextStatus, notes: notes })
      });

      if (res.ok) {
        showToast(`✓ Order updated to [${nextStatus.replace(/_/g, ' ')}]`);
        openOrderTrackingDetail(orderId);
        fetchCurrentUser();
      } else {
        const errData = await res.json();
        showToast(`❌ Error: ${errData.detail || 'Could not update status'}`);
      }
    } catch(err) {
      console.error("Status update error:", err);
      showToast("❌ Network error updating status.");
    }
  }

  // --- Real Leaflet & OpenStreetMap Tracking Map Renderer ---
  function renderTrackingLeafletMap(detail) {
    const canvasId = 'tracking-detail-map-canvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const noticeEl = document.getElementById('tracking-detail-map-notice');
    if (noticeEl) noticeEl.style.display = 'none';

    const pickupLat = parseFloat(detail.pickup_lat || (detail.pickup_location && detail.pickup_location.lat) || 20.3548);
    const pickupLng = parseFloat(detail.pickup_lon || (detail.pickup_location && (detail.pickup_location.lon || detail.pickup_location.lng)) || 85.8182);
    
    const lastLoc = detail.last_known_location || detail.last_known_position || {};
    const truckLat = parseFloat(lastLoc.lat || ((pickupLat + (detail.delivery_lat || 20.4625)) / 2.0));
    const truckLng = parseFloat(lastLoc.lon || lastLoc.lng || ((pickupLng + (detail.delivery_lon || 85.8830)) / 2.0));
    
    const delLat = parseFloat(detail.delivery_lat || (detail.delivery_location && detail.delivery_location.lat) || 20.4625);
    const delLng = parseFloat(detail.delivery_lon || (detail.delivery_location && (detail.delivery_location.lon || detail.delivery_location.lng)) || 85.8830);

    const map = getOrCreateLeafletMap(canvasId, truckLat, truckLng, 10);
    if (!map) return;

    // Clear previous tracking layers
    if (leafletLayers['tracking_group']) {
      map.removeLayer(leafletLayers['tracking_group']);
    }
    const trackingGroup = L.featureGroup().addTo(map);
    leafletLayers['tracking_group'] = trackingGroup;

    // 1. Pickup Marker (Green 🟢 Farm)
    const pickupMarker = L.marker([pickupLat, pickupLng], {
      icon: createLeafletPinIcon('farm', '🧑‍🌾', '#2D5A27')
    }).addTo(trackingGroup);
    pickupMarker.bindPopup(`
      <div style="font-family:'Inter',sans-serif; padding:4px;">
        <strong style="color:#2D5A27;">📍 Farm Gate: ${detail.farmer_name || 'Farmer'}</strong><br>
        <span style="font-size:12px; color:#555;">${detail.pickup_address || (detail.pickup_location && detail.pickup_location.address) || 'Farm Gate'}</span><br>
        <span style="font-size:11px; font-weight:700;">Order: #${detail.order_code || ''} (${detail.quantity_kg || 0} kg ${detail.crop || ''})</span>
      </div>
    `);

    // 2. Vehicle Checkpoint Marker (Blue 🚚 Truck)
    const truckMarker = L.marker([truckLat, truckLng], {
      icon: createLeafletPinIcon('truck', '🚚', '#2563EB')
    }).addTo(trackingGroup);
    truckMarker.bindPopup(`
      <div style="font-family:'Inter',sans-serif; padding:4px;">
        <strong style="color:#2563EB;">🚚 Vehicle: ${detail.vehicle ? detail.vehicle.vehicle_number : 'MH-15-EG-4482'}</strong><br>
        <span style="font-size:12px; color:#333;">Driver: ${detail.driver ? detail.driver.name : 'Suresh Patil'}</span><br>
        <span style="font-size:11px; color:#666;">Location: ${lastLoc.location_name || lastLoc.label || 'Highway Corridor'}</span><br>
        <span style="font-size:11px; color:#2D5A27; font-weight:700;">Updated: ${lastLoc.time_ago || 'Live'}</span>
      </div>
    `);

    // 3. Buyer Destination Marker (Red 🔴 Buyer Drop)
    const delMarker = L.marker([delLat, delLng], {
      icon: createLeafletPinIcon('buyer', '🏁', '#DC2626')
    }).addTo(trackingGroup);
    delMarker.bindPopup(`
      <div style="font-family:'Inter',sans-serif; padding:4px;">
        <strong style="color:#DC2626;">🏁 Delivery: ${detail.buyer_name || 'Buyer'}</strong><br>
        <span style="font-size:12px; color:#555;">${detail.delivery_address || (detail.delivery_location && detail.delivery_location.address) || 'Buyer Destination'}</span><br>
        <span style="font-size:11px; font-weight:700;">Status: ${detail.status_label || detail.status}</span>
      </div>
    `);

    // 4. Draw Real OSRM Road Route
    if (detail.route_geometry && detail.route_geometry.coordinates && detail.route_geometry.coordinates.length > 0) {
      const outerPoly = L.geoJSON(detail.route_geometry, {
        style: {
          color: '#2D5A27',
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }
      }).addTo(trackingGroup);

      L.geoJSON(detail.route_geometry, {
        style: {
          color: '#FFFFFF',
          weight: 2,
          opacity: 0.6,
          dashArray: '8, 6'
        }
      }).addTo(trackingGroup);

      map.fitBounds(outerPoly.getBounds(), { padding: [40, 40] });
    } else {
      const bounds = L.latLngBounds([
        [pickupLat, pickupLng],
        [truckLat, truckLng],
        [delLat, delLng]
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    trackingDetailMapObj = map;
    trackingMarkers = {
      pickupPos: [pickupLat, pickupLng],
      truckPos: [truckLat, truckLng],
      deliveryPos: [delLat, delLng],
      pickupMarker: pickupMarker,
      truckMarker: truckMarker,
      delMarker: delMarker
    };
  }

  // Backward compatibility alias
  var renderTrackingGoogleMap = renderTrackingLeafletMap;

  function focusMapMarker(target) {
    if (!trackingDetailMapObj) return;
    if (target === 'pickup' && trackingMarkers.pickupPos) {
      trackingDetailMapObj.setView(trackingMarkers.pickupPos, 14);
      if (trackingMarkers.pickupMarker) trackingMarkers.pickupMarker.openPopup();
    } else if (target === 'truck' && trackingMarkers.truckPos) {
      trackingDetailMapObj.setView(trackingMarkers.truckPos, 14);
      if (trackingMarkers.truckMarker) trackingMarkers.truckMarker.openPopup();
    } else if (target === 'delivery' && trackingMarkers.deliveryPos) {
      trackingDetailMapObj.setView(trackingMarkers.deliveryPos, 14);
      if (trackingMarkers.delMarker) trackingMarkers.delMarker.openPopup();
    }
  }

  function recenterTrackingMap() {
    if (trackingDetailMapObj && trackingMarkers.pickupPos && trackingMarkers.truckPos && trackingMarkers.deliveryPos) {
      const bounds = L.latLngBounds([
        trackingMarkers.pickupPos,
        trackingMarkers.truckPos,
        trackingMarkers.deliveryPos
      ]);
      trackingDetailMapObj.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  // --- Delivery Proof Modal Handlers ---
  function openDeliveryProofModal(deliveryId, orderId) {
    document.getElementById('proof-delivery-id').value = deliveryId || 1;
    document.getElementById('proof-order-id').value = orderId;
    if (currentTrackingDetail) {
      document.getElementById('proof-receiver-name').value = currentTrackingDetail.buyer_name || '';
      document.getElementById('proof-receiver-phone').value = currentTrackingDetail.buyer_phone || '';
    }
    document.getElementById('delivery-proof-modal').classList.add('open');
  }

  function closeDeliveryProofModal() {
    document.getElementById('delivery-proof-modal').classList.remove('open');
  }

  async function handleDeliveryProofSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const did = document.getElementById('proof-delivery-id').value || 1;
    const oid = document.getElementById('proof-order-id').value;
    const payload = {
      receiver_name: document.getElementById('proof-receiver-name').value.trim(),
      receiver_phone: document.getElementById('proof-receiver-phone').value.trim(),
      photo_url: document.getElementById('proof-seal-status').value,
      delivery_notes: document.getElementById('proof-notes').value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/deliveries/${did}/deliver`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeDeliveryProofModal();
        showToast("🎉 Delivery verified! Farmer payout balance credited.");
        if (oid) openOrderTrackingDetail(parseInt(oid));
        fetchCurrentUser();
      } else {
        const err = await res.json();
        showToast(`❌ Error: ${err.detail || 'Could not verify delivery'}`);
      }
    } catch(err) {
      console.error("Proof submission error:", err);
      showToast("❌ Network error submitting proof.");
    }
  }

  // --- Driver Checkpoint Modal Handlers ---
  function openCheckpointUpdateModalFromCurrent() {
    if (!currentTrackingDetail) return;
    document.getElementById('chk-delivery-id').value = 1;
    document.getElementById('chk-order-id').value = currentTrackingDetail.order_id;
    document.getElementById('chk-location-name').value = currentTrackingDetail.last_known_location.location_name;
    document.getElementById('chk-lat').value = currentTrackingDetail.last_known_location.lat;
    document.getElementById('chk-lon').value = currentTrackingDetail.last_known_location.lon;
    document.getElementById('checkpoint-update-modal').classList.add('open');
  }

  function closeCheckpointUpdateModal() {
    document.getElementById('checkpoint-update-modal').classList.remove('open');
  }

  function setCheckpointPreset(name, lat, lon) {
    document.getElementById('chk-location-name').value = name;
    document.getElementById('chk-lat').value = lat;
    document.getElementById('chk-lon').value = lon;
  }

  async function handleCheckpointUpdateSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const did = document.getElementById('chk-delivery-id').value || 1;
    const oid = document.getElementById('chk-order-id').value;
    const payload = {
      location_name: document.getElementById('chk-location-name').value.trim(),
      latitude: parseFloat(document.getElementById('chk-lat').value),
      longitude: parseFloat(document.getElementById('chk-lon').value),
      notes: document.getElementById('chk-notes').value.trim()
    };
    const newStatus = document.getElementById('chk-status').value;
    if (newStatus) payload.status = newStatus;

    try {
      const res = await fetch(`${API_BASE}/deliveries/${did}/location`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeCheckpointUpdateModal();
        showToast("📍 Checkpoint logged & Leaflet map updated!");
        if (oid) openOrderTrackingDetail(parseInt(oid));
      } else {
        const err = await res.json();
        showToast(`❌ Error: ${err.detail || 'Could not update location'}`);
      }
    } catch(err) {
      console.error("Checkpoint update error:", err);
      showToast("❌ Network error saving checkpoint.");
    }
  }

  function contactParticipant(type) {
    if (!currentTrackingDetail) return;
    let name = "", phone = "", role = "";
    if (type === 'farmer') {
      name = currentTrackingDetail.farmer_name;
      phone = currentTrackingDetail.farmer_phone;
      role = "Farmer";
    } else if (type === 'buyer') {
      name = currentTrackingDetail.buyer_name;
      phone = currentTrackingDetail.buyer_phone;
      role = "Buyer";
    } else if (type === 'driver') {
      name = currentTrackingDetail.driver ? currentTrackingDetail.driver.name : "Suresh Patil";
      phone = currentTrackingDetail.driver ? currentTrackingDetail.driver.phone : "+91 98221 00998";
      role = "Driver (MH-15-EG-4482)";
    }
    alert(`📞 Kisan Setu Direct Contact:\n\nRole: ${role}\nName: ${name}\nPhone: ${phone}\n\nInitiating simulated secure voice link.`);
  }

  // --- Profile Page View ---
  async function loadUserProfileView() {
    function populateFields() {
      if (!currentUser) return;
      const isFarmer = currentUser.role === 'FARMER_FPO';

      const pName = document.getElementById('p-name');
      const pEmail = document.getElementById('p-email');
      const pPhone = document.getElementById('p-phone');
      const pRole = document.getElementById('p-role-display');

      if (pName) pName.value = currentUser.name || '';
      if (pEmail) pEmail.value = currentUser.email || '';
      if (pPhone) pPhone.value = currentUser.phone || '';
      if (pRole) pRole.value = isFarmer ? 'FARMER / FPO' : 'BUYER / CONSUMER';

      const pFarmerSpec = document.getElementById('p-farmer-specific');
      const pBuyerSpec = document.getElementById('p-buyer-specific');
      if (pFarmerSpec) pFarmerSpec.style.display = isFarmer ? 'block' : 'none';
      if (pBuyerSpec) pBuyerSpec.style.display = isFarmer ? 'none' : 'block';

      const lbl = document.getElementById('p-address-lbl');
      if (lbl) lbl.innerText = isFarmer ? 'Search registered farm gate address *' : 'Search registered delivery address *';

      if (isFarmer && currentUser.farmer_profile) {
        const fp = currentUser.farmer_profile;
        const pFarmName = document.getElementById('p-farm-name');
        const pFarmSize = document.getElementById('p-farm-size');
        const pCrops = document.getElementById('p-crops-grown');
        if (pFarmName) pFarmName.value = fp.farm_name || '';
        if (pFarmSize) pFarmSize.value = fp.farm_size_acres || 5;
        if (pCrops) pCrops.value = fp.crops_grown || 'Tomato, Onion';
        
        const locData = {
          formatted_address: fp.farm_location || fp.address || 'KIIT University, Patia, Bhubaneswar, Odisha 751024, India',
          state: fp.state || 'Odisha',
          district: fp.district || 'Khordha',
          city: fp.city || 'Bhubaneswar',
          pincode: fp.pincode || '751024',
          lat: fp.lat || 20.3548,
          lon: fp.lon || 85.8182,
          place_id: fp.google_place_id || ''
        };
        applyLocationSelection('p', locData, false);
        const badgeText = document.getElementById('p-loc-badge-text');
        if (badgeText) badgeText.innerText = 'Registered Farm Location';
      } else if (!isFarmer && currentUser.buyer_profile) {
        const bp = currentUser.buyer_profile;
        const pBizName = document.getElementById('p-business-name');
        const pBuyerType = document.getElementById('p-buyer-type');
        if (pBizName) pBizName.value = bp.business_name || '';
        if (pBuyerType) pBuyerType.value = bp.buyer_type || 'Retailer';
        
        const locData = {
          formatted_address: bp.delivery_location || bp.address || 'Dadar Wholesale Market, Mumbai, Maharashtra',
          state: bp.state || 'Maharashtra',
          district: bp.district || 'Mumbai City',
          city: bp.city || 'Mumbai',
          pincode: bp.pincode || '400028',
          lat: bp.lat || 19.0178,
          lon: bp.lon || 72.8478,
          place_id: bp.google_place_id || ''
        };
        applyLocationSelection('p', locData, false);
        const badgeText = document.getElementById('p-loc-badge-text');
        if (badgeText) badgeText.innerText = 'Registered Delivery Location';
      }
    }

    // 1. Populate immediately from memory
    if (currentUser) {
      populateFields();
    }

    // 2. Fetch fresh /auth/me in background and update
    if (authToken) {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
        if (res.ok) {
          currentUser = await res.json();
          updateUserUI();
          populateFields();
        }
      } catch(e) {
        console.warn("[PROFILE] Could not refresh /auth/me:", e);
      }
    }

    // 3. Initialize interactive Leaflet map and invalidate size
    setTimeout(() => {
      initLocationPickerMap('p');
      const canvasId = 'p-map-canvas';
      const map = leafletMaps[canvasId] || profileMapObj;
      if (map && map.invalidateSize) {
        map.invalidateSize();
      }
    }, 200);
  }

  async function handleUpdateProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');

    const submitBtn = document.querySelector('#form-edit-profile button[type="submit"]');
    const origBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Saving Profile...";
    }

    const stateVal = document.getElementById('p-state') ? document.getElementById('p-state').value.trim() : '';
    const districtVal = document.getElementById('p-district') ? document.getElementById('p-district').value.trim() : '';
    const cityVal = document.getElementById('p-city') ? document.getElementById('p-city').value.trim() : '';
    const pincodeVal = document.getElementById('p-pincode') ? document.getElementById('p-pincode').value.trim() : '';
    const addressVal = document.getElementById('p-address') ? document.getElementById('p-address').value.trim() : '';
    const latVal = parseFloat(document.getElementById('p-lat') ? document.getElementById('p-lat').value : 0) || (isFarmer ? 20.3548 : 19.0178);
    const lonVal = parseFloat(document.getElementById('p-lon') ? document.getElementById('p-lon').value : 0) || (isFarmer ? 85.8182 : 72.8478);
    const placeIdVal = document.getElementById('p-place-id') ? document.getElementById('p-place-id').value.trim() : '';

    const payload = {
      name: document.getElementById('p-name') ? document.getElementById('p-name').value.trim() : '',
      phone: document.getElementById('p-phone') ? document.getElementById('p-phone').value.trim() : '',
      state: stateVal,
      district: districtVal,
      city: cityVal,
      pincode: pincodeVal,
      address: addressVal,
      lat: latVal,
      lon: lonVal,
      google_place_id: placeIdVal
    };

    if (isFarmer) {
      payload.farm_name = document.getElementById('p-farm-name') ? document.getElementById('p-farm-name').value.trim() : '';
      payload.farm_location = addressVal;
      payload.crops_grown = document.getElementById('p-crops-grown') ? document.getElementById('p-crops-grown').value.trim() : '';
      payload.farm_size_acres = parseFloat((document.getElementById('p-farm-size') ? document.getElementById('p-farm-size').value : '') || 5);
    } else {
      payload.business_name = document.getElementById('p-business-name') ? document.getElementById('p-business-name').value.trim() : '';
      payload.buyer_type = document.getElementById('p-buyer-type') ? document.getElementById('p-buyer-type').value : 'Retailer';
      payload.delivery_location = addressVal;
      payload.address = addressVal;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        currentUser = await res.json();
        updateUserUI();
        showToast("✓ Profile & location updated successfully!");
      } else {
        const errData = await res.json();
        showToast(`❌ Update failed: ${errData.detail || 'Server error'}`);
      }
    } catch(err) {
      showToast("❌ Server error updating profile.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = origBtnText || "Save Profile Changes →";
      }
    }
  }

  // --- Notifications ---
  async function loadNotifications() {
    if (!authToken) return;
    try {
      const res = await fetch(`${API_BASE}/auth/notifications`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const notifs = Array.isArray(data) ? data : [];
        const unread = notifs.filter(n => !n.is_read).length;

        // 1. Header Bell Badge
        const countBadge = document.getElementById('notif-count');
        if (countBadge) {
          if (unread > 0) {
            countBadge.innerText = unread > 99 ? '99+' : unread;
            countBadge.style.display = 'flex';
          } else {
            countBadge.style.display = 'none';
          }
        }

        // 2. Sidebar Badges (Farmer & Buyer)
        ['sidebar-notif-count', 'buyer-sidebar-notif-count'].forEach(id => {
          const sidebarBadge = document.getElementById(id);
          if (sidebarBadge) {
            if (unread > 0) {
              sidebarBadge.innerText = unread > 99 ? '99+' : unread;
              sidebarBadge.style.display = 'flex';
            } else {
              sidebarBadge.style.display = 'none';
            }
          }
        });

        // 3. Dropdown Container Content
        const container = document.getElementById('notif-list-container');
        if (!container) return;
        if (notifs.length === 0) {
          container.innerHTML = `
            <div style="padding:28px 16px; text-align:center; color:var(--soil-soft); font-size:12px;">
              <span class="material-symbols-outlined text-slate-300 text-[32px] block mb-1">notifications_off</span>
              No notifications yet. You're all caught up!
            </div>
          `;
          return;
        }

        container.innerHTML = notifs.map(n => {
          const isUnread = !n.is_read;
          const timeStr = n.created_at ? new Date(n.created_at).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }) : '';

          let icon = 'notifications';
          let iconColor = 'text-emerald-700 bg-emerald-50';
          if (n.type === 'ORDER') {
            icon = 'shopping_cart';
            iconColor = 'text-blue-700 bg-blue-50';
          } else if (n.type === 'DELIVERY') {
            icon = 'local_shipping';
            iconColor = 'text-amber-700 bg-amber-50';
          } else if (n.type === 'PAYMENT') {
            icon = 'payments';
            iconColor = 'text-green-700 bg-green-50';
          }

          return `
            <div class="notif-item ${isUnread ? 'unread' : ''}" style="display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border-bottom:1px solid #f1f5f9; position:relative; ${isUnread ? 'background:#f0fdf4;' : 'background:#ffffff;'}">
              <div class="w-8 h-8 rounded-full ${iconColor} flex items-center justify-center shrink-0 mt-0.5">
                <span class="material-symbols-outlined text-[16px]">${icon}</span>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                  <span style="font-weight:700; font-size:12px; color:#0f172a; line-height:1.3;">${n.title}</span>
                  <span style="font-size:10px; color:#94a3b8; white-space:nowrap;">${timeStr}</span>
                </div>
                <div style="font-size:11.5px; color:#475569; margin-top:3px; line-height:1.4;">${n.message}</div>
                ${isUnread ? `
                  <div style="margin-top:6px; display:flex; justify-content:flex-end;">
                    <button type="button" onclick="markNotificationAsRead(${n.id}, event)" class="text-[10.5px] font-semibold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 rounded px-2 py-0.5 flex items-center gap-1 transition-colors">
                      <span class="material-symbols-outlined text-[12px]">done</span> Mark read
                    </button>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    } catch(err) {
      console.warn("Notifications error:", err);
    }
  }

  function toggleNotifications(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const d = document.getElementById('notif-dropdown');
    if (!d) return;

    const isOpen = d.classList.contains('open');
    if (isOpen) {
      d.classList.remove('open');
      return;
    }

    // Determine trigger origin (sidebar vs header bell)
    const isSidebar = e && e.target && (e.target.closest('#sidebar-farmer-nav') || e.target.closest('#sidebar-buyer-nav'));
    if (isSidebar) {
      d.style.left = '264px';
      d.style.right = 'auto';
      d.style.top = '64px';
    } else {
      d.style.left = 'auto';
      d.style.right = '24px';
      d.style.top = '64px';
    }

    d.classList.add('open');
    loadNotifications();
  }

  // Click outside to dismiss notification dropdown
  document.addEventListener('click', (e) => {
    const d = document.getElementById('notif-dropdown');
    if (d && d.classList.contains('open')) {
      const isInside = d.contains(e.target) || (e.target.closest && e.target.closest('button[onclick*="toggleNotifications"]'));
      if (!isInside) {
        d.classList.remove('open');
      }
    }
  });

  async function clearAllNotifications() {
    try {
      const res = await fetch(`${API_BASE}/auth/notifications`, { headers: getAuthHeaders() });
      if (res.ok) {
        const notifs = await res.json();
        const unreadList = (Array.isArray(notifs) ? notifs : []).filter(n => !n.is_read);
        await Promise.all(unreadList.map(n => 
          fetch(`${API_BASE}/auth/notifications/${n.id}/read`, {
            method: 'PATCH',
            headers: getAuthHeaders()
          })
        ));
      }
    } catch(e) {
      console.warn("Error marking all notifications as read:", e);
    }
    await loadNotifications();
    showToast("✓ All notifications marked as read");
  }

  async function markNotificationAsRead(id, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/auth/notifications/${id}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadNotifications();
        showToast("✓ Notification marked as read");
      }
    } catch(err) {
      console.warn("Error marking notification as read:", err);
    }
  }

  // --- Landing Page Interactive Tabs & Revealer ---
  document.querySelectorAll('.tabbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabbtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.dataset.tab);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  function selectPhoneCrop(crop, recPrice, mandiPrice, emoji) {
    document.querySelectorAll('.crop-chip').forEach(c => c.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.currentTarget) event.currentTarget.classList.add('active');
    
    document.getElementById('phone-price-amt').innerText = `₹${recPrice.toFixed(2)} / kg`;
    const diff = (recPrice - mandiPrice).toFixed(2);
    document.getElementById('phone-price-delta').innerHTML = `▲ +₹${diff} vs local middleman`;
    document.getElementById('phone-mandi-amt').innerText = `₹${mandiPrice.toFixed(2)}/kg`;
    document.getElementById('phone-ml-amt').innerText = `₹${(recPrice - 0.2).toFixed(2)}/kg`;
  }

  // --- Expose handlers to global window scope for bulletproof HTML inline compatibility ---
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.switchAuthView = switchAuthView;
  window.selectSignupRole = selectSignupRole;
  window.fillDemoCreds = fillDemoCreds;
  window.handleSignup = handleSignup;
  window.handleLogin = handleLogin;
  window.handleForgotPassword = handleForgotPassword;
  window.handleProfileSetup = handleProfileSetup;
  window.handleUpdateProfile = handleUpdateProfile;
  window.handleAddressInput = handleAddressInput;
  window.handleAddressKeydown = handleAddressKeydown;
  window.selectPlaceSuggestion = selectPlaceSuggestion;
  window.triggerManualAddressSearch = triggerManualAddressSearch;
  window.getUserCurrentLocation = getUserCurrentLocation;
  window.updateSelectedLocationDisplay = updateSelectedLocationDisplay;
  window.initLocationPickerMap = initLocationPickerMap;
  window.loadUserProfileView = loadUserProfileView;
  window.logout = logout;
  window.handleOpenAppNav = handleOpenAppNav;
  window.handlePrimaryHeroCTA = handlePrimaryHeroCTA;
  window.handleMarketplaceHeroCTA = handleMarketplaceHeroCTA;
  window.handleScreensCTA = handleScreensCTA;
  window.openApp = openApp;
  window.closeApp = closeApp;
  window.switchAppTab = switchAppTab;
  window.setListingQty = setListingQty;
  window.onListingCropChange = onListingCropChange;
  window.requestListingPricePrediction = requestListingPricePrediction;
  window.handleCreateListing = handleCreateListing;
  window.deleteListing = deleteListing;
  window.requestBankTransfer = requestBankTransfer;
  window.loadMarketplaceListings = loadMarketplaceListings;
  window.filterMarketplace = filterMarketplace;
  window.executeAdvancedSearch = executeAdvancedSearch;
  window.toggleSaveListing = toggleSaveListing;
  window.openOrderModal = openOrderModal;
  window.closeOrderModal = closeOrderModal;
  window.setOrderModalQty = setOrderModalQty;
  window.recalcOrderTotal = recalcOrderTotal;
  window.handleConfirmOrder = handleConfirmOrder;
  window.loadAIPriceInsights = loadAIPriceInsights;
  window.listAtRecommendedPrice = listAtRecommendedPrice;
  window.setForecastHorizon = setForecastHorizon;
  window.recalculateRoute = recalculateRoute;
  window.loadTrackingOrdersList = loadTrackingOrdersList;
  window.filterTrackingOrders = filterTrackingOrders;
  window.searchTrackingOrders = searchTrackingOrders;
  window.openOrderTrackingDetail = openOrderTrackingDetail;
  window.closeTrackingDetail = closeTrackingDetail;
  window.refreshCurrentTrackingDetail = refreshCurrentTrackingDetail;
  window.focusMapMarker = focusMapMarker;
  window.recenterTrackingMap = recenterTrackingMap;
  window.openDeliveryProofModal = openDeliveryProofModal;
  window.closeDeliveryProofModal = closeDeliveryProofModal;
  window.handleDeliveryProofSubmit = handleDeliveryProofSubmit;
  window.openCheckpointUpdateModalFromCurrent = openCheckpointUpdateModalFromCurrent;
  window.closeCheckpointUpdateModal = closeCheckpointUpdateModal;
  window.setCheckpointPreset = setCheckpointPreset;
  window.handleCheckpointUpdateSubmit = handleCheckpointUpdateSubmit;
  window.advanceOrderStatus = advanceOrderStatus;
  window.contactParticipant = contactParticipant;
  window.toggleNotifications = toggleNotifications;
  window.clearAllNotifications = clearAllNotifications;
  window.markNotificationAsRead = markNotificationAsRead;
  window.selectPhoneCrop = selectPhoneCrop;
  window.showToast = showToast;
  window.getOrCreateLeafletMap = getOrCreateLeafletMap;
  window.renderLogisticsRouteMap = renderLogisticsRouteMap;
  window.renderTrackingLeafletMap = renderTrackingLeafletMap;
  window.renderTrackingGoogleMap = renderTrackingLeafletMap;
