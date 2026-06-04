# Gaya Ji Traders - Premium Home & Kitchen Appliances Hub

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gayajitraders/gayaji-traders)

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
* **Database**: Hybrid Database (Lightweight File-based JSON Database or Cloud MongoDB Atlas).
* **Deployment**: Docker, Google Cloud Run, Google Search Sitemap (`sitemap.xml`).

---

## 💻 Local Development Setup

To run the application locally, follow these steps:

### 1. Install Dependencies
Open your terminal in the root directory and run:
```bash
npm run install-all
```
*(This will automatically install all node modules for the backend).*

### 2. Start the Server
Start the Express server directly from the root directory:
```bash
npm start
```
The server will boot up and listen on port `5000`:
`Server is running on port 5000`

### 3. Open in Browser
Open your browser and navigate to:
[http://localhost:5000](http://localhost:5000)

* **Demo Accounts** are provided on the login page for Customer, Delivery Boy, and Admin access.

---

## 🗄️ Database Configurations (Advance Level)

The database layer supports **hybrid storage** for seamless development and production deployment:
* **Local Mode (Default)**: If no environment variable is provided, the database runs locally on JSON files inside `backend/data/`. No setup is required.
* **Production Mode (MongoDB Atlas)**: To persist data in a cloud database, set the `MONGODB_URI` environment variable. The backend will automatically sync and persist all records (users, products, orders, coupons, settings) to your MongoDB Atlas cluster in the background.

---

## ☁️ Google Cloud Run Deployment

Google Cloud Run is a fully managed serverless platform perfect for running this containerized Express backend.

To deploy the app to Google Cloud:

1. **Install GCloud CLI**: Ensure you have the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed and configured on your machine.
2. **Build and Deploy**: Run the following command from the root directory of this repository:
   ```bash
   gcloud run deploy gayaji-traders --source . --allow-unauthenticated --region us-central1
   ```
   *(The Dockerfile will dynamically bind to the port assigned by Google Cloud Run, usually `8080`).*
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
