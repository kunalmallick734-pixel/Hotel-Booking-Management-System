# Roomzy Backend — Express.js + TypeScript REST API

Production-ready backend API for **Roomzy** hotel booking system built with **Express.js**, **TypeScript**, **Mongoose (MongoDB Atlas)**, and **Razorpay**.

## 🚀 Features
- **Authentication**: JWT in secure HTTP-only cookies + bcrypt password hashing.
- **Hotel Management**: Full CRUD, multipart image uploads to Cloudinary, geolocation indexing.
- **Payment Processing**: Full Razorpay integration with Orders API, HMAC-SHA256 signature verification, and automated refunds.
- **Database Seeding**: Populates 52 authentic Varanasi hotels, sample reviews, bookings, and analytics (`npm run seed`).
- **Swagger Documentation**: Interactive API documentation available at `/api/docs`.

## 📦 Scripts
```powershell
npm run dev     # Start development server with nodemon
npm run build   # Build TypeScript bundle
npm run seed    # Wipe and seed MongoDB with 52 Varanasi hotels
```
