'use strict';

/* =====================================================================
   DriveEase – vehicles.js
   Full-featured vehicle fleet & driver interface:
   - Dynamic driver grid rendering with availability indicators
   - Real-time search and filtering (All, Cars, Bikes, Available only)
   - Synchronized vehicle statuses with VehicleStore / LocalStorage
   - Instant booking shortcuts and live reactive events
   ===================================================================== */

(() => {

    const ready = fn => document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', fn)
        : fn();

    ready(() => {
        const { VehicleStore, DriverStore, formatMoney } = window.DriveEase || {};
        if (!DriverStore) {
            console.warn('[vehicles.js] DriveEase data layer not found.');
            return;
        }

        /* ──────────────────────────────────────────────────────────
           1. Driver Grid Rendering
           ────────────────────────────────────────────────────────── */
        function renderDrivers() {
            const grid = document.getElementById('driverGrid');
            if (!grid) return;

            const drivers = DriverStore.getAll();
            if (!drivers || drivers.length === 0) {
                grid.innerHTML = '<p class="muted" style="grid-column:1/-1;text-align:center;">No drivers available currently.</p>';
                return;
            }

            grid.innerHTML = drivers.map(driver => {
                const isAvail = driver.available;
                const bookUrl = isAvail
                    ? `booking.html?driver=1&driverId=${encodeURIComponent(driver.id)}`
                    : '#';

                return `
                <div class="driver-card" data-driver-id="${driver.id}">
                    <div class="driver-avatar-lg">${driver.initials()}</div>
                    <div class="driver-card-info" style="margin-top:12px;">
                        <strong>${driver.name}</strong>
                        <small>${driver.describe()}</small>
                        <p style="font-size:0.75rem;color:var(--muted);margin:4px 0 10px;">
                            ${driver.languages || 'Hindi, English'}
                        </p>
                        <span class="driver-tag ${isAvail ? 'available' : 'booked'}" style="display:inline-block;margin-bottom:12px;">
                            ${isAvail ? '● Available for trip' : '● On a trip'}
                        </span>
                        <div>
                            ${isAvail
                                ? `<a href="${bookUrl}" class="btn btn-outline btn-small" style="font-size:0.75rem;padding:6px 14px;border-radius:20px;text-decoration:none;">Book with ${driver.name.split(' ')[0]} →</a>`
                                : `<button disabled class="btn btn-small" style="font-size:0.75rem;padding:6px 14px;border-radius:20px;opacity:0.5;cursor:not-allowed;background:#eee;">Currently on trip</button>`
                            }
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        /* ──────────────────────────────────────────────────────────
           2. Synchronize Vehicle Cards with VehicleStore Status
           ────────────────────────────────────────────────────────── */
        function syncVehicleCards() {
            const vehicles = VehicleStore.getAll();
            const cardMap = {
                'activa':     vehicles.find(v => v.id === 'activa'),
                'classic350': vehicles.find(v => v.id === 'classic350'),
                'pulsar':     vehicles.find(v => v.id === 'pulsar'),
                'creta':      vehicles.find(v => v.id === 'creta'),
                'nexon':      vehicles.find(v => v.id === 'nexon'),
                'swift':      vehicles.find(v => v.id === 'swift')
            };

            const cards = document.querySelectorAll('.vehicle-card');
            cards.forEach(card => {
                // Determine vehicle ID from details link or title
                let vid = null;
                const link = card.querySelector('a[href*="vehicle-"]');
                if (link) {
                    const match = link.getAttribute('href').match(/vehicle-([^.]+)\.html/);
                    if (match) vid = match[1];
                }
                if (!vid) {
                    const titleText = (card.querySelector('h3')?.textContent || '').toLowerCase();
                    if (titleText.includes('activa')) vid = 'activa';
                    else if (titleText.includes('classic')) vid = 'classic350';
                    else if (titleText.includes('pulsar')) vid = 'pulsar';
                    else if (titleText.includes('creta')) vid = 'creta';
                    else if (titleText.includes('nexon')) vid = 'nexon';
                    else if (titleText.includes('swift')) vid = 'swift';
                }

                if (!vid || !cardMap[vid]) return;
                const v = cardMap[vid];

                // Attach metadata attributes to DOM element for filtering
                card.dataset.vehicleId = v.id;
                card.dataset.type = v.type;
                card.dataset.status = v.status;
                card.dataset.name = v.name;
                card.dataset.fuel = v.fuel;
                card.dataset.transmission = v.transmission;
                card.dataset.category = v.category;
                card.dataset.rate = v.rate;

                // Sync status badge element
                const statusBadge = card.querySelector('.status, .unavailable');
                if (statusBadge) {
                    statusBadge.className = `status ${v.status}`;
                    statusBadge.textContent = v.statusLabel;
                }

                // Sync action button / link
                const bottom = card.querySelector('.vehicle-bottom');
                if (bottom) {
                    let actionWrap = bottom.querySelector('.card-actions');
                    if (!actionWrap) {
                        const oldTarget = bottom.querySelector('.details-link, .unavailable');
                        if (oldTarget) {
                            actionWrap = document.createElement('div');
                            actionWrap.className = 'card-actions';
                            actionWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
                            oldTarget.parentNode.insertBefore(actionWrap, oldTarget);
                            actionWrap.appendChild(oldTarget);
                        }
                    }

                    if (actionWrap) {
                        // Remove any stray buttons outside actionWrap
                        [...bottom.children].forEach(child => {
                            if (child !== actionWrap && !child.classList.contains('vehicle-price')) {
                                child.remove();
                            }
                        });

                        if (v.status === 'available') {
                            actionWrap.innerHTML = `
                                <a href="vehicle-${v.id}.html" class="details-link" style="color:var(--muted);font-weight:600;font-size:0.8rem;">Details</a>
                                <a href="booking.html?vehicle=${v.id}" class="btn btn-primary btn-small btn-book" style="padding:4px 12px;font-size:0.75rem;min-height:30px;border-radius:7px;text-decoration:none;">Book →</a>
                            `;
                        } else if (v.status === 'booked') {
                            actionWrap.innerHTML = `
                                <a href="vehicle-${v.id}.html" class="details-link" style="color:var(--muted);font-weight:600;font-size:0.8rem;">Details</a>
                                <span class="status booked" style="font-size:0.72rem;padding:3px 8px;">Booked</span>
                            `;
                        } else {
                            actionWrap.innerHTML = `<span class="unavailable">Unavailable</span>`;
                        }
                    }
                }
            });
        }

        /* ──────────────────────────────────────────────────────────
           3. Live Search & Category Filtering
           ────────────────────────────────────────────────────────── */
        let activeFilter = 'all';
        let searchQuery = '';

        function setupFilterBar() {
            // Find existing filter bar or create one if missing
            let bar = document.getElementById('vehicleFilterBar');
            if (!bar) {
                const introSection = document.querySelector('main .section:first-child .container');
                if (!introSection) return;

                bar = document.createElement('div');
                bar.id = 'vehicleFilterBar';
                bar.className = 'filter-bar';
                bar.innerHTML = `
                    <div class="search-box">
                        <span aria-hidden="true">🔍</span>
                        <input type="text" id="vehicleSearchInput"
                               placeholder="Search by name, fuel, transmission..."
                               aria-label="Search vehicles"
                               style="border:none;background:transparent;outline:none;width:100%;font-size:0.85rem;color:inherit;">
                    </div>
                    <button type="button" class="filter active" data-filter="all">All Vehicles</button>
                    <button type="button" class="filter" data-filter="four-wheeler">Cars &amp; SUVs</button>
                    <button type="button" class="filter" data-filter="two-wheeler">Bikes &amp; Scooters</button>
                    <button type="button" class="filter" data-filter="available">Available Only</button>
                    <div id="filterCount" style="margin-left:auto;font-size:0.8rem;color:var(--muted);font-weight:600;"></div>
                `;
                introSection.appendChild(bar);
            }

            const searchInput = bar.querySelector('#vehicleSearchInput');
            const filterBtns = bar.querySelectorAll('.filter');
            const countLabel = bar.querySelector('#filterCount');

            function applyFilters() {
                const query = searchQuery.toLowerCase().trim();
                const cards = document.querySelectorAll('.vehicle-card');
                let visibleCount = 0;

                cards.forEach(card => {
                    const type = card.dataset.type || '';
                    const status = card.dataset.status || '';
                    const name = (card.dataset.name || card.querySelector('h3')?.textContent || '').toLowerCase();
                    const text = card.textContent.toLowerCase();

                    // 1. Type / Status category check
                    let categoryMatch = false;
                    if (activeFilter === 'all') categoryMatch = true;
                    else if (activeFilter === 'four-wheeler') categoryMatch = (type === 'four-wheeler');
                    else if (activeFilter === 'two-wheeler') categoryMatch = (type === 'two-wheeler');
                    else if (activeFilter === 'available') categoryMatch = (status === 'available');

                    // 2. Search query check
                    let queryMatch = true;
                    if (query) {
                        queryMatch = name.includes(query) || text.includes(query);
                    }

                    const isVisible = categoryMatch && queryMatch;
                    card.style.display = isVisible ? '' : 'none';
                    if (isVisible) visibleCount++;
                });

                // Update section visibility (hide entire two-wheeler / four-wheeler section if no cards visible)
                const sections = document.querySelectorAll('main section.section:not(:first-child):not(.soft:last-of-type)');
                sections.forEach(sec => {
                    const grid = sec.querySelector('.vehicle-grid');
                    if (grid) {
                        const anyVisible = [...grid.querySelectorAll('.vehicle-card')].some(c => c.style.display !== 'none');
                        sec.style.display = anyVisible ? '' : 'none';
                    }
                });

                // Empty state message
                let emptyMsg = document.getElementById('vehicleEmptyMessage');
                if (visibleCount === 0) {
                    if (!emptyMsg) {
                        emptyMsg = document.createElement('div');
                        emptyMsg.id = 'vehicleEmptyMessage';
                        emptyMsg.className = 'container';
                        emptyMsg.style.cssText = 'padding:40px 20px;text-align:center;background:#fff;border-radius:16px;border:1px dashed var(--line);margin:20px auto;max-width:600px;';
                        emptyMsg.innerHTML = `
                            <div style="font-size:2.5rem;margin-bottom:12px;">🚗🔍</div>
                            <h3 style="margin-bottom:6px;">No vehicles match your criteria</h3>
                            <p class="muted" style="margin-bottom:16px;">Try adjusting your search terms or selecting "All Vehicles".</p>
                            <button class="btn btn-outline btn-small" id="btnResetFilters">Reset Filters</button>
                        `;
                        const main = document.querySelector('main');
                        main.insertBefore(emptyMsg, main.children[1] || null);

                        emptyMsg.querySelector('#btnResetFilters').addEventListener('click', () => {
                            activeFilter = 'all';
                            searchQuery = '';
                            if (searchInput) searchInput.value = '';
                            filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
                            applyFilters();
                        });
                    }
                    emptyMsg.style.display = 'block';
                } else if (emptyMsg) {
                    emptyMsg.style.display = 'none';
                }

                if (countLabel) {
                    countLabel.textContent = `${visibleCount} vehicle${visibleCount === 1 ? '' : 's'}`;
                }
            }

            // Bind filter buttons
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    activeFilter = btn.dataset.filter;
                    applyFilters();
                });
            });

            // Bind search input with micro-debounce
            let debounceTimer = null;
            if (searchInput) {
                searchInput.addEventListener('input', e => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        searchQuery = e.target.value;
                        applyFilters();
                    }, 120);
                });
            }

            // Initial filter run
            applyFilters();
        }

        /* ──────────────────────────────────────────────────────────
           4. Initialization & Cross-Tab Reactivity
           ────────────────────────────────────────────────────────── */
        renderDrivers();
        syncVehicleCards();
        setupFilterBar();

        // Listen for internal store events
        window.addEventListener('driveease:drivers-updated', renderDrivers);
        window.addEventListener('driveease:vehicles-updated', () => {
            syncVehicleCards();
            const searchInput = document.getElementById('vehicleSearchInput');
            if (searchInput) searchInput.dispatchEvent(new Event('input'));
        });

        // Listen for cross-tab updates (e.g. status changed in Admin tab)
        window.addEventListener('storage', e => {
            if (e.key === 'driveease_drivers') renderDrivers();
            if (e.key === 'driveease_vehicles') syncVehicleCards();
        });
    });

})();
