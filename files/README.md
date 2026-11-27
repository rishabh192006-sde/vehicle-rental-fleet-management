# 🚗 DriveEase — Vehicle Rental Platform

> A lightweight, modern vehicle rental platform for two-wheelers and four-wheelers with optional professional driver services, persistent state management, real-time analytics, and an integrated fleet admin dashboard.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Project Architecture](#-project-architecture)
- [File Structure](#-file-structure)
- [Pages & User Flows](#-pages--user-flows)
  - [1. Public & Fleet Browsing](#1-public--fleet-browsing)
  - [2. Vehicle Detail Pages](#2-vehicle-detail-pages)
  - [3. Booking Workflow](#3-booking-workflow)
  - [4. Customer Dashboard](#4-customer-dashboard)
  - [5. Fleet Admin Dashboard](#5-fleet-admin-dashboard)
  - [6. Authentication & Registration](#6-authentication--registration)
  - [7. Contact & Support](#7-contact--support)
- [Data Layer & State Management](#-data-layer--state-management)
- [Demo Credentials](#-demo-credentials)
- [Getting Started](#-getting-started)
- [Browser Support](#-browser-support)

---

## 🌟 Overview

**DriveEase** provides a full end-to-end car and bike rental experience running completely in the browser without requiring external database dependencies. It uses a reactive Object-Oriented JavaScript data layer backed by `localStorage` with seed data, real-time custom event dispatchers, and live cross-tab synchronization.

---

## ✨ Key Features

- **Fleet Catalog & Filtering**:
  - Filter by category (**All Vehicles**, **Cars & SUVs**, **Bikes & Scooters**, **Available Only**).
  - Debounced real-time text search by vehicle name, category, transmission, and fuel type.
  - Live status indicators (**Available**, **Booked**, **Maintenance**) synchronized with the admin panel.
- **Flexible Rental Modes**:
  - **Self-Drive / Self-Ride**: Rent cars, bikes, and scooters for 1 to 30 days.
  - **With a Professional Driver**: Option to add a verified driver (+₹800/day) across all vehicles including cars, SUVs, bikes, and scooters.
- **Live Price Calculator**:
  - Dynamic pricing updates immediately on duration change and driver selection.
  - Transparent rate breakdowns and estimated totals in Indian Rupees (₹).
- **Integrated Payment Gateway (DriveEase Pay)**:
  - Embedded secure checkout supporting **UPI** (QR code, GPay, PhonePe, Paytm, BHIM, UPI ID), **Credit/Debit Cards** (Visa, Mastercard, RuPay), and **Net Banking** (top Indian banks).
  - Simulated 3D Secure / Bank OTP authorization workflow with real-time verification and transaction references (`TXN-DE-...`).
  - Automatic inventory locking upon payment confirmation.
  - Official printable **Rental Tax Invoice & Receipt** with itemized vehicle, chauffeur, and GST breakdowns.
  - Administrator refund processing and revenue breakdown by payment method.
- **Customer Dashboard**:
  - Overview cards: Total Bookings, Active Rentals, Lifetime Spend, and Member Since.
  - Interactive booking modal with status badge indicators and a **Cancel Booking** capability for active/pending reservations.
- **Fleet Admin Management Suite**:
  - **Fleet Tab**: Change vehicle status (`Available` / `Booked` / `Maintenance`) on the fly.
  - **Bookings Tab**: Manage the full booking lifecycle (`Pending`, `Confirmed`, `Active`, `Completed`, `Cancelled`, `Rejected`), approve/reject requests with one-click actions, or delete records.
  - **Customers Tab**: Aggregated customer lifetime value (LTV) and booking count.
  - **Revenue Tab**: Financial breakdown, average order value (AOV), top vehicle badge, and interactive CSS bar chart.
  - **Drivers Tab**: Manage driver roster (toggle availability, add new driver, remove, search).
  - **Messages Tab**: View contact inquiries, filter by read/unread, and mark as read.
- **Form Validation Engine**:
  - Real-time input cleaning and sanitization.
  - Indian mobile number rules (10 digits starting with 6–9).
  - Date validation enforcing minimum date as today.
  - Live password confirmation match feedback.
- **Session & Auth Management**:
  - Customer registration & login with credential lookups.
  - Header sign-in/sign-out buttons update automatically across all pages.
- **Light & Dark Theme Toggle**:
  - One-click theme toggle button (`🌙` / `☀️`) available in the navigation header across all pages.
  - Persisted in `localStorage` (`driveease_theme`) with automatic system preference fallback (`prefers-color-scheme: dark`).
  - Instant zero-flash `<head>` pre-loader and live cross-tab synchronization.

---

## 🏗️ Project Architecture

```
[HTML5 Pages] ───> [validate.js (Form Validation)]
      │
      ├───> [data.js (DriveEase Data Layer)]
      │         ├── VehicleStore  <──> localStorage('driveease_vehicles')
      │         ├── DriverStore   <──> localStorage('driveease_drivers')
      │         ├── BookingStore  <──> localStorage('driveease_bookings')
      │         ├── UserStore     <──> localStorage('driveease_users')
      │         └── MessageStore  <──> localStorage('driveease_messages')
      │
      ├───> [vehicles.js (Catalog, Search & Filter)]
      ├───> [booking.js (Pricing Calculator & Booking Submission)]
      └───> [fleet-admin.js (Admin Management & Revenue Analytics)]
```

---

## 📁 File Structure

| File | Description |
| :--- | :--- |
| [`index.html`](file:///e:/files/index.html) | Homepage with hero section, statistics, popular vehicles, and call-to-actions. |
| [`vehicles.html`](file:///e:/files/vehicles.html) | Complete vehicle fleet with search, category filtering, and driver grid. |
| [`vehicles.js`](file:///e:/files/vehicles.js) | Driver rendering, live search, category filtering, and status synchronization. |
| [`booking.html`](file:///e:/files/booking.html) | Booking form with vehicle selection, duration, driver toggle, and live price summary. |
| [`booking.js`](file:///e:/files/booking.js) | Dynamic vehicle/driver population, price calculation, auto-fill, and booking creation. |
| [`customer.html`](file:///e:/files/customer.html) | Customer dashboard displaying profile, booking history, statistics, and cancellation modal. |
| [`fleet-admin.html`](file:///e:/files/fleet-admin.html) | Administrative dashboard with fleet, booking, customer, revenue, driver, and message tabs. |
| [`fleet-admin.js`](file:///e:/files/fleet-admin.js) | Admin business logic, vehicle/booking state controls, revenue charts, and driver management. |
| [`login.html`](file:///e:/files/login.html) | Dual-role login page for Customers and Fleet Admins. |
| [`register.html`](file:///e:/files/register.html) | Customer registration page with password confirmation and instant profile setup. |
| [`admin_login.html`](file:///e:/files/admin_login.html) | Direct redirect shortcut to `login.html?role=admin`. |
| [`contact.html`](file:///e:/files/contact.html) | Contact page with inquiry form that saves directly into `MessageStore`. |
| [`data.js`](file:///e:/files/data.js) | Shared data layer: classes, persistent stores, demo seed data, and auth helpers. |
| [`validate.js`](file:///e:/files/validate.js) | Lightweight client-side form validation and input sanitization library. |
| [`style.css`](file:///e:/files/style.css) | Global stylesheet containing responsive layouts, cards, forms, tables, and badges. |
| [`vehicle-activa.html`](file:///e:/files/vehicle-activa.html) | Vehicle detail page for Honda Activa 6G (Two-wheeler). |
| [`vehicle-classic350.html`](file:///e:/files/vehicle-classic350.html) | Vehicle detail page for Royal Enfield Classic 350 (Two-wheeler). |
| [`vehicle-creta.html`](file:///e:/files/vehicle-creta.html) | Vehicle detail page for Hyundai Creta SUV (Four-wheeler). |
| [`vehicle-nexon.html`](file:///e:/files/vehicle-nexon.html) | Vehicle detail page for Tata Nexon SUV (Four-wheeler). |
| [`vehicle-swift.html`](file:///e:/files/vehicle-swift.html) | Vehicle detail page for Maruti Swift Hatchback (Four-wheeler). |

---

## 🖥️ Pages & User Flows

### 1. Public & Fleet Browsing
- Navigate the fleet on [`vehicles.html`](file:///e:/files/vehicles.html).
- Type in the search box to find vehicles by name, fuel, or transmission.
- Click category tabs (**Cars & SUVs**, **Bikes & Scooters**, **Available Only**) to filter cards instantly.
- Drivers are listed at the bottom with a direct **Book with [Driver]** shortcut button.

### 2. Vehicle Detail Pages
- Dedicated overview pages displaying vehicle specifications, features, engine capacity, and rental options:
  - [`vehicle-activa.html`](file:///e:/files/vehicle-activa.html)
  - [`vehicle-classic350.html`](file:///e:/files/vehicle-classic350.html)
  - [`vehicle-creta.html`](file:///e:/files/vehicle-creta.html)
  - [`vehicle-nexon.html`](file:///e:/files/vehicle-nexon.html)
  - [`vehicle-swift.html`](file:///e:/files/vehicle-swift.html)
- Real-time status badge reflects vehicle availability from the admin data layer.

### 3. Booking Workflow
- Visit [`booking.html`](file:///e:/files/booking.html) directly or with pre-fill parameters:
  - `booking.html?vehicle=creta`
  - `booking.html?vehicle=creta&driver=1&driverId=d1`
- Customer name, email, and phone auto-populate if signed in.
- Choosing a two-wheeler automatically disables driver selection with an explanatory message.
- Submitting saves the booking request as `Pending Approval` in `BookingStore` and redirects to the customer dashboard.
- The vehicle is only officially locked as `Booked` once the Fleet Administrator reviews and clicks **Confirm** in the Admin Dashboard.

### 4. Customer Dashboard
- Access [`customer.html`](file:///e:/files/customer.html) to review active and pending bookings.
- Shows current status badges: `Pending Approval` (amber) until approved, and `Confirmed` (green) once approved by the administrator.
- Active and pending bookings provide a **Cancel Booking** button.

### 5. Fleet Admin Dashboard
- Access [`fleet-admin.html`](file:///e:/files/fleet-admin.html) or log in via [`admin_login.html`](file:///e:/files/admin_login.html).
- **Fleet**: Toggle vehicle statuses directly in the table.
- **Bookings**: Review incoming customer requests with one-click **✓ Confirm** approval, or set status to `Confirmed`, `Active`, `Completed`, or `Cancelled`. Vehicle inventory automatically updates upon confirmation.
- **Revenue**: View gross revenue, average booking value, and earnings per vehicle in an interactive bar chart.
- **Drivers**: Toggle driver availability (`Available` vs `On a trip`), add new drivers, or delete drivers.
- **Messages**: Read customer inquiries submitted from [`contact.html`](file:///e:/files/contact.html).

### 6. Authentication & Registration
- Sign in on [`login.html`](file:///e:/files/login.html) using Customer or Admin tabs.
- New customers can register on [`register.html`](file:///e:/files/register.html) with password matching and profile persistence, then are redirected to [`login.html`](file:///e:/files/login.html) with their email pre-filled and a success notification.

---

## 💾 Data Layer & State Management

The core state layer is encapsulated in [`data.js`](file:///e:/files/data.js) and accessible globally via `window.DriveEase`:

```javascript
window.DriveEase = {
    DRIVER_RATE,      // ₹800 per day
    formatMoney,      // Formats numbers into ₹ INR
    formatDate,       // Formats ISO timestamps
    Vehicle,          // Vehicle OOP Model
    Driver,           // Driver OOP Model
    Booking,          // Booking OOP Model
    VehicleStore,     // LocalStorage store for vehicles
    DriverStore,      // LocalStorage store for drivers
    UserStore,        // LocalStorage store for user profiles
    BookingStore,     // LocalStorage store for bookings
    MessageStore,     // LocalStorage store for contact inquiries
    vehicles,         // Live getter returning current Vehicle instances
    drivers           // Live getter returning current Driver instances
};
```

### Event System
Changes in stores dispatch custom events allowing disparate components to re-render in real time:
- `driveease:vehicles-updated`
- `driveease:drivers-updated`
- `driveease:booking-added`
- `driveease:booking-updated`
- `driveease:booking-deleted`
- `driveease:message-added`
- `driveease:messages-updated`
- `driveease:auth-changed`

---

## 🔑 Demo Credentials

The platform is pre-loaded with sample accounts and data for testing:

### Customer Accounts
- **Primary Customer**: `rdrbundela@gmail.com` / `12345678p` (Name: Rudra Bundela, Phone: 9876542345, Address: Civil Lines, Mathura)
- **Account 2**: `rudra@example.com` / `12345678p` (Name: Rudra Sharma, Phone: 9876543210)
- **Account 3**: `priya@example.com` / `12345678p` (Name: Priya Patel, Phone: 9123456789)
- *Password*: `12345678p` (or any valid password meeting registration criteria).

### Fleet Admin Account (Restricted & Self-Service)
- **Pre-seeded Admin**: `admin@driveease.com` / `Admin@DriveEase2026`
- **Self-Service Registration**: New administrators can register their account directly via [`admin_register.html`](file:///e:/files/admin_register.html) with their full name, admin email, and secure password.
- **Strict Registration Flow**: Upon registering, the system does not auto-login; the administrator is automatically redirected to the Admin login screen with their email pre-filled to authenticate securely.
- **Access Control**: Customer accounts cannot access the Admin dashboard. Attempting to sign in to Admin using customer credentials or directly opening `fleet-admin.html` without admin authentication is blocked and redirected to the login page.
- **Admin URLs**:
  - Registration: [`admin_register.html`](file:///e:/files/admin_register.html)
  - Login: [`login.html?role=admin`](file:///e:/files/login.html?role=admin) or [`admin_login.html`](file:///e:/files/admin_login.html)

---

## 🚀 Getting Started

Since DriveEase is a pure front-end web application with zero external build tools or runtime dependencies, you can run it using any static file server:

### Option 1: Python
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Option 2: Node.js (npx serve / live-server)
```bash
npx serve .
```

### Option 3: Direct File Opening
Double-click [`index.html`](file:///e:/files/index.html) to open it directly in modern browsers (Chrome, Edge, Firefox, Safari).

---

## 🌐 Browser Support

- Google Chrome (version 90+)
- Microsoft Edge (version 90+)
- Mozilla Firefox (version 88+)
- Apple Safari (version 14+)
