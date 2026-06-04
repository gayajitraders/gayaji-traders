const express = require('express');
const router = express.Router();
const localDb = require('../localDb');
const { auth, adminOnly } = require('../middleware/auth');

// Get all products (with search, category, and low stock filters)
router.get('/', (req, res) => {
  const { search, category, lowStock } = req.query;
  let products = localDb.find('products');

  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (lowStock === 'true') {
    products = products.filter(p => p.stock <= 5);
  }

  res.json(products);
});

// Get single product
router.get('/:id', (req, res) => {
  const product = localDb.findOne('products', { _id: req.params.id });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json(product);
});

// Create product (Admin only)
router.post('/', auth, adminOnly, (req, res) => {
  const { name, description, price, category, imageUrl, stock } = req.body;
  if (!name || price === undefined || !category || stock === undefined) {
    return res.status(400).json({ message: 'Name, price, category, and stock are required' });
  }

  const newProduct = localDb.insert('products', {
    name,
    description: description || '',
    price: Number(price),
    category,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    stock: Number(stock),
    rating: 4.5,
    reviews: []
  });

  res.status(201).json(newProduct);
});

// Update product (Admin only)
router.put('/:id', auth, adminOnly, (req, res) => {
  const { name, description, price, category, imageUrl, stock } = req.body;
  
  const product = localDb.findOne('products', { _id: req.params.id });
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = Number(price);
  if (category !== undefined) updates.category = category;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (stock !== undefined) updates.stock = Number(stock);

  localDb.update('products', { _id: req.params.id }, updates);
  
  const updatedProduct = localDb.findOne('products', { _id: req.params.id });
  res.json(updatedProduct);
});

// Delete product (Admin only)
router.delete('/:id', auth, adminOnly, (req, res) => {
  const deletedCount = localDb.delete('products', { _id: req.params.id });
  if (deletedCount === 0) {
    return res.status(404).json({ message: 'Product not found' });
  }
  res.json({ message: 'Product deleted successfully' });
});

module.exports = router;
