// API Endpoint
  var API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
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
    if (!currentUser) return;

    const isFarmer = currentUser.role === 'FARMER_FPO';
    document.getElementById('portal-user-role-tag').innerText = isFarmer ? 'DoCA Farmer Portal' : 'DoCA Buyer Marketplace';
    document.getElementById('app-user-avatar').innerText = isFarmer ? '🧑‍🌾' : '🛒';
    document.getElementById('app-user-name').innerText = currentUser.name;
    
    const roleBadge = document.getElementById('app-user-role-badge');
    roleBadge.innerText = isFarmer ? 'FARMER / FPO' : 'BUYER / CONSUMER';
    roleBadge.className = isFarmer ? 'u-role farmer' : 'u-role buyer';

    document.getElementById('wallet-label').innerText = isFarmer ? 'Settled Earnings:' : 'Procurement Spend:';
    document.getElementById('wallet-amount').innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    // Toggle Sidebars
    document.getElementById('sidebar-farmer-nav').style.display = isFarmer ? 'block' : 'none';
    document.getElementById('sidebar-buyer-nav').style.display = isFarmer ? 'none' : 'block';

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
  }

  function switchAuthView(view) {
    document.getElementById('auth-view-login').style.display = view === 'login' ? 'block' : 'none';
    document.getElementById('auth-view-signup').style.display = view === 'signup' ? 'block' : 'none';
    document.getElementById('auth-view-forgot').style.display = view === 'forgot' ? 'block' : 'none';
    document.getElementById('auth-view-profile-setup').style.display = view === 'setup' ? 'block' : 'none';

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
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    showToast(`Filled credentials for ${email}`);
  }

  // --- Signup Flow ---
  async function handleSignup(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('signup-submit-btn');
    btn.disabled = true;
    btn.innerText = "Creating Account...";

    const payload = {
      name: document.getElementById('signup-name').value.trim(),
      email: document.getElementById('signup-email').value.trim(),
      phone: document.getElementById('signup-phone').value.trim(),
      password: document.getElementById('signup-password').value,
      confirm_password: document.getElementById('signup-confirm-password').value,
      role: document.getElementById('signup-role').value
    };

    if (payload.password !== payload.confirm_password) {
      showToast("❌ Passwords do not match!");
      btn.disabled = false;
      btn.innerText = "Create Account & Setup Profile →";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ ${data.detail || 'Signup failed'}`);
        btn.disabled = false;
        btn.innerText = "Create Account & Setup Profile →";
        return;
      }

      authToken = data.access_token;
      localStorage.setItem('kisan_auth_token', authToken);
      currentUser = data.user;
      updateUserUI();

      showToast(`✓ Account created! Please set your ${currentUser.role === 'FARMER_FPO' ? 'farm' : 'delivery'} location.`);
      prepareProfileSetupWizard();
    } catch(err) {
      showToast("❌ Server connection error.");
      btn.disabled = false;
      btn.innerText = "Create Account & Setup Profile →";
    }
  }

  // --- Login Flow ---
  async function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    btn.innerText = "Authenticating...";

    const payload = {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    };

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ ${data.detail || 'Invalid email or password'}`);
        btn.disabled = false;
        btn.innerText = "Sign In to Dashboard →";
        return;
      }

      authToken = data.access_token;
      localStorage.setItem('kisan_auth_token', authToken);
      currentUser = data.user;
      updateUserUI();

      closeAuthModal();
      showToast(`✓ Welcome back, ${currentUser.name}!`);

      // Open appropriate dashboard
      if (currentUser.role === 'FARMER_FPO') {
        openApp('farmer-dashboard');
      } else {
        openApp('buyer-dashboard');
      }
    } catch(err) {
      showToast("❌ Server error during sign in.");
      btn.disabled = false;
      btn.innerText = "Sign In to Dashboard →";
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
    btn.disabled = true;
    btn.innerText = "Saving Profile...";

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
        btn.disabled = false;
        btn.innerText = "Save Profile & Open Portal →";
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
      showToast("❌ Server error saving profile.");
      btn.disabled = false;
      btn.innerText = "Save Profile & Open Portal →";
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
    // Role guard: prevent farmer from accessing buyer views and vice versa
    if (currentUser) {
      const isFarmer = currentUser.role === 'FARMER_FPO';
      if (isFarmer && (tabId === 'buyer-dashboard' || tabId === 'marketplace' || tabId === 'buyer-search' || tabId === 'buyer-saved')) {
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
    authToken = null;
    currentUser = null;
    localStorage.removeItem('kisan_auth_token');
    closeApp();
    updateLandingNavState();
    showToast("✓ Logged out successfully.");
    openAuthModal('login');
  }

  // --- Farmer Dashboard Loader ---
  async function loadFarmerDashboard() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getAuthHeaders() });
      if (res.ok) {
        currentUser = await res.json();
        document.getElementById('f-dash-earnings').innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
        document.getElementById('wallet-amount').innerText = `₹${(currentUser.wallet_balance || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
      }

      // Load Listings count
      const listRes = await fetch(`${API_BASE}/listings?status=ACTIVE`, { headers: getAuthHeaders() });
      if (listRes.ok) {
        const rawListings = await listRes.json();
        const listings = Array.isArray(rawListings) ? rawListings : [];
        const countEl = document.getElementById('f-dash-listings-count');
        if (countEl) countEl.innerText = listings.length;
      }

      // Load Orders count
      const orderRes = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
      if (orderRes.ok) {
        const rawOrders = await orderRes.json();
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        const pending = orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
        const oCountEl = document.getElementById('f-dash-orders-count');
        if (oCountEl) oCountEl.innerText = pending;

        const tbody = document.getElementById('f-dash-recent-orders-tbody');
        if (tbody) {
          if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--soil-soft);">No orders received yet. Active listings will receive orders from buyers.</td></tr>`;
          } else {
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
      }

      // Market rate pulse
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

  function renderMarketplaceCards(items) {
    const container = document.getElementById('marketplace-cards-container');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; padding:40px; text-align:center; background:var(--paper); border-radius:14px; border:1px solid var(--line);">
          <div style="font-size:36px; margin-bottom:8px;">🌾</div>
          <h3 style="margin:0 0 6px; font-family:'Fraunces',serif;">No Produce Lots Found</h3>
          <p style="font-size:13.5px; color:var(--soil-soft); margin:0;">Try adjusting your search criteria or clear active filters.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => renderProduceCardHTML(item)).join('');
  }

  function renderProduceCardHTML(item) {
    return `
      <div class="produce-card">
        <div class="produce-card-header">
          <div class="crop-ico">${item.photo_url || '🌿'}</div>
          <button class="save-btn ${item.is_saved ? 'saved' : ''}" onclick="toggleSaveListing(${item.id})" title="Save lot">
            ${item.is_saved ? '❤️' : '🤍'}
          </button>
        </div>
        <div class="produce-card-body">
          <div class="farmer-info">
            <span>🧑‍🌾 ${item.farmer_name}</span>
            <span>·</span>
            <span>${item.district || item.state}</span>
          </div>
          <h3 class="title">${item.crop} (${item.variety})</h3>
          <div class="dist-tag">📍 ${item.distance_km || 160} km away from your location</div>
          <div style="font-size:12px; color:var(--soil-soft);">
            Available: <strong>${item.available_kg.toLocaleString()} kg</strong> (${item.quality_grade})
          </div>
          <div class="price-row">
            <div>
              <span class="asking">₹${item.asking_price.toFixed(2)}</span>
              <span style="font-size:12px; color:var(--soil-soft);"> / kg</span>
            </div>
            <div style="text-align:right;">
              <span class="market-ref">Retail ~₹${item.retail_estimated_price.toFixed(2)}</span>
              <div style="font-size:11px; font-weight:700; color:var(--olive);">Save ${item.buyer_savings_pct}%</div>
            </div>
          </div>
        </div>
        <div class="produce-card-footer">
          <button class="btn-primary" style="width:100%; justify-content:center; padding:10px;" onclick="openOrderModal(${item.id})">Place Order →</button>
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
        grid.innerHTML = saved.map(item => `
          <div class="produce-card">
            <div class="produce-card-header">
              <div class="crop-ico">${item.photo_url || '🌿'}</div>
              <button class="save-btn saved" onclick="toggleSaveListing(${item.id})">❤️</button>
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
        `).join('');
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
    btn.disabled = true;
    btn.innerText = "Placing Order in Blockchain Dispatch...";

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
        btn.disabled = false;
        btn.innerText = "Confirm Purchase & Schedule Pickup →";
        return;
      }

      closeOrderModal();
      showToast(`✓ Order #${order.order_code} placed successfully!`);
      loadMarketplaceListings();
      switchAppTab('orders');
    } catch(err) {
      showToast("❌ Server error processing order.");
      btn.disabled = false;
      btn.innerText = "Confirm Purchase & Schedule Pickup →";
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

  // --- AI Price Insights (Canvas Chart) ---
  async function loadAIPriceInsights() {
    const cropInput = document.getElementById('ai-page-crop');
    const marketInput = document.getElementById('ai-page-market');
    const crop = cropInput ? cropInput.value : 'Tomato';
    const market = marketInput ? marketInput.value : 'Nashik';

    try {
      const res = await fetch(`${API_BASE}/price-history?crop=${encodeURIComponent(crop)}&market=${encodeURIComponent(market)}`);
      if (res.ok) {
        const data = await res.json();
        if (document.getElementById('ai-kpi-mandi') && data.current_price !== undefined) document.getElementById('ai-kpi-mandi').innerText = `₹${data.current_price.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-pred') && data.predicted_price !== undefined) document.getElementById('ai-kpi-pred').innerText = `₹${data.predicted_price.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-rec') && data.recommended_price !== undefined) document.getElementById('ai-kpi-rec').innerText = `₹${data.recommended_price.toFixed(2)}/kg`;
        if (document.getElementById('ai-kpi-trend')) document.getElementById('ai-kpi-trend').innerText = `${data.price_trend || 'Stable'} Trend`;
        if (document.getElementById('ai-kpi-ci')) document.getElementById('ai-kpi-ci').innerText = `±₹1.89 / kg (95% PI)`;
        if (document.getElementById('ai-kpi-model')) document.getElementById('ai-kpi-model').innerText = `Model: ${data.model || 'RandomForestRegressor'}`;
        if (document.getElementById('ai-price-narrative')) document.getElementById('ai-price-narrative').innerHTML = `<strong>Agricultural Intelligence Brief:</strong> ${data.explanation || ''}`;

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
    
    // Set resolution
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 600, height: 260 };
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const allPrices = [...history.map(p => p.modal_price), ...forecast.map(p => p.modal_price)];
    const minP = Math.min(...allPrices) * 0.95;
    const maxP = Math.max(...allPrices) * 1.05;
    const totalPoints = history.length + forecast.length;
    const stepX = w / (totalPoints - 1);

    const getY = (price) => h - 30 - ((price - minP) / (maxP - minP)) * (h - 60);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(53,44,34,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 1. Draw Historical Modal Price Line
    ctx.beginPath();
    ctx.strokeStyle = '#4F6B44';
    ctx.lineWidth = 2.5;
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = getY(pt.modal_price);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 2. Draw 7-Day ML Forecast Line (Dashed Gold)
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#D9A441';
    ctx.lineWidth = 2.5;
    const startIdx = history.length - 1;
    ctx.moveTo(startIdx * stepX, getY(history[startIdx].modal_price));
    forecast.forEach((pt, idx) => {
      const x = (startIdx + idx + 1) * stepX;
      const y = getY(pt.modal_price);
      ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw data points
    history.forEach((pt, idx) => {
      const x = idx * stepX;
      const y = getY(pt.modal_price);
      ctx.fillStyle = '#4F6B44';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    forecast.forEach((pt, idx) => {
      const x = (startIdx + idx + 1) * stepX;
      const y = getY(pt.modal_price);
      ctx.fillStyle = '#D9A441';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
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
  function loadUserProfileView() {
    if (!currentUser) return;
    const isFarmer = currentUser.role === 'FARMER_FPO';

    document.getElementById('p-name').value = currentUser.name || '';
    document.getElementById('p-email').value = currentUser.email || '';
    document.getElementById('p-phone').value = currentUser.phone || '';
    document.getElementById('p-role-display').value = isFarmer ? 'FARMER / FPO' : 'BUYER / CONSUMER';

    document.getElementById('p-farmer-specific').style.display = isFarmer ? 'block' : 'none';
    document.getElementById('p-buyer-specific').style.display = isFarmer ? 'none' : 'block';

    const lbl = document.getElementById('p-address-lbl');
    if (lbl) lbl.innerText = isFarmer ? 'Search registered farm gate address *' : 'Search registered delivery address *';

    if (isFarmer && currentUser.farmer_profile) {
      const fp = currentUser.farmer_profile;
      document.getElementById('p-farm-name').value = fp.farm_name || '';
      document.getElementById('p-farm-size').value = fp.farm_size_acres || 5;
      document.getElementById('p-crops-grown').value = fp.crops_grown || 'Tomato, Onion';
      
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
      document.getElementById('p-business-name').value = bp.business_name || '';
      document.getElementById('p-buyer-type').value = bp.buyer_type || 'Retailer';
      
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

    setTimeout(() => initLocationPickerMap('p'), 200);
  }

  async function handleUpdateProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    const isFarmer = (currentUser && currentUser.role === 'FARMER_FPO');

    const stateVal = document.getElementById('p-state').value.trim();
    const districtVal = document.getElementById('p-district').value.trim();
    const cityVal = document.getElementById('p-city').value.trim();
    const pincodeVal = document.getElementById('p-pincode').value.trim();
    const addressVal = document.getElementById('p-address').value.trim();
    const latVal = parseFloat(document.getElementById('p-lat').value) || (isFarmer ? 20.3548 : 19.0178);
    const lonVal = parseFloat(document.getElementById('p-lon').value) || (isFarmer ? 85.8182 : 72.8478);
    const placeIdVal = document.getElementById('p-place-id').value.trim();

    const payload = {
      name: document.getElementById('p-name').value.trim(),
      phone: document.getElementById('p-phone').value.trim(),
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
      payload.farm_name = document.getElementById('p-farm-name').value.trim();
      payload.farm_location = addressVal;
      payload.crops_grown = document.getElementById('p-crops-grown').value.trim();
      payload.farm_size_acres = parseFloat(document.getElementById('p-farm-size').value || 5);
    } else {
      payload.business_name = document.getElementById('p-business-name').value.trim();
      payload.buyer_type = document.getElementById('p-buyer-type').value;
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
    }
  }

  // --- Notifications ---
  async function loadNotifications() {
    try {
      const res = await fetch(`${API_BASE}/auth/notifications`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const notifs = Array.isArray(data) ? data : [];
        const unread = notifs.filter(n => !n.is_read).length;
        const countBadge = document.getElementById('notif-count');
        if (countBadge) {
          if (unread > 0) {
            countBadge.innerText = unread;
            countBadge.style.display = 'flex';
          } else {
            countBadge.style.display = 'none';
          }
        }

        const container = document.getElementById('notif-list-container');
        if (!container) return;
        if (notifs.length === 0) {
          container.innerHTML = `<div style="padding:16px; text-align:center; color:var(--soil-soft); font-size:12px;">No new notifications</div>`;
          return;
        }

        container.innerHTML = notifs.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}">
            <div class="n-title">${n.title}</div>
            <div class="n-msg">${n.message}</div>
          </div>
        `).join('');
      }
    } catch(err) {
      console.warn("Notifications error:", err);
    }
  }

  function toggleNotifications() {
    const d = document.getElementById('notif-dropdown');
    d.classList.toggle('open');
  }

  function clearAllNotifications() {
    document.getElementById('notif-count').style.display = 'none';
    document.querySelectorAll('.notif-item').forEach(i => i.classList.remove('unread'));
    showToast("Notifications marked as read.");
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
  window.selectPhoneCrop = selectPhoneCrop;
  window.showToast = showToast;
  window.getOrCreateLeafletMap = getOrCreateLeafletMap;
  window.renderLogisticsRouteMap = renderLogisticsRouteMap;
  window.renderTrackingLeafletMap = renderTrackingLeafletMap;
  window.renderTrackingGoogleMap = renderTrackingLeafletMap;
