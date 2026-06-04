const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const localDb = require('./localDb');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Seeding Initial Data
function seedDatabase() {
  // 1. Seed Users
  const users = localDb.find('users');
  if (users.length === 0) {
    console.log('Seeding initial users...');
    const salt = bcrypt.genSaltSync(10);
    
    // Admin
    localDb.insert('users', {
      name: 'Gaya Ji Admin',
      email: 'admin@gayaji.com',
      phone: '6207342872',
      passwordHash: bcrypt.hashSync('admin123', salt),
      role: 'admin',
      addresses: []
    });

    // Delivery Boy
    localDb.insert('users', {
      name: 'Ramesh Kumar (Delivery)',
      email: 'delivery@gayaji.com',
      phone: '8765432109',
      passwordHash: bcrypt.hashSync('delivery123', salt),
      role: 'delivery',
      addresses: []
    });

    // Customer
    localDb.insert('users', {
      name: 'Amit Sharma',
      email: 'amit@gmail.com',
      phone: '7654321098',
      passwordHash: bcrypt.hashSync('customer123', salt),
      role: 'customer',
      addresses: [
        {
          id: 'addr1',
          name: 'Amit Sharma',
          addressLine: '12, GB Road, Near Vishnupad Temple',
          city: 'Gaya',
          state: 'Bihar',
          pincode: '823001',
          phone: '7654321098',
          isDefault: true
        }
      ]
    });
  }

  // 2. Seed Products
  const products = localDb.find('products');
  if (products.length === 0) {
    console.log('Seeding initial products...');
    const defaultProducts = [
      {
        name: 'Premium Double-Door Smart Refrigerator (450L)',
        description: 'High-efficiency double door refrigerator with smart Wi-Fi connection, inverter compressor, and sleek black steel finish.',
        price: 38999,
        category: 'Home Appliances',
        imageUrl: 'https://images.unsplash.com/photo-1571843439991-dd2b8e051966?w=500',
        stock: 15,
        rating: 4.8,
        reviews: []
      },
      {
        name: 'Professional Digital Air Fryer (5.5L)',
        description: 'Cook with 90% less oil. Touchscreen control with 8 presets, 1500W heating, and dishwasher safe basket.',
        price: 6499,
        category: 'Kitchen Appliances',
        imageUrl: 'https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=500',
        stock: 30,
        rating: 4.7,
        reviews: []
      },
      {
        name: 'Super-Silent Mixer Grinder (750W)',
        description: 'Heavy duty copper motor with 3 stainless steel jars. Smart hands-free operation and pulse controls.',
        price: 4299,
        category: 'Kitchen Appliances',
        imageUrl: 'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=500',
        stock: 22,
        rating: 4.5,
        reviews: []
      },
      {
        name: '4K Ultra HD Smart LED TV (55")',
        description: 'Cinematic experience with Dolby Vision, HDR10+, 60W sound output, and Google TV built-in.',
        price: 41999,
        category: 'Smart Living',
        imageUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=500',
        stock: 10,
        rating: 4.9,
        reviews: []
      },
      {
        name: 'Front-Load Fully Automatic Washing Machine (8kg)',
        description: 'Inbuilt heater with 14 wash programs. Steam wash technology that eliminates 99% allergens and bacteria.',
        price: 27999,
        category: 'Home Appliances',
        imageUrl: 'https://images.unsplash.com/photo-1582730147233-cbd8116f917b?w=500',
        stock: 12,
        rating: 4.6,
        reviews: []
      },
      {
        name: 'Smart Robotic Vacuum Cleaner with Mop',
        description: 'LiDAR navigation with 4000Pa suction. Smart map building, auto recharge, and voice command integrations.',
        price: 19999,
        category: 'Smart Living',
        imageUrl: 'https://images.unsplash.com/photo-1589365278144-c9e705b843ba?w=500',
        stock: 8,
        rating: 4.8,
        reviews: []
      },
      {
        name: 'Retro Electric Gooseneck Kettle (1.0L)',
        description: 'Precision pour spout for drip coffee and tea. Matte black finish, triple-safety auto shutoff, and fast boil.',
        price: 2499,
        category: 'Kitchen Appliances',
        imageUrl: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500',
        stock: 40,
        rating: 4.4,
        reviews: []
      },
      {
        name: 'HEPA Air Purifier with IoT Dashboard',
        description: 'True HEPA filter removing 99.97% particles. Real-time AQI indicator, ultra-silent sleep mode, and Alexa support.',
        price: 9499,
        category: 'Smart Living',
        imageUrl: 'https://images.unsplash.com/photo-1585130401366-fe05a8d813c4?w=500',
        stock: 25,
        rating: 4.7,
        reviews: []
      }
    ];

    defaultProducts.forEach(p => localDb.insert('products', p));
  }

  // 3. Seed Coupons
  const coupons = localDb.find('coupons');
  if (coupons.length === 0) {
    console.log('Seeding initial coupons...');
    localDb.insert('coupons', {
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      minPurchase: 500,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      active: true
    });
    localDb.insert('coupons', {
      code: 'GAYAJI200',
      type: 'flat',
      value: 200,
      minPurchase: 1500,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      active: true
    });
  }
}

seedDatabase();

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Gaya Ji Traders E-Commerce API is running smoothly.' });
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Run server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

