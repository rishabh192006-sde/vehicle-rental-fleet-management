'use strict';

/* =====================================================================
   DriveEase – fleet-admin.js
   Full-featured Fleet & Business Management Dashboard:
   - Live real-time data sync with DriveEase persistent data layer
   - Interactive vehicle status updates (Available / Booked / Maintenance)
   - Comprehensive booking management (status lifecycle & deletion)
   - Dynamic customer lifetime value & booking summary analytics
   - Real-time revenue analytics & interactive bar chart visualization
   - Driver management (toggle availability, add, delete, search)
   - Customer message center (read, unread, filter, delete)
   - Reactive cross-tab and cross-page live updates
   ===================================================================== */

(() => {

    const { formatMoney, formatDate, VehicleStore, DriverStore, UserStore, AdminStore, BookingStore, MessageStore } = window.DriveEase || {};

    if (!VehicleStore || !BookingStore) {
        console.warn('[fleet-admin.js] DriveEase data layer not found.');
        return;
    }

    /* ── Strict Admin Authentication Guard ── */
    const currentAdmin = AdminStore ? AdminStore.getCurrentAdmin() : null;
    let adminEmail = currentAdmin ? currentAdmin.email : null;

    if (!adminEmail) {
        try {
            const raw = localStorage.getItem('driveease_admin_session');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.email && AdminStore?.isAdmin(parsed.email)) {
                    adminEmail = parsed.email;
                }
            }
        } catch (e) {}
    }

    // Block anyone who is not an authenticated Admin (e.g. Customers or unauthenticated visitors)
    if (!adminEmail || !AdminStore?.isAdmin(adminEmail)) {
        console.warn('[fleet-admin] Unauthorized access attempt blocked. Redirecting to admin login.');
        if (AdminStore) AdminStore.logout();
        else {
            localStorage.removeItem('driveease_admin_session');
            localStorage.removeItem('driveease_admin_email');
        }
        window.location.replace('login.html?role=admin&unauthorized=1');
        return;
    }

    /* ── Helper Formatters ── */
    const fmt = n => formatMoney(n);
    const fmtDate = iso => formatDate(iso);

    function statusBadge(s) {
        const map = {
            available:   '<span class="badge" style="background:#eaf8f0;color:#157a4a;font-weight:600;">Available</span>',
            booked:      '<span class="badge" style="background:#edf3ff;color:#2759a5;font-weight:600;">Booked</span>',
            maintenance: '<span class="badge" style="background:#fff5d8;color:#9b6500;font-weight:600;">Maintenance</span>'
        };
        return map[s] || `<span class="badge" style="background:#f0f0f0;color:#555;">${s}</span>`;
    }

    function bookingBadge(s) {
        const map = {
            confirmed: '<span class="badge" style="background:#eaf8f0;color:#157a4a;font-weight:600;">Confirmed</span>',
            active:    '<span class="badge" style="background:#edf3ff;color:#2759a5;font-weight:600;">Active</span>',
            pending:   '<span class="badge" style="background:#fff5d8;color:#9b6500;font-weight:600;">Pending</span>',
            completed: '<span class="badge" style="background:#f3e8ff;color:#6b21a8;font-weight:600;">Completed</span>',
            cancelled: '<span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:600;">Cancelled</span>',
            rejected:  '<span class="badge" style="background:#fee2e2;color:#991b1b;font-weight:600;">Rejected</span>'
        };
        return map[s] || `<span class="badge" style="background:#f0f0f0;color:#555;">${s}</span>`;
    }

    /* ── Admin Identity & Sign Out ── */
    const adminProfile = AdminStore ? AdminStore.getByEmail(adminEmail) : null;
    const adminName  = adminProfile?.name || adminEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const elAdminName   = document.getElementById('adminNameDisplay');
    const elAdminEmail  = document.getElementById('adminEmailDisplay');
    const elAdminAvatar = document.getElementById('adminAvatarDisplay');
    const elAdminSignOut= document.getElementById('adminSignOut');

    if (elAdminName)   elAdminName.textContent   = adminName;
    if (elAdminEmail)  elAdminEmail.textContent  = adminEmail;
    if (elAdminAvatar) elAdminAvatar.textContent = adminName.charAt(0).toUpperCase();

    if (elAdminSignOut) {
        elAdminSignOut.addEventListener('click', e => {
            e.preventDefault();
            if (AdminStore) AdminStore.logout();
            else {
                localStorage.removeItem('driveease_admin_session');
                localStorage.removeItem('driveease_admin_email');
            }
            window.location.href = 'login.html?role=admin';
        });
    }

    /* ── State & Sorting ── */
    let vehicles = [];
    let bookings = [];
    let users    = {};
    let messages = [];
    let drivers  = [];

    let fleetSort  = { field: 'name', dir: 1 };
    let bookSort   = { field: 'date', dir: -1 };
    let custSort   = { field: 'name', dir: 1 };
    let driverSort = { field: 'name', dir: 1 };

    /* ── Refresh All Data from Stores ── */
    function refreshData() {
        vehicles = VehicleStore.getAll();
        bookings = BookingStore.getAll();
        users    = UserStore.getAll();
        messages = MessageStore.getAll();
        drivers  = DriverStore.getAll();

        const totalRevenue = bookings
            .filter(b => b.status !== 'cancelled' && b.status !== 'rejected')
            .reduce((s, b) => {
                if (b.finalPaid) return s + Number(b.total || 0);
                if (b.advancePaid) return s + Number(b.advanceAmount || Math.round((b.total || 0) * 0.5));
                return s;
            }, 0);

        // Update Top Hero Stats
        const statVehicles  = document.getElementById('statVehicles');
        const statAvailable = document.getElementById('statAvailable');
        const statBooked    = document.getElementById('statBooked');
        const statBookings  = document.getElementById('statBookings');
        const statRevenue   = document.getElementById('statRevenue');
        const statCustomers = document.getElementById('statCustomers');
        const statMessages  = document.getElementById('statMessages');

        if (statVehicles)  statVehicles.textContent  = vehicles.length;
        if (statAvailable) statAvailable.textContent = vehicles.filter(v => v.status === 'available').length;
        if (statBooked)    statBooked.textContent    = vehicles.filter(v => v.status === 'booked').length;
        if (statBookings)  statBookings.textContent  = bookings.length;
        if (statRevenue)   statRevenue.textContent   = fmt(totalRevenue);
        if (statCustomers) statCustomers.textContent = Object.keys(users).length;
        if (statMessages)  statMessages.textContent  = messages.filter(m => !m.read).length;

        // Render each tab
        renderFleet();
        renderBookings();
        renderCustomers();
        renderRevenue();
        renderDrivers();
        renderMessages();
    }

    /* ════════════════════════════════════════════
       TAB NAVIGATION
    ════════════════════════════════════════════ */
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const targetPanel = document.getElementById('tab-' + btn.dataset.tab);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });

    /* ════════════════════════════════════════════
       1. FLEET TAB
    ════════════════════════════════════════════ */
    function renderFleet() {
        const q  = (document.getElementById('fleetSearch')?.value || '').toLowerCase().trim();
        const st = document.getElementById('fleetStatus')?.value || '';

        let data = vehicles.filter(v => {
            const matchesQ = v.name.toLowerCase().includes(q) ||
                             v.type.toLowerCase().includes(q) ||
                             v.category.toLowerCase().includes(q) ||
                             v.fuel.toLowerCase().includes(q);
            const matchesSt = !st || v.status === st;
            return matchesQ && matchesSt;
        });

        data.sort((a, b) => {
            let va = a[fleetSort.field];
            let vb = b[fleetSort.field];
            if (typeof va === 'string') {
                va = va.toLowerCase();
                vb = (vb || '').toLowerCase();
                return va < vb ? -fleetSort.dir : va > vb ? fleetSort.dir : 0;
            }
            return (Number(va) - Number(vb)) * fleetSort.dir;
        });

        const tbody = document.getElementById('fleetBody');
        if (!tbody) return;

        tbody.innerHTML = data.length ? data.map(v => {
            const typeIcon = v.type === 'two-wheeler' ? '🏍️ Two-wheeler' : '🚗 Four-wheeler';
            return `
            <tr>
                <td>
                    <strong>${v.name}</strong>
                    <div style="font-size:0.75rem;color:var(--muted);">${v.color} • ${v.transmission} • ${v.fuel}</div>
                </td>
                <td>${typeIcon}</td>
                <td><strong>${fmt(v.rate)}</strong>/day</td>
                <td>
                    <select class="fleet-status-select" data-vehicle-id="${v.id}">
                        <option value="available" ${v.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="booked" ${v.status === 'booked' ? 'selected' : ''}>Booked</option>
                        <option value="maintenance" ${v.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                    </select>
                </td>
                <td>
                    <a href="vehicle-${v.id}.html" style="font-size:0.8rem;font-weight:700;color:var(--ink);text-decoration:none;">
                        Details &rarr;
                    </a>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="5" class="empty-msg">No vehicles found matching search.</td></tr>';
    }

    // Interactive Vehicle Status Change
    document.getElementById('fleetBody')?.addEventListener('change', e => {
        const sel = e.target.closest('.fleet-status-select');
        if (!sel) return;
        const vid = sel.dataset.vehicleId;
        const newStatus = sel.value;
        VehicleStore.updateStatus(vid, newStatus);
        refreshData();
    });

    document.getElementById('fleetSearch')?.addEventListener('input', renderFleet);
    document.getElementById('fleetStatus')?.addEventListener('change', renderFleet);

    document.querySelectorAll('#tab-fleet .fleet-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (fleetSort.field === field) fleetSort.dir *= -1;
            else { fleetSort.field = field; fleetSort.dir = 1; }
            renderFleet();
        });
    });

    /* ════════════════════════════════════════════
       2. BOOKINGS TAB
    ════════════════════════════════════════════ */
    function renderBookings() {
        const q  = (document.getElementById('bookSearch')?.value || '').toLowerCase().trim();
        const sf = document.getElementById('bookSortField')?.value || 'date';
        const sd = (document.getElementById('bookSortDir')?.value || 'desc') === 'asc' ? 1 : -1;
        bookSort = { field: sf, dir: sd };

        let data = bookings.filter(b => {
            return (b.customer || '').toLowerCase().includes(q) ||
                   (b.vehicleName || '').toLowerCase().includes(q) ||
                   (b.email || '').toLowerCase().includes(q) ||
                   (b.phone || '').includes(q);
        });

        data.sort((a, b) => {
            let va = a[bookSort.field] || '';
            let vb = b[bookSort.field] || '';
            if (typeof va === 'string') {
                va = va.toLowerCase();
                vb = ('' + vb).toLowerCase();
                return va < vb ? -bookSort.dir : va > vb ? bookSort.dir : 0;
            }
            return (Number(va) - Number(vb)) * bookSort.dir;
        });

        const tbody = document.getElementById('bookBody');
        if (!tbody) return;

        tbody.innerHTML = data.length ? data.map(b => {
            const driverInfo = b.driverName ? `<br><small style="color:var(--muted);">Driver: ${b.driverName}</small>` : '';
            const advAmt = Number(b.advanceAmount) || Math.round(Number(b.total || 0) * 0.5);
            const balAmt = Number(b.remainingAmount) || (Number(b.total || 0) - advAmt);

            // Payment summary badge & split details
            let paymentBadgeHtml = '';
            if (b.paymentStatus === 'refunded') {
                paymentBadgeHtml = '<span class="badge" style="background:#fee2e2;color:#991b1b;font-size:0.68rem;padding:2px 6px;">Refunded</span>';
            } else if (b.finalPaid || b.paymentStatus === 'paid') {
                paymentBadgeHtml = `<span class="badge" style="background:#eaf8f0;color:#15803d;font-size:0.68rem;padding:2px 6px;">✓ Paid in Full (100%)</span>`;
            } else if (b.advancePaid || b.paymentStatus === 'partial') {
                paymentBadgeHtml = `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.68rem;padding:2px 6px;">💳 50% Advance Paid</span>`;
            } else {
                paymentBadgeHtml = `<span class="badge" style="background:#fff7ed;color:#c2410c;font-size:0.68rem;padding:2px 6px;">⏳ Unpaid (Due on Approval)</span>`;
            }

            return `
            <tr>
                <td>
                    <strong>${b.customer}</strong>
                    <div style="font-size:0.75rem;color:var(--muted);">${b.email || '—'} • ${b.phone || ''}</div>
                </td>
                <td>
                    <strong>${b.vehicleName}</strong>
                    ${driverInfo}
                </td>
                <td>${fmtDate(b.date)}</td>
                <td>${b.hours} day${b.hours > 1 ? 's' : ''}</td>
                <td>
                    <strong>${fmt(b.total)}</strong>
                    <div style="font-size:0.75rem;margin-top:3px;">
                        ${paymentBadgeHtml}
                    </div>
                    <div style="font-size:0.7rem;color:var(--muted);margin-top:3px;line-height:1.4;">
                        Adv (50%): <strong>${fmt(advAmt)}</strong> (${b.advancePaid ? '<span style="color:#15803d;">✓ Paid</span>' : '<span style="color:#c2410c;">Unpaid</span>'})<br>
                        Bal (50%): <strong>${fmt(balAmt)}</strong> (${b.finalPaid ? '<span style="color:#15803d;">✓ Paid</span>' : 'Due on return'})
                    </div>
                    <div style="font-size:0.68rem;color:var(--muted);font-family:'Space Grotesk',monospace;margin-top:2px;">${b.transactionId || ('TXN-DE-' + String(b.id).slice(-6))}</div>
                </td>
                <td>
                    <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
                        ${b.status === 'pending' ? `
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            <button class="btn btn-small" data-booking-approve="${b.id}"
                                    title="Confirm booking (allows customer to pay 50% advance)"
                                    style="background:#15803d;color:#fff;padding:5px 9px;font-size:0.75rem;border-radius:5px;font-weight:600;cursor:pointer;white-space:nowrap;border:none;">
                                ✓ Confirm Booking
                            </button>
                            <button class="btn btn-small" data-booking-reject="${b.id}"
                                    title="Reject booking request"
                                    style="background:#dc2626;color:#fff;padding:5px 9px;font-size:0.75rem;border-radius:5px;font-weight:600;cursor:pointer;white-space:nowrap;border:none;">
                                ✕ Reject
                            </button>
                        </div>` : ''}

                        ${(b.status === 'confirmed' && !b.advancePaid) ? `
                        <span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.75rem;padding:3px 8px;font-weight:600;">
                            ✓ Confirmed (Awaiting 50% Advance: ${fmt(advAmt)})
                        </span>` : ''}

                        ${b.status === 'active' ? `
                        <span class="badge" style="background:#dbeafe;color:#1d4ed8;font-size:0.75rem;padding:3px 8px;font-weight:600;">
                            ● Active Rental (Vehicle Out)
                        </span>
                        <button class="btn btn-small" data-booking-return="${b.id}"
                                title="Customer returned vehicle. Collect remaining 50% balance and mark completed"
                                style="background:#4338ca;color:#fff;padding:5px 9px;font-size:0.75rem;border-radius:5px;font-weight:600;cursor:pointer;white-space:nowrap;border:none;">
                            🏁 Return & Collect Balance (${fmt(balAmt)})
                        </button>` : ''}

                        ${b.status === 'completed' ? `
                        <span class="badge" style="background:#f3e8ff;color:#6b21a8;font-size:0.75rem;padding:3px 8px;font-weight:600;">
                            ✓ Completed & Returned
                        </span>` : ''}

                        ${b.paymentStatus === 'paid' && (b.status === 'cancelled' || b.status === 'rejected') ? `
                        <button class="btn btn-small" data-booking-refund="${b.id}"
                                title="Refund customer payment"
                                style="background:#f59e0b;color:#fff;padding:4px 8px;font-size:0.75rem;border-radius:5px;font-weight:600;cursor:pointer;white-space:nowrap;border:none;">
                            Refund
                        </button>` : ''}

                        <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
                            <select class="booking-status-select" data-booking-id="${b.id}">
                                <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="active" ${b.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completed</option>
                                <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                <option value="rejected" ${b.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                            <button class="btn-danger btn-small" data-booking-delete="${b.id}"
                                    title="Delete booking"
                                    style="padding:4px 8px;font-size:0.75rem;border-radius:4px;cursor:pointer;">
                                ✕
                            </button>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" class="empty-msg">No bookings found.</td></tr>';
    }

    // Interactive Booking Status Update, Approval & Deletion
    const bookBodyEl = document.getElementById('bookBody');
    if (bookBodyEl) {
        bookBodyEl.addEventListener('change', e => {
            const sel = e.target.closest('.booking-status-select');
            if (!sel) return;
            const bid = sel.dataset.bookingId;
            const newStatus = sel.value;
            BookingStore.updateStatus(bid, newStatus);
            refreshData();
        });

        bookBodyEl.addEventListener('click', e => {
            // One-click approval for pending bookings
            const approveBtn = e.target.closest('[data-booking-approve]');
            if (approveBtn) {
                const bid = approveBtn.dataset.bookingApprove;
                BookingStore.updateStatus(bid, 'confirmed');
                refreshData();
                return;
            }

            // One-click rejection for pending bookings
            const rejectBtn = e.target.closest('[data-booking-reject]');
            if (rejectBtn) {
                const bid = rejectBtn.dataset.bookingReject;
                if (confirm('Are you sure you want to reject this booking request?')) {
                    BookingStore.updateStatus(bid, 'rejected');
                    refreshData();
                }
                return;
            }

            // One-click return and balance collection
            const returnBtn = e.target.closest('[data-booking-return]');
            if (returnBtn) {
                const bid = returnBtn.dataset.bookingReturn;
                const b = BookingStore.getById(bid);
                const balAmt = b ? (b.remainingAmount || Math.round((b.total || 0) * 0.5)) : 0;
                if (confirm(`Confirm vehicle return and collect remaining balance of ${fmt(balAmt)} for booking #${bid}?`)) {
                    BookingStore.payBalance(bid, { paymentMethod: 'Counter / Cash' });
                    refreshData();
                }
                return;
            }

            // Process refund for cancelled/rejected bookings
            const refundBtn = e.target.closest('[data-booking-refund]');
            if (refundBtn) {
                const bid = refundBtn.dataset.bookingRefund;
                if (confirm('Process full refund for this booking? The status will be updated to Refunded.')) {
                    BookingStore.processRefund(bid);
                    refreshData();
                }
                return;
            }

            const delBtn = e.target.closest('[data-booking-delete]');
            if (!delBtn) return;
            const bid = delBtn.dataset.bookingDelete;
            if (confirm('Are you sure you want to delete this booking record?')) {
                BookingStore.delete(bid);
                refreshData();
            }
        });
    }

    document.getElementById('bookSearch')?.addEventListener('input', renderBookings);
    document.getElementById('bookSortField')?.addEventListener('change', renderBookings);
    document.getElementById('bookSortDir')?.addEventListener('change', renderBookings);

    document.querySelectorAll('#tab-bookings .fleet-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (bookSort.field === field) bookSort.dir *= -1;
            else { bookSort.field = field; bookSort.dir = -1; }
            const sortFieldEl = document.getElementById('bookSortField');
            if (sortFieldEl) sortFieldEl.value = field;
            renderBookings();
        });
    });

    /* ════════════════════════════════════════════
       3. CUSTOMERS TAB
    ════════════════════════════════════════════ */
    function renderCustomers() {
        const q  = (document.getElementById('custSearch')?.value || '').toLowerCase().trim();
        const sf = document.getElementById('custSortSel')?.value || 'name';
        custSort.field = sf;

        // Build per-email booking summary
        const summary = {};
        bookings.forEach(b => {
            const key = (b.email || b.customer || '').toLowerCase().trim();
            if (!key) return;
            if (!summary[key]) summary[key] = { bookings: 0, spent: 0 };
            if (b.status !== 'cancelled' && b.status !== 'rejected') {
                summary[key].spent += Number(b.total || 0);
            }
            summary[key].bookings++;
        });

        let rows = Object.keys(users).map(email => {
            const u = users[email];
            const s = summary[email] || summary[((u.firstName || '') + ' ' + (u.lastName || '')).toLowerCase().trim()] || { bookings: 0, spent: 0 };
            return {
                name: [u.firstName, u.lastName].filter(Boolean).join(' ') || email,
                email: email,
                phone: u.phone || '—',
                bookings: s.bookings,
                spent: s.spent,
                createdAt: u.createdAt
            };
        });

        // Also include any guest customer who made bookings but isn't explicitly registered
        Object.keys(summary).forEach(guestKey => {
            if (!rows.some(r => r.email === guestKey || r.name.toLowerCase() === guestKey)) {
                rows.push({
                    name: guestKey.includes('@') ? guestKey.split('@')[0] : guestKey,
                    email: guestKey.includes('@') ? guestKey : '—',
                    phone: '—',
                    bookings: summary[guestKey].bookings,
                    spent: summary[guestKey].spent,
                    createdAt: null
                });
            }
        });

        rows = rows.filter(r => {
            return r.name.toLowerCase().includes(q) ||
                   r.email.toLowerCase().includes(q) ||
                   r.phone.includes(q);
        });

        rows.sort((a, b) => {
            if (custSort.field === 'bookings') return (b.bookings - a.bookings) * custSort.dir;
            if (custSort.field === 'spent')    return (b.spent - a.spent) * custSort.dir;
            return a.name.toLowerCase() < b.name.toLowerCase() ? -custSort.dir : custSort.dir;
        });

        const tbody = document.getElementById('custBody');
        if (!tbody) return;

        tbody.innerHTML = rows.length ? rows.map(r => {
            const since = r.createdAt ? fmtDate(r.createdAt) : 'Recent';
            return `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.email}</td>
                <td>${r.phone}</td>
                <td><span class="badge" style="background:#f0f4ff;color:#2563eb;">${r.bookings} booking${r.bookings === 1 ? '' : 's'}</span></td>
                <td><strong>${fmt(r.spent)}</strong></td>
                <td>${since}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" class="empty-msg">No customers found.</td></tr>';
    }

    document.getElementById('custSearch')?.addEventListener('input', renderCustomers);
    document.getElementById('custSortSel')?.addEventListener('change', renderCustomers);

    /* ════════════════════════════════════════════
       4. REVENUE TAB
    ════════════════════════════════════════════ */
    function renderRevenue() {
        const perV = {};
        vehicles.forEach(v => {
            perV[v.id] = { id: v.id, name: v.name, bookings: 0, days: 0, revenue: 0 };
        });

        const nonCancelled = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected');
        const totalRevenue = nonCancelled.reduce((s, b) => s + Number(b.total || 0), 0);

        nonCancelled.forEach(b => {
            if (!perV[b.vehicleId]) {
                perV[b.vehicleId] = { id: b.vehicleId, name: b.vehicleName || b.vehicleId, bookings: 0, days: 0, revenue: 0 };
            }
            perV[b.vehicleId].bookings++;
            perV[b.vehicleId].days    += Number(b.hours || 0);
            perV[b.vehicleId].revenue += Number(b.total || 0);
        });

        const rows = Object.values(perV);
        rows.sort((a, b) => b.revenue - a.revenue);

        let maxRev = 1;
        rows.forEach(r => { if (r.revenue > maxRev) maxRev = r.revenue; });

        const topVehicle = rows.length && rows[0].revenue > 0 ? rows[0].name : '—';
        const avgVal = nonCancelled.length ? Math.round(totalRevenue / nonCancelled.length) : 0;

        const revTotalEl = document.getElementById('revTotal');
        const revAvgEl = document.getElementById('revAvg');
        const revTopEl = document.getElementById('revTopVehicle');
        const chartEl  = document.getElementById('revenueChart');
        const tbodyEl  = document.getElementById('revBody');

        if (revTotalEl) revTotalEl.textContent = fmt(totalRevenue);
        if (revAvgEl)   revAvgEl.textContent   = fmt(avgVal);
        if (revTopEl)   revTopEl.textContent   = topVehicle;

        // Payment Gateway Breakdown
        let upiCount = 0, cardCount = 0, netCount = 0;
        nonCancelled.forEach(b => {
            const m = (b.paymentMethod || '').toLowerCase();
            if (m.includes('upi')) upiCount++;
            else if (m.includes('card') || m.includes('visa') || m.includes('mastercard') || m.includes('rupay')) cardCount++;
            else if (m.includes('net') || m.includes('bank')) netCount++;
            else upiCount++;
        });
        const revGatewayEl = document.getElementById('revGatewayStats');
        if (revGatewayEl) {
            revGatewayEl.innerHTML = `<span style="color:#10b981;font-weight:700;">UPI (${upiCount})</span> &bull; <span style="color:#3b82f6;font-weight:700;">Card (${cardCount})</span> &bull; <span style="color:#8b5cf6;font-weight:700;">Net (${netCount})</span>`;
        }

        // Interactive Bar Chart
        if (chartEl) {
            chartEl.innerHTML = rows.map((r, i) => {
                const h = Math.max(8, Math.round((r.revenue / maxRev) * 170));
                const cls = i === 0 && r.revenue > 0 ? ' chart-highlight' : '';
                return `
                <div class="bar-group" title="${r.name}: ${fmt(r.revenue)} (${r.bookings} bookings)">
                    <div class="bar-val">${r.revenue ? fmt(r.revenue) : ''}</div>
                    <div class="bar${cls}" style="height:${h}px;transition:height 0.4s ease;"></div>
                    <div class="bar-label">${r.name.split(' ')[0]}</div>
                </div>`;
            }).join('');
        }

        // Breakdown Table
        if (tbodyEl) {
            tbodyEl.innerHTML = rows.length ? rows.map((r, i) => {
                const trophy = i === 0 && r.revenue > 0 ? ' 🏆' : '';
                return `
                <tr>
                    <td><strong>${r.name}</strong>${trophy}</td>
                    <td>${r.bookings}</td>
                    <td>${r.days} day${r.days === 1 ? '' : 's'}</td>
                    <td><strong>${fmt(r.revenue)}</strong></td>
                </tr>`;
            }).join('') : '<tr><td colspan="4" class="empty-msg">No booking data recorded yet.</td></tr>';
        }
    }

    /* ════════════════════════════════════════════
       5. DRIVERS TAB
    ════════════════════════════════════════════ */
    function renderDrivers() {
        const q = (document.getElementById('driverSearch')?.value || '').toLowerCase().trim();
        const currentDrivers = DriverStore.getAll();

        let data = currentDrivers.filter(d => {
            return d.name.toLowerCase().includes(q) ||
                   (d.languages || '').toLowerCase().includes(q);
        });

        data.sort((a, b) => {
            let va = a[driverSort.field] || '';
            let vb = b[driverSort.field] || '';
            if (typeof va === 'number') return (va - vb) * driverSort.dir;
            return ('' + va).toLowerCase() < ('' + vb).toLowerCase() ? -driverSort.dir : driverSort.dir;
        });

        const tbody = document.getElementById('driverBody');
        if (!tbody) return;

        tbody.innerHTML = data.length ? data.map(d => {
            const cls = d.available ? 'available' : 'on-trip';
            const lbl = d.available ? '✓ Available' : '🚗 On a trip';
            return `
            <tr>
                <td><strong>${d.name}</strong></td>
                <td>${d.experience} yrs</td>
                <td>★ ${(d.rating || 4.8).toFixed(1)}</td>
                <td>${d.languages || 'Hindi, English'}</td>
                <td>
                    <button class="driver-status-btn ${cls}" data-driver-toggle="${d.id}"
                            title="Click to toggle availability" style="cursor:pointer;">
                        ${lbl}
                    </button>
                </td>
                <td>
                    <button class="btn-danger btn-small" data-driver-remove="${d.id}"
                            style="padding:4px 10px;font-size:0.75rem;cursor:pointer;">
                        Remove
                    </button>
                </td>
            </tr>`;
        }).join('') : '<tr><td colspan="6" class="empty-msg">No drivers found.</td></tr>';
    }

    // Driver Action Delegation
    const driverBodyEl = document.getElementById('driverBody');
    if (driverBodyEl) {
        driverBodyEl.addEventListener('click', e => {
            const toggleBtn = e.target.closest('[data-driver-toggle]');
            const removeBtn = e.target.closest('[data-driver-remove]');

            if (toggleBtn) {
                const id = toggleBtn.dataset.driverToggle;
                DriverStore.toggleAvailable(id);
                refreshData();
            }

            if (removeBtn) {
                const rid = removeBtn.dataset.driverRemove;
                if (confirm('Are you sure you want to remove this driver from the fleet?')) {
                    DriverStore.remove(rid);
                    refreshData();
                }
            }
        });
    }

    // Add Driver
    document.getElementById('addDriverBtn')?.addEventListener('click', () => {
        const nameInput  = document.getElementById('newDriverName');
        const expInput   = document.getElementById('newDriverExp');
        const langsInput = document.getElementById('newDriverLangs');

        const name  = nameInput?.value.trim();
        const exp   = parseInt(expInput?.value) || 0;
        const langs = langsInput?.value.trim() || 'Hindi, English';

        if (!name) {
            alert('Please enter a driver name.');
            nameInput?.focus();
            return;
        }

        DriverStore.add({ name, experience: exp, rating: 4.8, available: true, languages: langs });

        if (nameInput)  nameInput.value  = '';
        if (expInput)   expInput.value   = '';
        if (langsInput) langsInput.value = '';

        refreshData();
    });

    document.getElementById('driverSearch')?.addEventListener('input', renderDrivers);

    /* ════════════════════════════════════════════
       6. MESSAGES TAB
    ════════════════════════════════════════════ */
    function renderMessages() {
        const q      = (document.getElementById('msgSearch')?.value || '').toLowerCase().trim();
        const filter = document.getElementById('msgFilter')?.value || '';
        const all    = MessageStore.getAll();

        const data = all.filter(m => {
            const matchesQ = m.name.toLowerCase().includes(q) ||
                             m.email.toLowerCase().includes(q) ||
                             m.message.toLowerCase().includes(q);
            const matchesF = !filter || (filter === 'unread' ? !m.read : m.read);
            return matchesQ && matchesF;
        });

        const listEl = document.getElementById('msgList');
        if (!listEl) return;

        if (!data.length) {
            listEl.innerHTML = '<div class="empty-msg">No messages found.</div>';
            return;
        }

        listEl.innerHTML = data.map((m, i) => {
            const dot = m.read ? '' : '<span class="msg-unread-dot"></span>';
            const btn = m.read ? '' : `<button class="mark-read-btn" data-msg-read="${i}" style="cursor:pointer;">Mark read</button>`;
            return `
            <div class="msg-card ${m.read ? '' : 'unread'}">
                <div class="msg-card-top">
                    <strong>${dot}${m.name}</strong>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span class="msg-date">${fmtDate(m.date)}</span>
                        ${btn}
                        <button data-msg-delete="${i}" style="background:transparent;border:none;color:#991b1b;cursor:pointer;font-size:0.8rem;" title="Delete message">✕</button>
                    </div>
                </div>
                <div class="msg-email">✉ ${m.email}</div>
                <div class="msg-text">${m.message.replace(/\n/g, '<br>')}</div>
            </div>`;
        }).join('');
    }

    const msgListEl = document.getElementById('msgList');
    if (msgListEl) {
        msgListEl.addEventListener('click', e => {
            const readBtn = e.target.closest('[data-msg-read]');
            const delBtn  = e.target.closest('[data-msg-delete]');

            if (readBtn) {
                const idx = parseInt(readBtn.dataset.msgRead);
                MessageStore.markRead(idx);
                refreshData();
            }

            if (delBtn) {
                const idx = parseInt(delBtn.dataset.msgDelete);
                if (confirm('Delete this message?')) {
                    MessageStore.delete(idx);
                    refreshData();
                }
            }
        });
    }

    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
        MessageStore.markAllRead();
        refreshData();
    });

    document.getElementById('msgSearch')?.addEventListener('input', renderMessages);
    document.getElementById('msgFilter')?.addEventListener('change', renderMessages);

    /* ════════════════════════════════════════════
       Initial Load & Reactivity Listeners
    ════════════════════════════════════════════ */
    refreshData();

    // Re-render when bookings, vehicles, drivers or messages change anywhere
    window.addEventListener('driveease:booking-added', refreshData);
    window.addEventListener('driveease:booking-updated', refreshData);
    window.addEventListener('driveease:booking-deleted', refreshData);
    window.addEventListener('driveease:vehicles-updated', refreshData);
    window.addEventListener('driveease:drivers-updated', refreshData);
    window.addEventListener('driveease:message-added', refreshData);
    window.addEventListener('driveease:messages-updated', refreshData);

    // Cross-tab updates
    window.addEventListener('storage', e => {
        if (e.key?.startsWith('driveease_')) refreshData();
    });

})();
