'use strict';

/* =====================================================================
   DriveEase – booking.js
   Full-featured booking workflow:
   - Dynamic vehicle & driver list populations from DriveEase data layer
   - Auto-population for logged-in users (name, email, phone)
   - Real-time pricing calculations, drive-mode toggling, driver selection
   - URL parameter parsing (pre-selected vehicle & driver)
   - Async booking submission with persistent saving and redirect
   ===================================================================== */

(() => {

    const ready = fn => document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', fn)
        : fn();

    ready(() => {
        const { DRIVER_RATE, formatMoney, BookingStore, Booking, VehicleStore, DriverStore, UserStore } = window.DriveEase || {};
        if (!BookingStore || !VehicleStore) {
            console.warn('[booking.js] DriveEase data layer not found.');
            return;
        }

        const form = document.getElementById('bookingForm');
        if (!form) return;

        /* ── DOM Element References ── */
        const select      = document.getElementById('vehicleSelect');
        const daysInput   = document.getElementById('days');
        const dateInput   = form.querySelector('input[name="date"]');
        const selfRadio   = form.querySelector('input[name="drive-mode"][value="self"]');
        const driverRadio = form.querySelector('input[name="drive-mode"][value="driver"]');
        const panel       = document.getElementById('driverPanel');
        const pickList    = document.getElementById('driverPick');
        const note        = document.getElementById('driverNote');
        const driverMsg   = document.getElementById('driverMsg');
        const submitBtn   = form.querySelector('button[type="submit"]');

        const sum = {
            photo:   document.getElementById('sumPhoto'),
            img:     document.getElementById('sumImg'),
            status:  document.getElementById('sumStatus'),
            name:    document.getElementById('sumName'),
            meta:    document.getElementById('sumMeta'),
            rate:    document.getElementById('sumRate'),
            driver:  document.getElementById('sumDriver'),
            dur:     document.getElementById('sumDur'),
            total:   document.getElementById('sumTotal'),
            advance: document.getElementById('sumAdvance'),
            balance: document.getElementById('sumBalance')
        };

        /* ── Auto-populate Logged-in Customer Information ── */
        let currentUser = UserStore ? UserStore.getCurrentUser() : null;
        if (!currentUser && UserStore) {
            const savedEmail = localStorage.getItem('driveease_current_user') || 'rdrbundela@gmail.com';
            currentUser = UserStore.getByEmail(savedEmail);
        }
        if (currentUser) {
            const nameField = form.querySelector('input[name="name"]');
            const emailField = form.querySelector('input[name="email"]');
            const phoneField = form.querySelector('input[name="phone"]');

            if (nameField && !nameField.value) {
                const fullName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ');
                if (fullName) nameField.value = fullName;
            }
            if (emailField && !emailField.value && currentUser.email) {
                emailField.value = currentUser.email;
            }
            if (phoneField && !phoneField.value && currentUser.phone) {
                phoneField.value = currentUser.phone;
            }
        }

        /* ── Set Default Date (Today or Tomorrow) ── */
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.min = `${year}-${month}-${day}`;
            dateInput.value = `${year}-${month}-${day}`;
        }

        /* ── URL Parameter Parsing (e.g. ?vehicle=creta&driver=1&driverId=d1) ── */
        const params = new URLSearchParams(window.location.search);
        const wantedVehicleId = params.get('vehicle');
        const selectedOnlyVehicle = wantedVehicleId ? VehicleStore.getById(wantedVehicleId) : null;

        /* ── Populate Vehicle Dropdown ── */
        function populateVehicles() {
            select.innerHTML = '';

            if (selectedOnlyVehicle) {
                // If a vehicle was selected from the vehicles page:
                // Exclusively show only this vehicle — do NOT show any other vehicle
                const price = selectedOnlyVehicle.isBookable ? formatMoney(selectedOnlyVehicle.rate) + '/day' : selectedOnlyVehicle.statusLabel;
                const option = new Option(`${selectedOnlyVehicle.name} — ${price}`, selectedOnlyVehicle.id, true, true);
                select.add(option);
                select.value = selectedOnlyVehicle.id;

                // Add or update clean change-vehicle prompt
                let lockNotice = document.getElementById('vehicleLockedNotice');
                if (!lockNotice) {
                    lockNotice = document.createElement('div');
                    lockNotice.id = 'vehicleLockedNotice';
                    lockNotice.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:7px;font-size:0.8rem;color:var(--muted);';
                    lockNotice.innerHTML = `
                        <span>✓ Selected vehicle: <strong>${selectedOnlyVehicle.name}</strong></span>
                        <a href="vehicles.html" style="color:var(--blue);font-weight:600;text-decoration:underline;">Change vehicle →</a>
                    `;
                    select.parentNode.insertBefore(lockNotice, select.nextSibling);
                }
            } else {
                select.innerHTML = '<option value="">Select a vehicle</option>';
                const vehicles = VehicleStore.getAll();
                vehicles.forEach(vehicle => {
                    const price = vehicle.isBookable ? formatMoney(vehicle.rate) + '/day' : vehicle.statusLabel;
                    const option = new Option(`${vehicle.name} — ${price}`, vehicle.id);
                    option.disabled = !vehicle.isBookable;
                    select.add(option);
                });
            }
        }

        /* ── Populate Driver Choice Radios ── */
        function populateDrivers() {
            const drivers = DriverStore.getAll();
            pickList.innerHTML = drivers.map(driver => `
                <label class="choice" style="${driver.available ? '' : 'opacity:0.6;cursor:not-allowed;'}">
                    <input type="radio" name="driver" value="${driver.id}" ${driver.available ? '' : 'disabled'}>
                    <span class="choice-body">
                        <span class="driver-avatar">${driver.initials()}</span>
                        <span class="driver-info">
                            <strong>${driver.name}</strong>
                            <small>${driver.describe()}</small>
                            <span class="driver-tag ${driver.available ? 'available' : 'booked'}">
                                ${driver.available ? '● Available' : '● On a trip'}
                            </span>
                        </span>
                    </span>
                </label>`).join('');
        }

        populateVehicles();
        populateDrivers();

        /* ── Helper Lookups ── */
        const selectedVehicle = () => VehicleStore.getById(select.value);
        const selectedDriver  = () => {
            const checked = form.querySelector('input[name="driver"]:checked');
            return checked ? DriverStore.getById(checked.value) : undefined;
        };
        const wantsDriver = () => Boolean(driverRadio && driverRadio.checked);

        /* ── Refresh Summary & Price Calculations ── */
        function update() {
            const vehicle = selectedVehicle();
            const canHaveDriver = Boolean(vehicle && vehicle.supportsDriver);

            if (driverRadio) {
                driverRadio.disabled = !canHaveDriver;
                if (!canHaveDriver && wantsDriver() && selfRadio) {
                    selfRadio.checked = true;
                }

                const driverLabel = driverRadio.closest('label.choice');
                if (driverLabel) {
                    driverLabel.style.cursor = canHaveDriver ? '' : 'not-allowed';
                    driverLabel.title = canHaveDriver
                        ? 'Professional driver available for this vehicle'
                        : 'Select an available vehicle to hire a driver.';
                }
            }

            if (note) note.hidden = !vehicle || canHaveDriver;
            if (panel) panel.hidden = !wantsDriver();
            if (driverMsg) driverMsg.textContent = '';

            /* Vehicle summary card */
            if (vehicle) {
                if (sum.photo) sum.photo.hidden = false;
                if (sum.img) {
                    sum.img.src = vehicle.img;
                    sum.img.alt = vehicle.name;
                }
                if (sum.name) sum.name.textContent = vehicle.name;
                if (sum.meta) sum.meta.textContent = `${vehicle.meta} • ${vehicle.category}`;
                if (sum.status) {
                    sum.status.hidden = false;
                    sum.status.className = `status ${vehicle.status}`;
                    sum.status.textContent = vehicle.statusLabel;
                }
            } else {
                if (sum.photo) sum.photo.hidden = true;
                if (sum.status) sum.status.hidden = true;
                if (sum.name) sum.name.textContent = 'Choose a vehicle';
                if (sum.meta) sum.meta.textContent = 'Select a vehicle to see its details and pricing.';
            }

            /* Price calculations */
            const days = Number(daysInput?.value) || 0;
            const daysOk = Number.isInteger(days) && days >= 1 && days <= 30;
            const driver = selectedDriver();

            if (sum.rate) {
                sum.rate.textContent = vehicle ? `${formatMoney(vehicle.rate)}/day` : '—';
            }
            if (sum.driver) {
                sum.driver.textContent = wantsDriver()
                    ? `${driver ? driver.name : 'Not selected'} · +${formatMoney(DRIVER_RATE)}/day`
                    : 'Self-drive';
            }
            if (sum.dur) {
                sum.dur.textContent = daysOk ? `${days} day${days > 1 ? 's' : ''}` : '— days';
            }
            if (sum.total) {
                const totalAmt = (vehicle && daysOk) ? vehicle.total(days, wantsDriver()) : 0;
                sum.total.textContent = (vehicle && daysOk)
                    ? formatMoney(totalAmt)
                    : '₹—';
                const advAmt = Math.round(totalAmt * 0.5);
                const balAmt = totalAmt - advAmt;
                if (sum.advance) sum.advance.textContent = (vehicle && daysOk) ? formatMoney(advAmt) : '₹—';
                if (sum.balance) sum.balance.textContent = (vehicle && daysOk) ? formatMoney(balAmt) : '₹—';
            }
        }

        /* ── Pre-fill Driver parameters from URL ── */
        const wantedDriverMode = params.get('driver');
        const wantedDriverId = params.get('driverId');

        update();

        if (wantedDriverMode === '1' && driverRadio && !driverRadio.disabled) {
            driverRadio.checked = true;
            update();
        }

        if (wantedDriverId) {
            const driverRadioBtn = form.querySelector(`input[name="driver"][value="${wantedDriverId}"]`);
            if (driverRadioBtn && !driverRadioBtn.disabled) {
                if (driverRadio) driverRadio.checked = true;
                driverRadioBtn.checked = true;
                update();
            }
        }

        // Attach listeners
        form.addEventListener('change', update);
        if (daysInput) {
            daysInput.addEventListener('input', update);
            daysInput.addEventListener('change', update);
        }

        /* ── Booking Submission ── */

        function showFormError(text) {
            let box = form.querySelector('.form-error');
            if (!box) {
                box = document.createElement('div');
                box.className = 'form-error';
                form.prepend(box);
            }
            box.textContent = text;
            box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function buildBooking() {
            const vehicle = selectedVehicle();
            const driver = wantsDriver() ? selectedDriver() : undefined;
            const days = Math.max(1, Number(daysInput ? daysInput.value : 1) || 1);
            const userEmail = (form.querySelector('[name="email"]')?.value || localStorage.getItem('driveease_current_user') || 'rdrbundela@gmail.com').trim().toLowerCase();
            const customerName = (form.querySelector('[name="name"]')?.value || 'Rudra Bundela').trim() || 'Rudra Bundela';
            const phoneVal = (form.querySelector('[name="phone"]')?.value || '9876542345').trim() || '9876542345';
            const pickupVal = (form.querySelector('[name="pickup"]')?.value || 'Civil Lines, Mathura, Uttar Pradesh').trim();
            const totalAmt = vehicle.total(days, wantsDriver());
            const advAmt = Math.round(totalAmt * 0.5);
            const balAmt = totalAmt - advAmt;

            return new Booking({
                vehicle: vehicle.name,
                vehicleName: vehicle.name,
                vehicleId: vehicle.id,
                vehicleType: vehicle.type,
                vehicleRate: vehicle.rate,
                id: Date.now(),
                customer: customerName,
                email: userEmail,
                phone: phoneVal,
                pickup: pickupVal,
                img: vehicle.img,
                date: form.querySelector('[name="date"]')?.value || new Date().toISOString().slice(0, 10),
                hours: days,
                days: days,
                driveMode: wantsDriver() ? 'driver' : 'self',
                withDriver: wantsDriver(),
                driverId: driver ? driver.id : null,
                driverName: driver ? driver.name : null,
                driverRate: driver ? DRIVER_RATE : 0,
                driverTotal: driver ? (DRIVER_RATE * days) : 0,
                vehicleTotal: vehicle.rate * days,
                total: totalAmt,
                advanceAmount: advAmt,
                remainingAmount: balAmt,
                advancePaid: false,
                finalPaid: false,
                status: 'pending',
                paymentStatus: 'unpaid'
            });
        }

        /* ── Payment Gateway Integration ── */
        let pendingBookingData = null;
        let selectedPaymentMethod = 'UPI';
        let isProcessingPayment = false;

        const payModal = document.getElementById('paymentModal');
        const payCloseBtn = document.getElementById('payCloseBtn');
        const btnPayConfirm = document.getElementById('btnPayConfirm');
        const payFormWrapper = document.getElementById('payFormWrapper');
        const payProcessing = document.getElementById('payProcessing');

        function openPaymentGateway() {
            const vehicle = selectedVehicle();
            if (!vehicle) return;

            pendingBookingData = buildBooking();

            // Populate Modal Summary
            const sumVeh = document.getElementById('paySummaryVehicle');
            const sumThumb = document.getElementById('paySummaryThumb');
            const sumMeta = document.getElementById('paySummaryMeta');
            const sumTotal = document.getElementById('paySummaryTotal');
            const btnPayAmt = document.getElementById('btnPayAmount');

            if (sumVeh) sumVeh.textContent = vehicle.name;
            if (sumThumb) {
                sumThumb.src = vehicle.img;
                sumThumb.alt = vehicle.name;
            }
            if (sumMeta) {
                const days = pendingBookingData.days || 1;
                const mode = pendingBookingData.driveMode === 'driver' ? `With Driver (${pendingBookingData.driverName || 'Assigned Driver'})` : 'Self-drive';
                sumMeta.textContent = `${days} day${days > 1 ? 's' : ''} • ${mode}`;
            }

            const formattedTotal = formatMoney(pendingBookingData.total);
            if (sumTotal) sumTotal.textContent = formattedTotal;
            if (btnPayAmt) btnPayAmt.textContent = `Pay ${formattedTotal} Securely`;

            // Reset UI state
            isProcessingPayment = false;
            if (payFormWrapper) payFormWrapper.style.display = 'block';
            if (payProcessing) payProcessing.style.display = 'none';

            // Reset Tabs to UPI
            switchPayTab('upi');

            // Open Modal
            if (payModal) payModal.classList.add('open');
        }

        function closePaymentGateway() {
            if (isProcessingPayment) return; // Prevent closing while transaction is in flight
            if (payModal) payModal.classList.remove('open');
        }

        function switchPayTab(tabName) {
            selectedPaymentMethod = tabName === 'upi' ? 'UPI' : (tabName === 'card' ? 'Card' : 'Net Banking');

            document.querySelectorAll('.pay-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            document.querySelectorAll('.pay-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `payPanel-${tabName}`);
            });
        }

        // Attach tab button listeners
        document.querySelectorAll('.pay-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPayTab(btn.dataset.tab));
        });

        // UPI App Shortcuts
        const upiInput = document.getElementById('upiIdInput');
        function setUpiApp(appSuffix) {
            const customerName = (form.querySelector('[name="name"]').value.trim() || 'user').toLowerCase().replace(/\s+/g, '');
            if (upiInput) {
                upiInput.value = `${customerName}@${appSuffix}`;
                upiInput.focus();
            }
        }
        document.getElementById('upiGPay')?.addEventListener('click', () => setUpiApp('okhdfcbank'));
        document.getElementById('upiPhonePe')?.addEventListener('click', () => setUpiApp('ybl'));
        document.getElementById('upiPaytm')?.addEventListener('click', () => setUpiApp('paytm'));
        document.getElementById('upiBhim')?.addEventListener('click', () => setUpiApp('upi'));

        // Card Formatting & Detection
        const cardNumInput = document.getElementById('cardNumberInput');
        const cardBrandBadge = document.getElementById('cardBrandBadge');
        if (cardNumInput) {
            cardNumInput.addEventListener('input', e => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 16);
                let formatted = v.match(/.{1,4}/g)?.join(' ') || v;
                e.target.value = formatted;

                if (cardBrandBadge) {
                    if (/^4/.test(v)) cardBrandBadge.textContent = 'VISA';
                    else if (/^5[1-5]/.test(v)) cardBrandBadge.textContent = 'MASTERCARD';
                    else if (/^6/.test(v)) cardBrandBadge.textContent = 'RUPAY';
                    else cardBrandBadge.textContent = 'CARD';
                }
            });
        }

        const cardExpInput = document.getElementById('cardExpiryInput');
        if (cardExpInput) {
            cardExpInput.addEventListener('input', e => {
                let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                if (v.length > 2) {
                    v = v.slice(0, 2) + ' / ' + v.slice(2);
                }
                e.target.value = v;
            });
        }

        // NetBanking Bank Selection
        document.querySelectorAll('.bank-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.bank-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const otherSelect = document.getElementById('otherBanksSelect');
                if (otherSelect) otherSelect.value = '';
            });
        });

        document.getElementById('otherBanksSelect')?.addEventListener('change', e => {
            if (e.target.value) {
                document.querySelectorAll('.bank-option').forEach(o => o.classList.remove('active'));
            }
        });

        // Close modal triggers
        if (payCloseBtn) payCloseBtn.addEventListener('click', closePaymentGateway);
        if (payModal) {
            payModal.addEventListener('click', e => {
                if (e.target === payModal) closePaymentGateway();
            });
        }

        // Confirm Payment & Process Transaction
        if (btnPayConfirm) {
            btnPayConfirm.addEventListener('click', async () => {
                if (!pendingBookingData || isProcessingPayment) return;
                isProcessingPayment = true;

                // Determine method label
                let methodLabel = selectedPaymentMethod;
                if (selectedPaymentMethod === 'UPI') {
                    const upiVal = upiInput?.value.trim();
                    methodLabel = upiVal ? `UPI (${upiVal})` : 'UPI';
                } else if (selectedPaymentMethod === 'Card') {
                    const last4 = (cardNumInput?.value.replace(/\D/g, '').slice(-4)) || '4242';
                    const brand = cardBrandBadge?.textContent || 'Card';
                    methodLabel = `${brand} (•••• ${last4})`;
                } else if (selectedPaymentMethod === 'Net Banking') {
                    const activeBank = document.querySelector('.bank-option.active')?.dataset.bank;
                    const otherBank = document.getElementById('otherBanksSelect')?.value;
                    methodLabel = `NetBanking (${otherBank || activeBank || 'HDFC Bank'})`;
                }

                // Transition to processing screen
                if (payFormWrapper) payFormWrapper.style.display = 'none';
                if (payProcessing) payProcessing.style.display = 'block';

                const pTitle = document.getElementById('payProcessingTitle');
                const pDesc = document.getElementById('payProcessingDesc');
                const pSpinner = document.getElementById('paySpinner');
                const pCheck = document.getElementById('paySuccessCheck');
                const pOtp = document.getElementById('simulatedOtpStep');

                if (pTitle) pTitle.textContent = 'Connecting to Payment Gateway…';
                if (pDesc) pDesc.textContent = 'Securing connection with payment network. Please do not refresh.';
                if (pSpinner) pSpinner.style.display = 'block';
                if (pCheck) pCheck.style.display = 'none';
                if (pOtp) pOtp.style.display = 'none';

                // Step 1: Simulated 3D Secure / OTP check after 700ms
                setTimeout(() => {
                    if (pOtp) pOtp.style.display = 'block';
                    if (pTitle) pTitle.textContent = 'Verifying 3D Secure Authorization…';
                    if (pDesc) pDesc.textContent = 'Verifying security credentials with issuing bank.';
                }, 700);

                // Step 2: Payment Authorized after 1800ms
                setTimeout(() => {
                    if (pSpinner) pSpinner.style.display = 'none';
                    if (pOtp) pOtp.style.display = 'none';
                    if (pCheck) pCheck.style.display = 'grid';
                    if (pTitle) pTitle.textContent = 'Payment Authorized! 🎉';
                    if (pDesc) pDesc.textContent = 'Transaction confirmed. Generating instant booking receipt…';
                }, 1800);

                // Step 3: Complete Booking and Redirect after 2000ms
                setTimeout(async () => {
                    try {
                        const txnId = 'TXN-DE-' + Date.now().toString().slice(-8);

                        pendingBookingData.status = 'confirmed';
                        pendingBookingData.paymentStatus = 'paid';
                        pendingBookingData.paymentMethod = methodLabel;
                        pendingBookingData.transactionId = txnId;
                        pendingBookingData.paidAt = new Date().toISOString();

                        // 1. Persist booking to BookingStore
                        await BookingStore.addAsync(pendingBookingData);

                        // 2. Synchronously ensure driveease_last_booking and driveease_current_user are set
                        const userEmail = (pendingBookingData.email || 'rdrbundela@gmail.com').toLowerCase().trim();
                        try {
                            localStorage.setItem('driveease_last_booking', JSON.stringify(pendingBookingData));
                            localStorage.setItem('driveease_current_user', userEmail);
                        } catch (e) {}

                        // 3. Ensure User profile exists in UserStore
                        if (UserStore) {
                            const fullName = (pendingBookingData.customer || 'Customer').trim();
                            const parts = fullName.split(' ');
                            const firstName = parts[0] || 'Customer';
                            const lastName = parts.slice(1).join(' ') || '';

                            const existing = UserStore.getByEmail(userEmail);
                            if (!existing) {
                                UserStore.saveUser({
                                    firstName,
                                    lastName,
                                    email: userEmail,
                                    phone: pendingBookingData.phone || '9876542345',
                                    address: pendingBookingData.pickup || 'Civil Lines, Mathura, Uttar Pradesh',
                                    password: '12345678p'
                                }, true);
                            } else {
                                let changed = false;
                                if (!existing.phone && pendingBookingData.phone) { existing.phone = pendingBookingData.phone; changed = true; }
                                if (!existing.address && pendingBookingData.pickup) { existing.address = pendingBookingData.pickup; changed = true; }
                                if (changed) UserStore.saveUser(existing, true);
                                else UserStore.setCurrentUser(userEmail);
                            }
                        }

                        // 4. Redirect cleanly with booked ID and email query params
                        window.location.href = `profile.html?booked=${encodeURIComponent(pendingBookingData.id)}&paid=1&email=${encodeURIComponent(userEmail)}`;

                    } catch (err) {
                        console.error('[booking.js] Payment finalization error:', err);
                        alert('Payment was processed but booking could not be saved. Please contact support.');
                        isProcessingPayment = false;
                        closePaymentGateway();
                    }
                }, 2000);
            });
        }

        /* Form validation callback from validate.js */
        form.addEventListener('form:valid', async event => {
            event.preventDefault();

            const vehicle = selectedVehicle();
            if (!vehicle) {
                showFormError('Please select a vehicle from the list.');
                select.focus();
                return;
            }

            if (!vehicle.isBookable) {
                showFormError(`Sorry, ${vehicle.name} is currently ${vehicle.statusLabel.toLowerCase()}. Please choose an available vehicle.`);
                return;
            }

            if (wantsDriver() && !selectedDriver()) {
                if (driverMsg) {
                    driverMsg.className = 'field-msg bad';
                    driverMsg.textContent = 'Please choose an available driver for your journey.';
                }
                if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting Request…';
            }

            try {
                const booking = buildBooking();

                // Save booking
                await BookingStore.addAsync(booking);

                // Save last booking and current user session
                const userEmail = booking.email;
                try {
                    localStorage.setItem('driveease_last_booking', JSON.stringify(booking));
                    localStorage.setItem('driveease_current_user', userEmail);
                } catch (e) {}

                // Ensure user profile in UserStore
                if (UserStore) {
                    const fullName = (booking.customer || 'Customer').trim();
                    const parts = fullName.split(' ');
                    const firstName = parts[0] || 'Customer';
                    const lastName = parts.slice(1).join(' ') || '';

                    const existing = UserStore.getByEmail(userEmail);
                    if (!existing) {
                        UserStore.saveUser({
                            firstName,
                            lastName,
                            email: userEmail,
                            phone: booking.phone || '9876542345',
                            address: booking.pickup || 'Civil Lines, Mathura, Uttar Pradesh',
                            password: '12345678p'
                        }, true);
                    } else {
                        UserStore.setCurrentUser(userEmail);
                    }
                }

                // Redirect to profile with requested=1
                window.location.href = `profile.html?booked=${encodeURIComponent(booking.id)}&requested=1&email=${encodeURIComponent(userEmail)}`;
            } catch (err) {
                console.error('[booking.js] Submission failed:', err);
                showFormError('Failed to submit booking request. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Booking Request →';
                }
            }
        });

        // Listen for vehicle updates (e.g. status changes)
        window.addEventListener('driveease:vehicles-updated', () => {
            populateVehicles();
            update();
        });
        window.addEventListener('driveease:drivers-updated', () => {
            populateDrivers();
            update();
        });
    });

})();
