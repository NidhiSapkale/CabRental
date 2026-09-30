# CabRental — Blockchain-Powered Vehicle Rental Platform

A peer-to-peer vehicle rental platform where bookings, payments, deposits, and rental history are secured using blockchain technology — making every transaction transparent, tamper-proof, and independently verifiable. Built as a mini project for the **Blockchain Technology** course.

---

## 📌 Problem Statement

Traditional vehicle rental platforms rely on a central authority to manage bookings, hold deposits, and record rental history. This creates a trust gap — users have no way to independently verify that:
- Their deposit was calculated and refunded fairly
- A vehicle's rental history hasn't been quietly altered
- Rating/reputation data hasn't been manipulated by the platform

CabRental solves this by moving the core trust-sensitive logic — pricing, deposits, penalties, and reputation — onto an Ethereum smart contract, where it's enforced by code rather than a company's word.

## 🤔 Why Blockchain?

A fair question: would people really want to pay in cryptocurrency to rent a cab? Realistically, no — and that's not the point of this project. The value blockchain brings here is **not the payment rail, it's transparency and tamper-proof record-keeping**:

- No single party (not even the platform owner) can quietly edit past rental records
- Deposit refunds and late-return penalties are calculated by contract logic, not a human who might act unfairly
- Every booking and rating is permanently and publicly verifiable on Sepolia Etherscan

A real production version of this idea would likely use a **hybrid model**: regular fiat payment (UPI/card) for the actual money movement, with the *record* of that transaction anchored on-chain for auditability. This project intentionally uses real on-chain ETH payments throughout, since demonstrating genuine smart contract mechanics is the goal of the assignment — the UI, however, deliberately does not expose "you're paying in ETH" language, instead presenting it as a blockchain-secured digital ticket, similar to how a real product might.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend / Database | Firebase (Authentication + Firestore) |
| Smart Contract | Solidity, deployed on Sepolia testnet |
| Blockchain Interaction | Ethers.js v6 + MetaMask |
| Contract Development/Deployment | Remix IDE |
| Hosting | Vercel |

---

## ✨ Features

- **User authentication** — Firebase email/password login and signup
- **Vehicle listing** — any connected wallet can list a vehicle on-chain (`listVehicle`), with price and deposit set in ETH
- **Vehicle images** — uploaded and stored as compressed base64 strings directly in Firestore (no paid storage service required)
- **INR-first pricing** — prices are shown in ₹ for usability, converted live from ETH via CoinGecko, while the actual payment still happens on-chain in ETH
- **Booking flow** — renting a vehicle (`rentVehicle`) locks payment + deposit in the smart contract; pickup and drop-off locations are chosen from real Thane West landmarks
- **Auto-calculated drop-off window** — based on pickup time + rental duration, shown as a realistic time range rather than a rigid timestamp
- **Return flow** — returning a vehicle (`returnVehicle`) automatically calculates and deducts any late-return penalty, then refunds the remaining deposit — all enforced by the contract, not the frontend
- **Blockchain ticket confirmation** — every booking generates a ticket-style confirmation with a QR code linking directly to the transaction on Sepolia Etherscan, so both renter and owner can independently verify it
- **Owner dashboard ("My Vehicles")** — vehicle owners can see every vehicle they've listed and every booking made on them, in the same ticket format renters see
- **On-chain rating system** — after a completed rental, both renter and owner can rate each other (`rateUser`); ratings are permanent and cannot be edited or deleted by either party
- **Late-return penalty display** — active bookings show a live-updating penalty estimate if a rental is overdue

---

## 📜 Smart Contract Functions

| Function | Purpose |
|---|---|
| `listVehicle(model, pricePerDay, deposit)` | Registers a new vehicle on-chain |
| `rentVehicle(vehicleId, numDays)` | Locks payment + deposit, starts a rental |
| `returnVehicle(vehicleId)` | Calculates penalty (if late), refunds remaining deposit, pays owner |
| `calculatePenalty(vehicleId)` | Returns the current penalty amount for an overdue rental |
| `rateUser(user, score)` | Records a 1–5 rating for another user |
| `getAverageRating(user)` | Returns a user's average rating |
| `getVehicle(vehicleId)` | Returns a vehicle's owner, model, price, deposit, and availability |
| `getRental(vehicleId)` | Returns a rental's renter, timestamps, and active status |

---

## 🚀 Running Locally

```bash
git clone https://github.com/NidhiSapkale/CabRental.git
cd CabRental
npm install
```

Create a local environment file from the placeholder template:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead. Fill in `.env` with configuration for services and deployments you control. Do not commit `.env`.

### Firebase setup

1. Create a Firebase project and register a Web app in that project.
2. Copy that Web app's Firebase config into the matching `VITE_FIREBASE_*` entries in `.env`. The app uses the API key, auth domain, project ID, storage bucket, messaging sender ID, and app ID. It does not currently use Firebase Analytics or a measurement ID.
3. In Firebase Authentication, enable the Email/Password sign-in provider.
4. Create a Cloud Firestore database and configure Firestore security rules for your app before using real data.

The `VITE_FIREBASE_*` values are browser configuration: Vite includes them in the built frontend, so they are not secrets. Use your own Firebase project and secure it with Firebase rules and appropriate API-key restrictions. Never put Admin SDK credentials or service-account keys in a `VITE_` variable.

**Security note:** This app currently reads all vehicle and booking documents in the owner dashboard and performs some Firestore updates directly from the browser. Client-side filtering and login checks are not access control, and Firestore rules cannot use them to safely restrict those broad queries. Do not use the app with real personal data or an open/test-mode database until the queries and writes are redesigned around verified ownership and the deployed rules enforce it. Do not copy the Firebase quick-start rule that temporarily allows all reads and writes.

### Sepolia and MetaMask setup

1. Install MetaMask and add/select the Sepolia test network.
2. Set `VITE_CONTRACT_ADDRESS` in `.env` to the address of a contract deployed on Sepolia that implements the functions in `src/contract.js`'s ABI. This repository does not include Solidity source or deployment scripts, so you need an existing compatible deployment or must deploy one separately.
3. Fund the MetaMask account with Sepolia test ETH. Listing, renting, returning, and rating vehicles require wallet transactions and test ETH for gas; rental transactions also send the contract's required payment and deposit.

Never enter or store a wallet private key or recovery phrase in this project. MetaMask should handle transaction signing.

### Start the app

```bash
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). If you change `.env` while the dev server is running, restart it. To verify a production build, run `npm run build`.

---

## 🌐 Live Deployment

Deployed on Vercel: _[cabrental.vercel.app]_

Smart contract deployed on Sepolia: _[(https://sepolia.etherscan.io/address/0xD15ce1ed4A7355a828d00ce4546F6A7835BCA3AB)]_

---

## 🔮 Future Scope

- Hybrid payment model: fiat payment for the transaction, with only the record hashed on-chain, for real-world usability
- Multi-city support with expanded pickup/drop location sets
- Mobile app version
- Admin moderation tools for disputed rentals

---

## 👤 Author

Built by Nidhi as a mini project for the Blockchain Technology course, final year Computer Science.
