const express = require('express');
const router = express.Router();
const localDb = require('../localDb');
const { auth, adminOnly, deliveryOnly } = require('../middleware/auth');

// --- Coupon Routes ---

// Validate Coupon
router.post('/coupon/validate', auth, (req, res) => {
  const { code, cartSubtotal } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Coupon code is required' });
  }

  const coupon = localDb.findOne('coupons', { code: code.toUpperCase() });
  if (!coupon || !coupon.active) {
    return res.status(404).json({ message: 'Invalid or inactive coupon code' });
  }

  // Check expiry
  if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
    return res.status(400).json({ message: 'Coupon has expired' });
  }

  // Check min purchase
  if (cartSubtotal < coupon.minPurchase) {
    return res.status(400).json({ message: `Minimum purchase of ₹${coupon.minPurchase} required` });
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.round((cartSubtotal * coupon.value) / 100);
  } else {
    discount = coupon.value;
  }

  res.json({
    message: 'Coupon applied successfully',
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount
  });
});

// Create Coupon (Admin only)
router.post('/coupon', auth, adminOnly, (req, res) => {
  const { code, type, value, minPurchase, expiryDate } = req.body;
  if (!code || !type || value === undefined) {
    return res.status(400).json({ message: 'Code, type, and value are required' });
  }

  const existing = localDb.findOne('coupons', { code: code.toUpperCase() });
  if (existing) {
    return res.status(400).json({ message: 'Coupon code already exists' });
  }

  const newCoupon = localDb.insert('coupons', {
    code: code.toUpperCase(),
    type, // 'percent' or 'flat'
    value: Number(value),
    minPurchase: Number(minPurchase || 0),
    expiryDate: expiryDate || null,
    active: true
  });

  res.status(201).json(newCoupon);
});

// List Coupons (Admin only)
router.get('/coupon', auth, adminOnly, (req, res) => {
  const coupons = localDb.find('coupons');
  res.json(coupons);
});

// Delete Coupon (Admin only)
router.delete('/coupon/:id', auth, adminOnly, (req, res) => {
  const deletedCount = localDb.delete('coupons', { _id: req.params.id });
  if (deletedCount === 0) {
    return res.status(404).json({ message: 'Coupon not found' });
  }
  res.json({ message: 'Coupon deleted successfully' });
});


// --- Order Routes ---

