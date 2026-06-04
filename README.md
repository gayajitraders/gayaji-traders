# Gaya Ji Traders - Premium Home & Kitchen Appliances Hub

Gaya Ji Traders is a modern, high-performance E-Commerce application designed to sell premium electronics, smart TVs, kitchen appliances, and home utilities. The codebase includes a robust Node.js/Express backend, an interactive single-page application (SPA) frontend built with vanilla HTML5, CSS3, and JavaScript, and advanced security configurations.

---

## 🚀 Key Features

1. **Premium Electronics Rebranding**: Fully curated for home appliances (fridges, smart TVs, washing machines, robotic vacuum cleaners, air purifiers, air fryers).
2. **Dynamic Shopping Experience**: Real-time basket calculations, coupon codes validation, search querying, and catalog sorting.
3. **Advanced Admin Dashboard**:
   - **Order management**: Confirm, process, ship, or deliver orders.
   - **Delivery Assignment & Custom Contacts**: Assign orders to delivery personnel and specify/modify their contact phone numbers directly.
   - **Security Credentials Form**: Secure email and password updates for admins directly from the dashboard.
   - **UPI Business Settings**: Change payout account numbers, merchant phones, and upload UPI QR codes dynamically.
4. **Order Cancellation Policies**: Automated customer cancellation window restricted to 2 hours of placement.
5. **Robust OTP Verification Center**:
   - **Registration verification**: 4-digit mobile verification code flow.
   - **Admin Transfer 2FA Verification**: 6-digit email confirmation code dispatched to the target user's email before transferring owner rights.
6. **Strict Role Security**: Strictly enforces single-active-admin constraints across user registries.

---

## 🛠️ Technology Stack

* **Frontend**: Vanilla HTML5, CSS3 (harmony dark modes, dynamic layouts), Modern JS (ES6+).
* **Backend**: Node.js, Express.js, JWT Authentication, bcryptjs.
* **Database**: Lightweight File-based JSON Database (`localDb.js`) located in `backend/data/`.
* **Deployment**: Docker, Google Cloud Run, Google Search Sitemap (`sitemap.xml`).

---

## 💻 Local Development Setup

To run the application locally, follow these steps:

### 1. Install Dependencies
Open your terminal in the `backend` directory and run:
```bash
cd backend
npm install
```

### 2. Start the Server
Start the Express server using node:
```bash
node server.js
```
The server will boot up and listen on port `5000`:
`Server is running on port 5000`

### 3. Open in Browser
Open your browser and navigate to:
[http://localhost:5000](http://localhost:5000)

* **Demo Accounts** are provided on the login page for Customer, Delivery Boy, and Admin access.

---

## ☁️ Google Cloud Run Deployment

Google Cloud Run is a fully managed serverless platform perfect for running this containerized Express backend.

To deploy the app to Google Cloud:

1. **Install GCloud CLI**: Ensure you have the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and configured on your machine.
2. **Build and Deploy**: Run the following command from the root directory of this repository:
   ```bash
   gcloud run deploy gayaji-traders --source . --port 5000 --allow-unauthenticated --region us-central1
   ```
3. Once completed, Google Cloud Run will return your live HTTPS URL (e.g. `https://gayaji-traders-xyz.a.run.app`).

---

## 🔍 Registering on Google Search Console

To make your website searchable on Google:

1. **Configure Custom Domain**: Link your custom domain (e.g., `gayajitraders.com`) in your Google Cloud Run settings.
2. **Register on Search Console**: Go to [Google Search Console](https://search.google.com/search-console) and add your custom domain URL prefix.
3. **Submit the Sitemap**: Go to the **Sitemaps** section in the console and submit:
   `sitemap.xml`
   (The crawler will read `/sitemap.xml` which is configured in `frontend/sitemap.xml`).
4. **Request Indexing**: Inspect your homepage URL in the Search Console search bar and click "Request Indexing" to trigger immediate indexing.
