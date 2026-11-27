'use strict';

/* =====================================================================
   DriveEase – data.js
   Shared, reactive data layer: vehicles, drivers, bookings, users,
   messages, and persistent LocalStorage stores.
   Must be loaded BEFORE booking.js, vehicles.js, and fleet-admin.js.
   ===================================================================== */

(() => {

    const DRIVER_RATE = 800; // Extra ₹ per day when a professional driver is chosen

    /* ── Helpers ── */

    function formatMoney(amount) {
        const num = Number(amount) || 0;
        return '₹' + num.toLocaleString('en-IN');
    }

    function formatDate(raw) {
        if (!raw) return '—';
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /* ── Vehicle model ── */

    class Vehicle {
        constructor({ id, name, type, color, transmission, seats, fuel, category,
                      rate, status, img, supportsDriver }) {
            this.id             = id;
            this.name           = name;
            this.type           = type; // 'two-wheeler' | 'four-wheeler'
            this.color          = color;
            this.transmission   = transmission;
            this.seats          = Number(seats) || 2;
            this.fuel           = fuel || 'Petrol';
            this.category       = category || 'City';
            this.rate           = Number(rate) || 0;
            this.status         = status || 'available'; // 'available' | 'booked' | 'maintenance'
            this.img            = img;
            this.supportsDriver = Boolean(supportsDriver);
        }

        get isBookable() {
            return this.status === 'available';
        }

        get statusLabel() {
            const map = {
                available: 'Available',
                booked: 'Booked',
                maintenance: 'Maintenance'
            };
            return map[this.status] || this.status;
        }

        get meta() {
            return `${this.color} • ${this.transmission} • ${this.seats} Seats`;
        }

        get typeLabel() {
            return this.type === 'two-wheeler' ? 'Two-wheeler' : 'Four-wheeler';
        }

        total(days, withDriver = false) {
            const numDays = Math.max(1, Number(days) || 1);
            const driverCost = withDriver && this.supportsDriver ? DRIVER_RATE : 0;
            return (this.rate + driverCost) * numDays;
        }
    }

    /* ── Driver model ── */

    class Driver {
        constructor({ id, name, experience, rating, available, languages, phone }) {
            this.id         = id;
            this.name       = name;
            this.experience = Number(experience) || 0; // years
            this.rating     = Number(rating) || 4.8;
            this.available  = available === undefined ? true : Boolean(available);
            this.languages  = languages || 'Hindi, English';
            this.phone      = phone || '+91 98765 43210';
        }

        initials() {
            return (this.name || 'D')
                .split(' ')
                .map(part => part[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }

        describe() {
            return `${this.experience} yrs exp • ★ ${this.rating.toFixed(1)}`;
        }
    }

    /* ── Booking model ── */

    class Booking {
        constructor({ vehicle, vehicleName, vehicleId, id, customer, email, phone, pickup,
                      vehicleType, vehicleRate, img, date, hours, days,
                      driveMode, withDriver, driverName, driverId, driverRate, driverTotal,
                      vehicleTotal, total, status, paymentStatus, paymentMethod, transactionId,
                      advanceAmount, remainingAmount, advancePaid, advancePaymentMethod, advanceTxnId, advancePaidAt,
                      finalPaid, finalPaymentMethod, finalTxnId, finalPaidAt,
                      paidAt, refundedAt, createdAt }) {
            this.vehicle     = String(vehicle || vehicleName || 'Vehicle');
            this.vehicleName = String(vehicleName || vehicle || 'Vehicle');
            this.vehicleId   = vehicleId;
            this.id          = id || Date.now();
            this.customer    = String(customer || 'Customer');
            this.email       = String(email || '').toLowerCase().trim();
            this.phone       = String(phone || '');
            this.pickup      = String(pickup || '');
            this.vehicleType = String(vehicleType || '');
            this.vehicleRate = Number(vehicleRate) || 0;
            this.img         = img || '';
            this.date        = date;
            this.hours       = Number(hours || days) || 1; // days
            this.days        = Number(days || hours) || 1;
            this.driveMode   = driveMode || (driverName ? 'driver' : 'self');
            this.withDriver  = withDriver !== undefined ? Boolean(withDriver) : Boolean(driverName);
            this.driverName  = driverName || null;
            this.driverId    = driverId || null;
            this.driverRate  = Number(driverRate) || (this.withDriver ? DRIVER_RATE : 0);
            this.driverTotal = Number(driverTotal) || (this.driverRate * this.days);
            this.vehicleTotal= Number(vehicleTotal) || (this.vehicleRate * this.days);
            this.total       = Number(total) || (this.vehicleTotal + this.driverTotal);

            // 50% Advance & 50% Return Balance structure
            this.advanceAmount = Number(advanceAmount) || Math.round(this.total * 0.5);
            this.remainingAmount = Number(remainingAmount) || (this.total - this.advanceAmount);

            this.status      = status || 'pending'; // 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'rejected'

            this.advancePaid = advancePaid !== undefined ? Boolean(advancePaid) : (paymentStatus === 'paid' && status !== 'pending');
            this.advancePaymentMethod = advancePaymentMethod || (this.advancePaid ? (paymentMethod || 'UPI') : null);
            this.advanceTxnId = advanceTxnId || (this.advancePaid ? (transactionId || ('TXN-ADV-' + String(this.id).slice(-6))) : null);
            this.advancePaidAt = advancePaidAt || (this.advancePaid ? (paidAt || createdAt || new Date().toISOString()) : null);

            this.finalPaid   = finalPaid !== undefined ? Boolean(finalPaid) : (paymentStatus === 'paid' && (status === 'completed' || status === 'confirmed'));
            this.finalPaymentMethod = finalPaymentMethod || (this.finalPaid ? (paymentMethod || 'UPI') : null);
            this.finalTxnId = finalTxnId || (this.finalPaid ? (transactionId || ('TXN-BAL-' + String(this.id).slice(-6))) : null);
            this.finalPaidAt = finalPaidAt || (this.finalPaid ? (paidAt || createdAt || new Date().toISOString()) : null);

            if (this.advancePaid && this.finalPaid) {
                this.paymentStatus = 'paid';
            } else if (this.advancePaid) {
                this.paymentStatus = 'partial';
            } else if (this.status === 'cancelled' || this.status === 'rejected') {
                this.paymentStatus = paymentStatus || 'unpaid';
            } else {
                this.paymentStatus = paymentStatus || 'unpaid';
            }

            this.paymentMethod = paymentMethod || (this.advancePaid ? this.advancePaymentMethod : 'UPI');
            this.transactionId = transactionId || this.finalTxnId || this.advanceTxnId || ('TXN-DE-' + String(this.id).slice(-6));
            this.paidAt      = paidAt || (this.paymentStatus === 'paid' ? (createdAt || new Date().toISOString()) : null);
            this.refundedAt  = refundedAt || null;
            this.createdAt   = createdAt || new Date().toISOString();
        }
    }

    /* ── Default Seed Data ── */

    const SEED_VEHICLES = [
        {
            id: 'activa',
            name: 'Honda Activa 6G',
            type: 'two-wheeler',
            color: 'Black',
            transmission: 'Automatic',
            seats: 2,
            fuel: 'Petrol',
            category: 'City',
            rate: 600,
            status: 'available',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuS997YYKZJjvKm23V8PY88cJ63rkOzSKNgSsaLoSLB72A_Ks1UI9-tklSmhB0UNjUga31rjdc13hT48163VQrmrAsDnhAZHPItP1_VkSLoQ&s=10',
            supportsDriver: true
        },
        {
            id: 'classic350',
            name: 'Royal Enfield Classic 350',
            type: 'two-wheeler',
            color: 'Red',
            transmission: 'Manual',
            seats: 2,
            fuel: 'Petrol',
            category: 'Touring',
            rate: 1200,
            status: 'available',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLbVGsrKzpqnuxwSr47pNDWcIlHHfmD_IuTppd1cS1TA&s=10',
            supportsDriver: true
        },
        {
            id: 'pulsar',
            name: 'Bajaj Pulsar 150',
            type: 'two-wheeler',
            color: 'Black',
            transmission: 'Manual',
            seats: 2,
            fuel: 'Petrol',
            category: 'City',
            rate: 900,
            status: 'maintenance',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkx2eQw-52FQ-mP3P69xZqRB1dnzQ-Q9r5nMLjIT14kw&s=10',
            supportsDriver: true
        },
        {
            id: 'creta',
            name: 'Hyundai Creta',
            type: 'four-wheeler',
            color: 'White',
            transmission: 'Automatic',
            seats: 5,
            fuel: 'Petrol',
            category: 'SUV',
            rate: 3000,
            status: 'available',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTBr1WaxU2tk9maYKuS9sV7C4PqP6IXW8NanLWbly4TLGK-bLK2nX8Zxv8ffhkNd6Qu-G0_lIZBGm0a8ByjI3kXZc487kGEQw3elFIdz7k_&s=10',
            supportsDriver: true
        },
        {
            id: 'nexon',
            name: 'Tata Nexon',
            type: 'four-wheeler',
            color: 'Blue',
            transmission: 'Manual',
            seats: 5,
            fuel: 'Petrol',
            category: 'SUV',
            rate: 2500,
            status: 'available',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXkyudQ-2uzS-_ljyeSu3aX2_tORaPBF7DflkxDke9Og&s=10',
            supportsDriver: true
        },
        {
            id: 'swift',
            name: 'Maruti Swift',
            type: 'four-wheeler',
            color: 'White',
            transmission: 'Manual',
            seats: 5,
            fuel: 'Petrol',
            category: 'Hatchback',
            rate: 2000,
            status: 'available',
            img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQ8pqmiGzJJjn2lzIwRV8ipG0G0XZWS8SdKEQV7uA5tA&s=10',
            supportsDriver: true
        }
    ];

    const SEED_DRIVERS = [
        { id: 'd1', name: 'Rajesh Kumar',  experience: 8, rating: 4.9, available: true,  languages: 'Hindi, English' },
        { id: 'd2', name: 'Amit Sharma',   experience: 5, rating: 4.7, available: true,  languages: 'Hindi, English, Punjabi' },
        { id: 'd3', name: 'Suresh Verma',  experience: 12, rating: 4.8, available: false, languages: 'Hindi, English' },
        { id: 'd4', name: 'Pradeep Singh', experience: 3, rating: 4.6, available: true,  languages: 'Hindi, English' }
    ];

    const SEED_USERS = {
        'rdrbundela@gmail.com': {
            firstName: 'Rudra',
            lastName: 'Bundela',
            email: 'rdrbundela@gmail.com',
            phone: '9876542345',
            address: 'Civil Lines, Mathura, Uttar Pradesh',
            password: '12345678p',
            createdAt: Date.now() - 45 * 86400000
        },
        'rudra@example.com': {
            firstName: 'Rudra',
            lastName: 'Sharma',
            email: 'rudra@example.com',
            phone: '9876543210',
            address: 'B-14 Civil Lines, Mathura, Uttar Pradesh',
            password: '12345678p',
            createdAt: Date.now() - 30 * 86400000
        },
        'priya@example.com': {
            firstName: 'Priya',
            lastName: 'Patel',
            email: 'priya@example.com',
            phone: '9123456789',
            address: '42 Ring Road, Agra, Uttar Pradesh',
            password: '12345678p',
            createdAt: Date.now() - 15 * 86400000
        }
    };

    const SEED_ADMINS = {
        'admin@driveease.com': {
            email: 'admin@driveease.com',
            password: 'Admin@DriveEase2026',
            name: 'Fleet Administrator',
            role: 'admin'
        }
    };

    const SEED_BOOKINGS = [];

    const SEED_MESSAGES = [
        {
            name: 'Sunil Verma',
            email: 'sunil@verma.in',
            message: 'Inquiring about outstation rental from Mathura to Delhi for 4 days with driver.',
            date: new Date(Date.now() - 3600000 * 5).toISOString(),
            read: false
        },
        {
            name: 'Anjali Gupta',
            email: 'anjali.g@example.com',
            message: 'Do you offer monthly subscription packages for corporate travel in Creta/Nexon?',
            date: new Date(Date.now() - 86400000).toISOString(),
            read: true
        }
    ];

    /* ── Persistent Stores ── */

    const VehicleStore = {
        _key: 'driveease_vehicles',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                const raw = saved ? JSON.parse(saved) : null;
                if (Array.isArray(raw) && raw.length > 0) {
                    let migrated = false;
                    raw.forEach(item => {
                        if (!item.supportsDriver) {
                            item.supportsDriver = true;
                            migrated = true;
                        }
                    });
                    if (migrated) this.save(raw);
                    return raw.map(item => new Vehicle(item));
                }
            } catch (err) {
                console.warn('[VehicleStore] Read failed:', err);
            }
            this.save(SEED_VEHICLES);
            return SEED_VEHICLES.map(item => new Vehicle(item));
        },

        getRaw() {
            try {
                const saved = localStorage.getItem(this._key);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (err) {}
            return SEED_VEHICLES.map(v => ({ ...v }));
        },

        getById(id) {
            return this.getAll().find(v => v.id === id) || null;
        },

        save(list) {
            try {
                localStorage.setItem(this._key, JSON.stringify(list));
            } catch (err) {
                console.error('[VehicleStore] Save failed:', err);
            }
        },

        updateStatus(id, newStatus) {
            const list = this.getRaw();
            const target = list.find(v => v.id === id);
            if (target) {
                target.status = newStatus;
                this.save(list);
                window.dispatchEvent(new CustomEvent('driveease:vehicles-updated', { detail: { id, status: newStatus } }));
                return true;
            }
            return false;
        },

        reset() {
            this.save(SEED_VEHICLES);
            return this.getAll();
        }
    };

    const DriverStore = {
        _key: 'driveease_drivers',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                const raw = saved ? JSON.parse(saved) : null;
                if (Array.isArray(raw) && raw.length > 0) {
                    return raw.map(item => new Driver(item));
                }
            } catch (err) {
                console.warn('[DriverStore] Read failed:', err);
            }
            this.save(SEED_DRIVERS);
            return SEED_DRIVERS.map(item => new Driver(item));
        },

        getRaw() {
            try {
                const saved = localStorage.getItem(this._key);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (err) {}
            return SEED_DRIVERS.map(d => ({ ...d }));
        },

        getById(id) {
            return this.getAll().find(d => d.id === id) || null;
        },

        save(list) {
            try {
                localStorage.setItem(this._key, JSON.stringify(list));
            } catch (err) {
                console.error('[DriverStore] Save failed:', err);
            }
        },

        toggleAvailable(id) {
            const list = this.getRaw();
            const target = list.find(d => d.id === id);
            if (target) {
                target.available = !target.available;
                this.save(list);
                window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id, available: target.available } }));
                return target.available;
            }
            return null;
        },

        add(driverData) {
            const list = this.getRaw();
            const newDriver = {
                id: driverData.id || 'd' + Date.now(),
                name: driverData.name,
                experience: Number(driverData.experience) || 0,
                rating: Number(driverData.rating) || 4.7,
                available: driverData.available !== undefined ? driverData.available : true,
                languages: driverData.languages || 'Hindi, English'
            };
            list.push(newDriver);
            this.save(list);
            window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: newDriver }));
            return new Driver(newDriver);
        },

        remove(id) {
            let list = this.getRaw();
            list = list.filter(d => d.id !== id);
            this.save(list);
            window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id, removed: true } }));
            return true;
        }
    };

    // Automatic one-time purge of all past customer bookings as requested
    try {
        const PURGE_KEY = 'driveease_bookings_purged_all_v3';
        if (typeof localStorage !== 'undefined' && localStorage.getItem(PURGE_KEY) !== 'true') {
            localStorage.setItem('driveease_bookings', JSON.stringify([]));
            localStorage.removeItem('driveease_last_booking');
            localStorage.setItem(PURGE_KEY, 'true');
        }
    } catch(e) {}

    const BookingStore = {
        _key: 'driveease_bookings',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                if (saved !== null) {
                    const raw = JSON.parse(saved);
                    if (Array.isArray(raw)) {
                        let needsMigration = false;
                        // Filter out any corrupted null elements
                        const validRaw = raw.filter(item => item && typeof item === 'object');
                        if (validRaw.length !== raw.length) needsMigration = true;

                        const list = validRaw.map(b => {
                            if (!b.vehicle) needsMigration = true;
                            if (b.advanceAmount === undefined || b.remainingAmount === undefined) {
                                const tot = Number(b.total || 0);
                                b.advanceAmount = Number(b.advanceAmount) || Math.round(tot * 0.5);
                                b.remainingAmount = Number(b.remainingAmount) || (tot - b.advanceAmount);
                                needsMigration = true;
                            }
                            if (b.advancePaid === undefined) {
                                if (b.status === 'completed' || (b.paymentStatus === 'paid' && b.status !== 'pending')) {
                                    b.advancePaid = true;
                                    b.finalPaid = true;
                                    b.paymentStatus = 'paid';
                                } else if (b.status === 'active') {
                                    b.advancePaid = true;
                                    b.finalPaid = false;
                                    b.paymentStatus = 'partial';
                                } else {
                                    b.advancePaid = false;
                                    b.finalPaid = false;
                                    b.paymentStatus = (b.status === 'cancelled' || b.status === 'rejected') ? 'refunded' : 'unpaid';
                                }
                                needsMigration = true;
                            }
                            if (!b.paymentStatus) {
                                b.paymentStatus = (b.status === 'cancelled' || b.status === 'rejected') ? 'refunded' : 'paid';
                                b.paymentMethod = b.paymentMethod || 'UPI';
                                b.transactionId = b.transactionId || ('TXN-DE-' + String(b.id).slice(-6));
                                needsMigration = true;
                            }
                            return new Booking(b);
                        });
                        if (needsMigration) {
                            this.save(validRaw);
                        }
                        return list;
                    }
                }
            } catch (err) {
                console.warn('[BookingStore] Read failed:', err);
            }
            this.save([]);
            return [];
        },

        getRaw() {
            try {
                const saved = localStorage.getItem(this._key);
                if (saved !== null) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (err) {}
            return SEED_BOOKINGS.map(b => ({ ...b }));
        },

        save(bookings) {
            try {
                localStorage.setItem(this._key, JSON.stringify(bookings));
            } catch (err) {
                console.error('[BookingStore] Save failed:', err);
            }
        },

        clear() {
            this.save([]);
            try { localStorage.removeItem('driveease_last_booking'); } catch(e) {}
            window.dispatchEvent(new CustomEvent('driveease:booking-deleted', { detail: { all: true } }));
            return true;
        },

        getById(id) {
            if (!id) return null;
            return this.getAll().find(b => b && String(b.id) === String(id)) || null;
        },

        getForUser(email) {
            if (!email) return [];
            const all = this.getAll();
            const lower = String(email).toLowerCase().trim();
            return all.filter(b => b && String(b.email || '').toLowerCase().trim() === lower);
        },

        addAsync(booking) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    try {
                        const list = this.getRaw();
                        const bObj = booking instanceof Booking ? { ...booking } : booking;
                        list.unshift(bObj);
                        this.save(list);

                        // Only lock vehicle & driver if the booking is already confirmed/active.
                        // Pending requests await admin approval first.
                        if (bObj.status === 'confirmed' || bObj.status === 'active') {
                            if (booking.vehicleId) {
                                VehicleStore.updateStatus(booking.vehicleId, 'booked');
                            }
                            if (booking.driverId) {
                                const drivers = DriverStore.getRaw();
                                const targetDriver = drivers.find(d => d.id === booking.driverId);
                                if (targetDriver) {
                                    targetDriver.available = false;
                                    DriverStore.save(drivers);
                                    window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: booking.driverId, available: false } }));
                                }
                            }
                        }

                        window.dispatchEvent(new CustomEvent('driveease:booking-added', { detail: bObj }));
                        resolve(new Booking(bObj));
                    } catch (err) {
                        reject(err);
                    }
                }, 150); // fast & snappy
            });
        },

        updateStatus(id, newStatus) {
            const list = this.getRaw();
            const target = list.find(b => String(b.id) === String(id));
            if (target) {
                const prevStatus = target.status;
                target.status = newStatus;
                this.save(list);

                // When Admin confirms or activates booking -> lock vehicle & driver
                if (newStatus === 'confirmed' || newStatus === 'active') {
                    if (target.vehicleId) {
                        VehicleStore.updateStatus(target.vehicleId, 'booked');
                    }
                    if (target.driverId) {
                        const drivers = DriverStore.getRaw();
                        const targetDriver = drivers.find(d => d.id === target.driverId);
                        if (targetDriver) {
                            targetDriver.available = false;
                            DriverStore.save(drivers);
                            window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: target.driverId, available: false } }));
                        }
                    }
                }

                // If booking is cancelled, rejected, completed, or reverted to pending -> release vehicle & driver
                if (newStatus === 'cancelled' || newStatus === 'rejected' || newStatus === 'completed' || newStatus === 'pending') {
                    const vehicleId = target.vehicleId;
                    if (vehicleId) {
                        const hasOtherActive = list.some(b =>
                            b.vehicleId === vehicleId &&
                            String(b.id) !== String(id) &&
                            (b.status === 'confirmed' || b.status === 'active')
                        );
                        if (!hasOtherActive) {
                            VehicleStore.updateStatus(vehicleId, 'available');
                        }
                    }

                    if (target.driverId) {
                        const hasOtherActiveDriver = list.some(b =>
                            b.driverId === target.driverId &&
                            String(b.id) !== String(id) &&
                            (b.status === 'confirmed' || b.status === 'active')
                        );
                        if (!hasOtherActiveDriver) {
                            const drivers = DriverStore.getRaw();
                            const targetDriver = drivers.find(d => d.id === target.driverId);
                            if (targetDriver) {
                                targetDriver.available = true;
                                DriverStore.save(drivers);
                                window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: target.driverId, available: true } }));
                            }
                        }
                    }
                }

                window.dispatchEvent(new CustomEvent('driveease:booking-updated', { detail: { id, status: newStatus, prevStatus } }));
                return true;
            }
            return false;
        },

        payAdvance(id, { paymentMethod = 'UPI', txnId = null } = {}) {
            const list = this.getRaw();
            const target = list.find(b => String(b.id) === String(id));
            if (!target) return null;

            target.advancePaid = true;
            target.advancePaymentMethod = paymentMethod;
            target.advanceTxnId = txnId || ('TXN-ADV-' + Date.now().toString().slice(-8));
            target.advancePaidAt = new Date().toISOString();
            target.paymentMethod = paymentMethod;
            target.transactionId = target.advanceTxnId;
            target.status = 'active';
            target.paymentStatus = (target.finalPaid) ? 'paid' : 'partial';

            this.save(list);

            // Lock vehicle & driver once advance payment is secured
            if (target.vehicleId) {
                VehicleStore.updateStatus(target.vehicleId, 'booked');
            }
            if (target.driverId) {
                const drivers = DriverStore.getRaw();
                const targetDriver = drivers.find(d => d.id === target.driverId);
                if (targetDriver) {
                    targetDriver.available = false;
                    DriverStore.save(drivers);
                    window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: target.driverId, available: false } }));
                }
            }

            window.dispatchEvent(new CustomEvent('driveease:booking-updated', { detail: { id, status: 'active', booking: target, type: 'advance' } }));
            return new Booking(target);
        },

        payBalance(id, { paymentMethod = 'UPI', txnId = null } = {}) {
            const list = this.getRaw();
            const target = list.find(b => String(b.id) === String(id));
            if (!target) return null;

            target.finalPaid = true;
            target.finalPaymentMethod = paymentMethod;
            target.finalTxnId = txnId || ('TXN-BAL-' + Date.now().toString().slice(-8));
            target.finalPaidAt = new Date().toISOString();
            target.status = 'completed';
            target.paymentStatus = 'paid';

            this.save(list);

            // Release vehicle & driver upon return & final settlement
            const vehicleId = target.vehicleId;
            if (vehicleId) {
                const hasOtherActive = list.some(b =>
                    b.vehicleId === vehicleId &&
                    String(b.id) !== String(id) &&
                    (b.status === 'confirmed' || b.status === 'active')
                );
                if (!hasOtherActive) {
                    VehicleStore.updateStatus(vehicleId, 'available');
                }
            }

            if (target.driverId) {
                const hasOtherActiveDriver = list.some(b =>
                    b.driverId === target.driverId &&
                    String(b.id) !== String(id) &&
                    (b.status === 'confirmed' || b.status === 'active')
                );
                if (!hasOtherActiveDriver) {
                    const drivers = DriverStore.getRaw();
                    const targetDriver = drivers.find(d => d.id === target.driverId);
                    if (targetDriver) {
                        targetDriver.available = true;
                        DriverStore.save(drivers);
                        window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: target.driverId, available: true } }));
                    }
                }
            }

            window.dispatchEvent(new CustomEvent('driveease:booking-updated', { detail: { id, status: 'completed', booking: target, type: 'balance' } }));
            return new Booking(target);
        },

        cancel(id) {
            return this.updateStatus(id, 'cancelled');
        },

        processRefund(id) {
            this.updateStatus(id, 'cancelled');
            const list = this.getRaw();
            const target = list.find(b => String(b.id) === String(id));
            if (target) {
                target.paymentStatus = 'refunded';
                target.refundedAt = new Date().toISOString();
                this.save(list);
                window.dispatchEvent(new CustomEvent('driveease:booking-refunded', { detail: target }));
                return target;
            }
            return null;
        },

        reject(id) {
            return this.updateStatus(id, 'rejected');
        },

        delete(id) {
            let list = this.getRaw();
            const target = list.find(b => String(b.id) === String(id));
            list = list.filter(b => String(b.id) !== String(id));
            this.save(list);

            if (target && (target.status === 'confirmed' || target.status === 'active')) {
                const vehicleId = target.vehicleId;
                if (vehicleId) {
                    const hasOtherActive = list.some(b =>
                        b.vehicleId === vehicleId &&
                        (b.status === 'confirmed' || b.status === 'active')
                    );
                    if (!hasOtherActive) {
                        VehicleStore.updateStatus(vehicleId, 'available');
                    }
                }
                if (target.driverId) {
                    const hasOtherActiveDriver = list.some(b =>
                        b.driverId === target.driverId &&
                        (b.status === 'confirmed' || b.status === 'active')
                    );
                    if (!hasOtherActiveDriver) {
                        const drivers = DriverStore.getRaw();
                        const targetDriver = drivers.find(d => d.id === target.driverId);
                        if (targetDriver) {
                            targetDriver.available = true;
                            DriverStore.save(drivers);
                            window.dispatchEvent(new CustomEvent('driveease:drivers-updated', { detail: { id: target.driverId, available: true } }));
                        }
                    }
                }
            }

            window.dispatchEvent(new CustomEvent('driveease:booking-deleted', { detail: { id } }));
            return true;
        }
    };

    const UserStore = {
        _key: 'driveease_users',
        _currentKey: 'driveease_current_user',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                let obj = saved ? JSON.parse(saved) : null;
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    let updated = false;
                    Object.keys(SEED_USERS).forEach(email => {
                        const key = email.toLowerCase().trim();
                        if (!obj[key]) {
                            obj[key] = { ...SEED_USERS[email] };
                            updated = true;
                        } else {
                            if (!obj[key].password && SEED_USERS[email].password) {
                                obj[key].password = SEED_USERS[email].password;
                                updated = true;
                            }
                            if (!obj[key].firstName && SEED_USERS[email].firstName) {
                                obj[key].firstName = SEED_USERS[email].firstName;
                                updated = true;
                            }
                            if (!obj[key].phone && SEED_USERS[email].phone) {
                                obj[key].phone = SEED_USERS[email].phone;
                                updated = true;
                            }
                        }
                    });
                    if (updated) this.save(obj);
                    return obj;
                }
            } catch (err) {}
            this.save(SEED_USERS);
            return { ...SEED_USERS };
        },

        save(usersObj) {
            try {
                localStorage.setItem(this._key, JSON.stringify(usersObj));
            } catch (err) {
                console.error('[UserStore] Save failed:', err);
            }
        },

        getByEmail(email) {
            if (!email) return null;
            const clean = String(email).toLowerCase().trim();
            const users = this.getAll();
            if (users[clean] && typeof users[clean] === 'object') return users[clean];

            // Auto-recovery from BookingStore if user made a booking previously
            try {
                if (typeof BookingStore !== 'undefined' && BookingStore.getAll) {
                    const bookings = BookingStore.getAll().filter(b => b && String(b.email || '').toLowerCase().trim() === clean);
                    if (bookings.length > 0) {
                        const latest = bookings[0];
                        const parts = String(latest.customer || 'Customer').trim().split(' ');
                        const firstName = parts[0] || 'Customer';
                        const lastName = parts.slice(1).join(' ') || '';
                        const recoveredUser = {
                            firstName,
                            lastName,
                            email: clean,
                            phone: latest.phone || '9876542345',
                            address: latest.pickup || 'Civil Lines, Mathura, Uttar Pradesh',
                            password: '12345678p',
                            createdAt: new Date(latest.createdAt || Date.now()).getTime()
                        };
                        this.saveUser(recoveredUser, false);
                        return recoveredUser;
                    }
                }
            } catch (e) {}

            return null;
        },

        saveUser(userData, autoLogin = false) {
            if (!userData || !userData.email) return false;
            const users = this.getAll();
            const emailKey = userData.email.toLowerCase().trim();
            const existing = users[emailKey] || {};
            users[emailKey] = {
                firstName: userData.firstName !== undefined ? userData.firstName : (existing.firstName || ''),
                lastName:  userData.lastName !== undefined ? userData.lastName : (existing.lastName || ''),
                email:     emailKey,
                phone:     userData.phone !== undefined ? userData.phone : (existing.phone || ''),
                address:   userData.address !== undefined ? userData.address : (existing.address || ''),
                password:  userData.password !== undefined ? userData.password : (existing.password || '12345678p'),
                createdAt: userData.createdAt || existing.createdAt || Date.now()
            };
            this.save(users);
            if (autoLogin) {
                this.setCurrentUser(emailKey);
            }
            return users[emailKey];
        },

        getCurrentUser() {
            const email = (localStorage.getItem(this._currentKey) || '').toLowerCase().trim();
            if (!email) return null;
            return this.getByEmail(email) || null;
        },

        setCurrentUser(email) {
            if (email) {
                localStorage.setItem(this._currentKey, email.toLowerCase().trim());
            } else {
                localStorage.removeItem(this._currentKey);
            }
        },

        logout() {
            localStorage.removeItem(this._currentKey);
            window.dispatchEvent(new CustomEvent('driveease:auth-changed', { detail: null }));
        }
    };

    const AdminStore = {
        _key: 'driveease_admins',
        _sessionKey: 'driveease_admin_session',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                const obj = saved ? JSON.parse(saved) : null;
                if (obj && Object.keys(obj).length > 0) {
                    // Auto-upgrade breached password 'admin123' to secure password
                    if (obj['admin@driveease.com'] && obj['admin@driveease.com'].password === 'admin123') {
                        obj['admin@driveease.com'].password = SEED_ADMINS['admin@driveease.com'].password;
                        this.save(obj);
                    }
                    return obj;
                }
            } catch (err) {}
            this.save(SEED_ADMINS);
            return SEED_ADMINS;
        },

        save(adminsObj) {
            try {
                localStorage.setItem(this._key, JSON.stringify(adminsObj));
            } catch (err) {
                console.error('[AdminStore] Save failed:', err);
            }
        },

        getByEmail(email) {
            if (!email) return null;
            const admins = this.getAll();
            return admins[email.toLowerCase().trim()] || null;
        },

        isAdmin(email) {
            if (!email) return false;
            return Boolean(this.getByEmail(email));
        },

        registerAdmin(adminData) {
            if (!adminData || !adminData.email) return { ok: false, message: 'Admin email is required' };
            const emailKey = adminData.email.toLowerCase().trim();
            const admins = this.getAll();
            if (admins[emailKey]) {
                return { ok: false, message: 'An admin account with this email already exists' };
            }
            const newAdmin = {
                email: emailKey,
                name: (adminData.name || '').trim() || 'Fleet Administrator',
                phone: (adminData.phone || '').trim(),
                adminId: (adminData.adminId || '').trim(),
                password: adminData.password || '',
                role: 'admin',
                createdAt: Date.now()
            };
            admins[emailKey] = newAdmin;
            this.save(admins);
            return { ok: true, admin: newAdmin };
        },

        validate(email, password) {
            if (!email) return { ok: false, reason: 'not_found' };
            const admin = this.getByEmail(email);
            if (!admin) return { ok: false, reason: 'not_found' };
            if (!admin.password || admin.password !== password) {
                return { ok: false, reason: 'invalid_password' };
            }
            return { ok: true, admin };
        },

        getCurrentAdmin() {
            try {
                const saved = localStorage.getItem(this._sessionKey);
                if (!saved) return null;
                const session = JSON.parse(saved);
                if (session && session.email && this.isAdmin(session.email)) {
                    return session;
                }
            } catch (e) {}
            return null;
        },

        setSession(adminData) {
            if (adminData && adminData.email) {
                const session = {
                    email: adminData.email.toLowerCase().trim(),
                    name: adminData.name || 'Fleet Administrator',
                    loggedInAt: Date.now()
                };
                localStorage.setItem(this._sessionKey, JSON.stringify(session));
                localStorage.setItem('driveease_admin_email', session.email);
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                    window.dispatchEvent(new CustomEvent('driveease:admin-auth-changed', { detail: session }));
                }
            } else {
                this.logout();
            }
        },

        logout() {
            localStorage.removeItem(this._sessionKey);
            localStorage.removeItem('driveease_admin_email');
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('driveease:admin-auth-changed', { detail: null }));
            }
        }
    };

    const MessageStore = {
        _key: 'driveease_messages',

        getAll() {
            try {
                const saved = localStorage.getItem(this._key);
                const raw = saved ? JSON.parse(saved) : null;
                if (Array.isArray(raw) && raw.length > 0) return raw;
            } catch (err) {}
            this.save(SEED_MESSAGES);
            return SEED_MESSAGES;
        },

        save(list) {
            try {
                localStorage.setItem(this._key, JSON.stringify(list));
            } catch (err) {
                console.error('[MessageStore] Save failed:', err);
            }
        },

        add(msg) {
            const list = this.getAll();
            const item = {
                name: msg.name || 'Anonymous',
                email: msg.email || '',
                message: msg.message || '',
                date: msg.date || new Date().toISOString(),
                read: false
            };
            list.unshift(item);
            this.save(list);
            window.dispatchEvent(new CustomEvent('driveease:message-added', { detail: item }));
            return item;
        },

        markRead(index) {
            const list = this.getAll();
            if (list[index]) {
                list[index].read = true;
                this.save(list);
                window.dispatchEvent(new CustomEvent('driveease:messages-updated'));
            }
        },

        markAllRead() {
            const list = this.getAll().map(m => ({ ...m, read: true }));
            this.save(list);
            window.dispatchEvent(new CustomEvent('driveease:messages-updated'));
        },

        delete(index) {
            const list = this.getAll();
            if (index >= 0 && index < list.length) {
                list.splice(index, 1);
                this.save(list);
                window.dispatchEvent(new CustomEvent('driveease:messages-updated'));
            }
        }
    };

    /* ── Global Nav Auth Bar Sync ── */

    function syncNavAuthButtons() {
        const currentUser = UserStore.getCurrentUser();
        const navAuthButtons = document.querySelectorAll('#navAuthBtn, .nav-auth-btn');

        navAuthButtons.forEach(btn => {
            if (currentUser) {
                btn.textContent = 'Sign out';
                btn.className = 'btn btn-outline btn-small nav-auth-btn';
                btn.href = '#';
                btn.title = `Signed in as ${currentUser.firstName || currentUser.email}`;
                btn.onclick = function(e) {
                    e.preventDefault();
                    UserStore.logout();
                    window.location.href = 'login.html';
                };
            } else {
                btn.textContent = 'Login';
                btn.className = 'btn btn-primary btn-small nav-auth-btn';
                btn.href = 'login.html';
                btn.onclick = null;
            }
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', syncNavAuthButtons);
        } else {
            syncNavAuthButtons();
        }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('driveease:auth-changed', syncNavAuthButtons);
    }

    /* ════════════════════════════════════════════
       7. THEME MANAGER (Light / Dark Mode)
    ════════════════════════════════════════════ */
    const ThemeManager = {
        STORAGE_KEY: 'driveease_theme',
        get() {
            try {
                if (typeof localStorage !== 'undefined') {
                    const saved = localStorage.getItem(this.STORAGE_KEY);
                    if (saved === 'dark' || saved === 'light') return saved;
                }
            } catch(e) {}
            if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
            return 'light';
        },
        set(theme) {
            const isDark = theme === 'dark';
            if (typeof document !== 'undefined') {
                if (isDark) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(this.STORAGE_KEY, isDark ? 'dark' : 'light');
                }
            } catch(e) {}
            this.updateButtons(isDark ? 'dark' : 'light');
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('driveease:theme-changed', { detail: { theme: isDark ? 'dark' : 'light' } }));
            }
        },
        toggle() {
            const next = this.get() === 'dark' ? 'light' : 'dark';
            this.set(next);
            return next;
        },
        updateButtons(theme) {
            if (typeof document === 'undefined') return;
            const isDark = theme === 'dark';
            const icon = isDark ? '☀️' : '🌙';
            const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
            document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
                btn.setAttribute('aria-label', label);
                btn.setAttribute('title', label);
                btn.textContent = icon;
            });
        },
        init() {
            const current = this.get();
            if (typeof document !== 'undefined') {
                if (current === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                this.updateButtons(current);
            }
        }
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => ThemeManager.init());
        } else {
            ThemeManager.init();
        }
        document.addEventListener('click', (e) => {
            const btn = e.target.closest && e.target.closest('.theme-toggle-btn');
            if (btn) {
                e.preventDefault();
                ThemeManager.toggle();
            }
        });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', (e) => {
            if (e.key === 'driveease_theme') {
                const newTheme = e.newValue === 'dark' ? 'dark' : 'light';
                if (typeof document !== 'undefined') {
                    if (newTheme === 'dark') {
                        document.documentElement.setAttribute('data-theme', 'dark');
                    } else {
                        document.documentElement.removeAttribute('data-theme');
                    }
                    ThemeManager.updateButtons(newTheme);
                }
            }
        });
    }

    /* ── Expose API on window.DriveEase ── */

    window.DriveEase = {
        DRIVER_RATE,
        formatMoney,
        formatDate,
        Vehicle,
        Driver,
        Booking,
        VehicleStore,
        DriverStore,
        UserStore,
        AdminStore,
        BookingStore,
        MessageStore,
        ThemeManager,
        toggleTheme: () => ThemeManager.toggle(),
        getTheme:    () => ThemeManager.get(),

        // Live getters for full backwards compatibility
        get vehicles() { return VehicleStore.getAll(); },
        get drivers()  { return DriverStore.getAll(); },

        // Helper shortcuts
        getVehicles:   () => VehicleStore.getAll(),
        getDrivers:    () => DriverStore.getAll(),
        getCurrentUser:() => UserStore.getCurrentUser(),
        setCurrentUser: email => UserStore.setCurrentUser(email),
        getCurrentAdmin:() => AdminStore.getCurrentAdmin(),
        isAdmin:       email => AdminStore.isAdmin(email),
        registerAdmin: adminData => AdminStore.registerAdmin(adminData),
        logout:        () => UserStore.logout(),
        logoutAdmin:   () => AdminStore.logout()
    };

    // Ensure all default data stores exist in localStorage
    try {
        if (typeof localStorage !== 'undefined') {
            VehicleStore.getAll();
            DriverStore.getAll();
            BookingStore.getAll();
            UserStore.getAll();
            AdminStore.getAll();
        }
    } catch (e) {}

})();