// Create new order
router.post('/', auth, (req, res) => {
  const { items, address, paymentMode, paymentTransactionId, couponCode } = req.body;

  if (!items || items.length === 0 || !address || !paymentMode) {
    return res.status(400).json({ message: 'Items, address, and payment mode are required' });
  }

  // 1. Verify and calculate total
  let subtotal = 0;
  for (const item of items) {
    const product = localDb.findOne('products', { _id: item.productId });
    if (!product) {
      return res.status(400).json({ message: `Product ${item.name} not found` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
    }
    subtotal += product.price * item.quantity;
  }

  // 2. Apply coupon if valid
  let discount = 0;
  if (couponCode) {
    const coupon = localDb.findOne('coupons', { code: couponCode.toUpperCase() });
    if (coupon && coupon.active && subtotal >= coupon.minPurchase) {
      const notExpired = !coupon.expiryDate || new Date(coupon.expiryDate) >= new Date();
      if (notExpired) {
        if (coupon.type === 'percent') {
          discount = Math.round((subtotal * coupon.value) / 100);
        } else {
          discount = coupon.value;
        }
      }
    }
  }

  const total = subtotal - discount;

  // 3. Deduct stock
  for (const item of items) {
    const product = localDb.findOne('products', { _id: item.productId });
    localDb.update('products', { _id: item.productId }, { stock: product.stock - item.quantity });
  }

  // 4. Set payment status
  let paymentStatus = 'Pending';
  if (paymentMode === 'Online') {
    paymentStatus = 'Paid';
  }

  // 5. Create Order record
  const newOrder = localDb.insert('orders', {
    customerId: req.user._id,
    customerName: req.user.name,
    customerEmail: req.user.email,
    phone: req.user.phone,
    address,
    items,
    subtotal,
    discount,
    couponCode: couponCode || null,
    total,
    paymentMode,
    paymentStatus,
    paymentTransactionId: paymentTransactionId || null,
    orderStatus: 'Pending',
    deliveryBoyId: null,
    deliveryBoyName: null,
    trackingHistory: [
      { status: 'Order Placed', timestamp: new Date().toISOString(), comment: 'Thank you for shopping with Gaya Ji Traders!' }
    ]
  });

  // Create notifications
  // User notification
  localDb.insert('notifications', {
    userId: req.user._id,
    message: `Your order for ₹${total} has been placed successfully. Order ID: ${newOrder._id}`,
    read: false,
    type: 'order',
    orderId: newOrder._id
  });

  // Admin notification (sent to all admins)
  localDb.insert('notifications', {
    userId: 'admin',
    message: `New order placed by ${req.user.name} for ₹${total}. Order ID: ${newOrder._id}`,
    read: false,
    type: 'order',
    orderId: newOrder._id
  });

  res.status(201).json(newOrder);
});

// Get currently logged-in user's orders
router.get('/my-orders', auth, (req, res) => {
  const orders = localDb.find('orders', { customerId: req.user._id });
  res.json(orders.reverse());
});

// Cancel order (Customer only, within 1 hour limit)
router.post('/:id/cancel', auth, (req, res) => {
  const order = localDb.findOne('orders', { _id: req.params.id });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Verify owner or admin
  if (order.customerId !== req.user._id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You are not authorized to cancel this order' });
  }

  // Verify cancellation status
  if (order.orderStatus === 'Cancelled') {
    return res.status(400).json({ message: 'Order is already cancelled' });
  }
  if (order.orderStatus === 'Delivered' || order.orderStatus === 'Shipped') {
    return res.status(400).json({ message: 'Cannot cancel an order that has already been shipped or delivered' });
  }

  // Verify 2 hour time window (7200000ms)
  const orderTime = new Date(order.createdAt).getTime();
  const currentTime = Date.now();
  const timeDifference = currentTime - orderTime;

  if (timeDifference > 2 * 60 * 60 * 1000 && req.user.role !== 'admin') {
    return res.status(400).json({ message: 'Orders can only be cancelled within 2 hours of placement' });
  }

  // Restore inventory stock
  for (const item of order.items) {
    const product = localDb.findOne('products', { _id: item.productId });
    if (product) {
      localDb.update('products', { _id: item.productId }, { stock: product.stock + item.quantity });
    }
  }

  // Update order status & add to tracking log
  const updatedTracking = [...order.trackingHistory];
  updatedTracking.push({
    status: 'Cancelled',
    timestamp: new Date().toISOString(),
    comment: 'Order cancelled by customer.'
  });

  localDb.update('orders', { _id: req.params.id }, {
    orderStatus: 'Cancelled',
    trackingHistory: updatedTracking
  });

  // Notify customer
  localDb.insert('notifications', {
    userId: order.customerId,
    message: `Your order #${order._id} has been cancelled successfully. Refund (if paid online) will be processed.`,
    read: false,
    type: 'order',
    orderId: order._id
  });

  // Notify Admin
  localDb.insert('notifications', {
    userId: 'admin',
    message: `Order #${order._id} was cancelled by the customer ${req.user.name}.`,
    read: false,
    type: 'order',
    orderId: order._id
  });

  res.json({ message: 'Order cancelled successfully', orderStatus: 'Cancelled', trackingHistory: updatedTracking });
});

// Get all orders (Admin only)
router.get('/all', auth, adminOnly, (req, res) => {
  const orders = localDb.find('orders');
  res.json(orders.reverse());
});

// Update order status (Admin or Assigned Delivery boy)
router.put('/:id/status', auth, (req, res) => {
  const { status, comment } = req.body;
  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  const order = localDb.findOne('orders', { _id: req.params.id });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // If user is delivery boy, verify it's assigned to them
  if (req.user.role === 'delivery' && order.deliveryBoyId !== req.user._id) {
    return res.status(403).json({ message: 'You can only update status of orders assigned to you' });
  }

  const updatedTracking = [...order.trackingHistory];
  updatedTracking.push({
    status,
    timestamp: new Date().toISOString(),
    comment: comment || `Status updated to ${status}`
  });

  const updates = {
    orderStatus: status,
    trackingHistory: updatedTracking
  };

  if (status === 'Delivered') {
    updates.paymentStatus = 'Paid';
  }

  localDb.update('orders', { _id: req.params.id }, updates);

  // Send notifications
  localDb.insert('notifications', {
    userId: order.customerId,
    message: `Your order status has been updated to: ${status}.`,
    read: false,
    type: 'order',
    orderId: order._id
  });

  res.json({ message: 'Order status updated successfully', orderStatus: status, trackingHistory: updatedTracking });
});

// Assign delivery boy (Admin only)
router.put('/:id/assign-delivery', auth, adminOnly, (req, res) => {
  const { deliveryBoyId, deliveryBoyName, deliveryBoyPhone } = req.body;
  if (!deliveryBoyId || !deliveryBoyName) {
    return res.status(400).json({ message: 'Delivery boy ID and Name are required' });
  }

  const order = localDb.findOne('orders', { _id: req.params.id });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const updatedTracking = [...order.trackingHistory];
  updatedTracking.push({
    status: 'Assigned for Delivery',
    timestamp: new Date().toISOString(),
    comment: `Order assigned to delivery personnel ${deliveryBoyName}` + (deliveryBoyPhone ? ` (Ph: ${deliveryBoyPhone})` : '')
  });

  localDb.update('orders', { _id: req.params.id }, {
    deliveryBoyId,
    deliveryBoyName,
    deliveryBoyPhone: deliveryBoyPhone || null,
    orderStatus: 'Confirmed',
    trackingHistory: updatedTracking
  });

  // Notify customer
  localDb.insert('notifications', {
    userId: order.customerId,
    message: `Delivery personnel ${deliveryBoyName} has been assigned to your order.`,
    read: false,
    type: 'delivery',
    orderId: order._id
  });

  // Notify delivery boy
  localDb.insert('notifications', {
    userId: deliveryBoyId,
    message: `New delivery task assigned! Deliver to: ${order.customerName}, Order ID: ${order._id}`,
    read: false,
    type: 'delivery',
    orderId: order._id
  });

  res.json({ message: 'Delivery boy assigned successfully', deliveryBoyId, deliveryBoyName });
});

// Get assigned orders for Delivery Boy
router.get('/assigned-deliveries', auth, deliveryOnly, (req, res) => {
  const orders = localDb.find('orders', { deliveryBoyId: req.user._id });
  res.json(orders);
});

// --- Reports API (Admin only) ---
router.get('/reports/payment-summary', auth, adminOnly, (req, res) => {
  const orders = localDb.find('orders');
  const products = localDb.find('products');

  let totalSales = 0;
  let codSales = 0;
  let onlineSales = 0;
  let completedOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;

  orders.forEach(order => {
    if (order.orderStatus !== 'Cancelled') {
      totalSales += order.total;
      if (order.paymentMode === 'COD') {
        codSales += order.total;
      } else if (order.paymentMode === 'Online') {
        onlineSales += order.total;
      }
    }

    if (order.orderStatus === 'Delivered') {
      completedOrders++;
    } else if (order.orderStatus === 'Cancelled') {
      cancelledOrders++;
    } else {
      pendingOrders++;
    }
  });

  // Inventory stats
  let totalInventoryCost = 0;
  let lowStockCount = 0;
  products.forEach(p => {
    totalInventoryCost += p.price * p.stock;
    if (p.stock <= 5) {
      lowStockCount++;
    }
  });

  // Group sales by day (last 7 days for example)
  const salesByDay = {};
  orders.forEach(order => {
    if (order.orderStatus !== 'Cancelled') {
      const date = order.createdAt ? order.createdAt.split('T')[0] : 'Unknown';
      salesByDay[date] = (salesByDay[date] || 0) + order.total;
    }
  });

  res.json({
    summary: {
      totalSales,
      codSales,
      onlineSales,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalInventoryCost,
      lowStockCount
    },
    salesByDay
  });
});

module.exports = router;
