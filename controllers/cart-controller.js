const Cart = require("../models/Cart");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const crypto = require("crypto");

// Get cart (authenticated user or guest)
const getCart = async (req, res) => {
    try {
        const { userId, sessionId } = req.params;
        let cart;
        
        if (userId) {
            // Authenticated user cart
            cart = await Cart.findOne({ user: userId, isGuestCart: false })
                .populate('items.product', 'title price discount image inventory');
        } else if (sessionId) {
            // Guest cart
            cart = await Cart.findOne({ sessionId, isGuestCart: true })
                .populate('items.product', 'title price discount image inventory');
        } else {
            return res.status(400).json({ message: "Either userId or sessionId is required" });
        }
            
        if (!cart) return res.status(404).json({ message: "Cart not found" });
        
        // Filter out items that are no longer available in the requested size/quantity
        const validItems = cart.items.filter(item => {
            const product = item.product;
            return product && product.isAvailable(item.size, item.quantity);
        });
        
        // Update cart if items were filtered out
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();
        }
        
        res.json(cart);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Add item to cart (authenticated user or guest)
const addToCart = async (req, res) => {
    try {
      const { userId, sessionId, productId, quantity = 1, size } = req.body;
  
      if (!size) {
        return res.status(400).json({ message: "Size is required" });
      }
      if (!userId && !sessionId) {
        return res.status(400).json({ message: "Either userId or sessionId is required" });
      }
  
      // 1) Validate product
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
  
      // 2) Locate or create cart
      let cart;
  
      if (userId) {
        // Authenticated user cart
        cart = await Cart.findOne({ user: userId, isGuestCart: false });
        if (!cart) {
          cart = await Cart.create({ user: userId, isGuestCart: false, items: [] });
        }
      } else {
        // Guest cart — assign a deterministic, unique placeholder ObjectId to `user`
        // This avoids collisions with an existing unique { user: 1 } index.
        const guestUserId = new mongoose.Types.ObjectId(
          crypto.createHash("md5").update(sessionId).digest("hex").slice(0, 24)
        );
  
        cart = await Cart.findOne({ sessionId, isGuestCart: true });
  
        if (!cart) {
          cart = await Cart.create({
            sessionId,
            isGuestCart: true,
            user: guestUserId, // <-- key line to satisfy unique user index
            items: [],
          });
        } else if (!cart.user) {
          // Harden legacy docs that may have user: null
          cart.user = guestUserId;
          await cart.save();
        }
      }
  
      // 3) Merge or add item
      const qtyNum = Math.max(1, Number(quantity) || 1);
  
      const existingItemIndex = cart.items.findIndex(
        (i) => i.product.toString() === productId && i.size === size
      );
  
      const requestedQty =
        existingItemIndex > -1
          ? cart.items[existingItemIndex].quantity + qtyNum
          : qtyNum;
  
      // 4) Check availability with the requested quantity
      if (!product.isAvailable(size, requestedQty)) {
        const availableQuantity = product.getQuantityForSize(size);
        return res
          .status(400)
          .json({ message: `Only ${availableQuantity} items available for size ${size}` });
      }
  
      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity = requestedQty;
      } else {
        cart.items.push({ product: product._id, quantity: qtyNum, size });
      }
  
      // 5) Save & populate
      await cart.save();
      await cart.populate("items.product", "title price discount image inventory isOnSale");
  
      return res.json({ message: "Item added to cart", cart });
    } catch (err) {
      console.error("addToCart error:", err);
      return res.status(400).json({ message: err.message });
    }
  };

// Update cart item quantity (authenticated user or guest)
const updateCartItem = async (req, res) => {
    try {
        const { userId, sessionId, productId, quantity, size } = req.body;
        
        if (!userId && !sessionId) return res.status(400).json({ message: "Either userId or sessionId is required" });
        
        let cart;
        if (userId) {
            cart = await Cart.findOne({ user: userId, isGuestCart: false });
        } else {
            cart = await Cart.findOne({ sessionId, isGuestCart: true });
        }
        
        if (!cart) return res.status(404).json({ message: "Cart not found" });
        
        const itemIndex = cart.items.findIndex(item => 
            item.product.toString() === productId && item.size === size
        );
        
        if (itemIndex === -1) {
            return res.status(404).json({ message: "Item not found in cart" });
        }
        
        if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            cart.items.splice(itemIndex, 1);
        } else {
            // Check availability before updating
            const product = await Product.findById(productId);
            if (!product.isAvailable(size, quantity)) {
                const availableQuantity = product.getQuantityForSize(size);
                return res.status(400).json({ 
                    message: `Only ${availableQuantity} items available for size ${size}` 
                });
            }
            cart.items[itemIndex].quantity = quantity;
        }
        
        await cart.save();
        await cart.populate('items.product', 'title price discount image inventory');
        
        res.json({ message: "Cart updated", cart });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Remove item from cart (authenticated user or guest)
const removeFromCart = async (req, res) => {
    try {
        const { userId, sessionId, productId, size } = req.body;
        
        if (!userId && !sessionId) return res.status(400).json({ message: "Either userId or sessionId is required" });
        
        let cart;
        if (userId) {
            cart = await Cart.findOne({ user: userId, isGuestCart: false });
        } else {
            cart = await Cart.findOne({ sessionId, isGuestCart: true });
        }
        
        if (!cart) return res.status(404).json({ message: "Cart not found" });
        
        cart.items = cart.items.filter(item => 
            !(item.product.toString() === productId && item.size === size)
        );
        
        await cart.save();
        await cart.populate('items.product', 'title price discount image inventory');
        
        res.json({ message: "Item removed from cart", cart });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Clear entire cart (authenticated user or guest)
const clearCart = async (req, res) => {
    try {
        const { userId, sessionId } = req.params;
        
        let cart;
        if (userId) {
            cart = await Cart.findOne({ user: userId, isGuestCart: false });
        } else if (sessionId) {
            cart = await Cart.findOne({ sessionId, isGuestCart: true });
        } else {
            return res.status(400).json({ message: "Either userId or sessionId is required" });
        }
        
        if (!cart) return res.status(404).json({ message: "Cart not found" });
        
        cart.items = [];
        cart.totalAmount = 0;
        await cart.save();
        
        res.json({ message: "Cart cleared", cart });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
