const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const emailService = require("../services/emailService");

// Create order from cart (authenticated user or guest)
const createOrder = async (req, res, next) => {
    const { userId, sessionId, status = "pending", address, phoneNumber, email, name } = req.body;
    const session = await mongoose.startSession();
    
    try {
        await session.withTransaction(async () => {
            const Cart = require("../models/Cart");
            
            let user = null;
            let cart = null;
            let isGuestOrder = false;
            
            if (userId) {
                // Authenticated user order
                [user, cart] = await Promise.all([
                    User.findById(userId).session(session),
                    Cart.findOne({ user: userId, isGuestCart: false }).populate('items.product').session(session)
                ]);
                if (!user) throw new Error("User not found");
            } else if (sessionId) {
                // Guest order
                isGuestOrder = true;
                if (!email || !name) throw new Error("Email and name are required for guest orders");
                cart = await Cart.findOne({ sessionId, isGuestCart: true }).populate('items.product').session(session);
            } else {
                throw new Error("Either userId or sessionId is required");
            }
            
            if (!cart || cart.items.length === 0) throw new Error("Cart is empty");
            
            // Validate inventory availability for all items
            const unavailableItems = [];
            for (const item of cart.items) {
                if (!item.product.isAvailable(item.size, item.quantity)) {
                    const available = item.product.getQuantityForSize(item.size);
                    unavailableItems.push({
                        product: item.product.title,
                        size: item.size,
                        requested: item.quantity,
                        available
                    });
                }
            }
            
            if (unavailableItems.length > 0) {
                throw new Error(`Insufficient inventory: ${JSON.stringify(unavailableItems)}`);
            }
            
            // Calculate total price (all users get discounts, new users get additional 10% off)
            let totalPrice = 0;
            let isNewUser = false;
            
            // Check if this is a new user (first order)
            if (!isGuestOrder && user) {
                const existingOrdersCount = await Order.countDocuments({ user: userId }).session(session);
                isNewUser = existingOrdersCount === 0;
            }
            
            // Calculate base price with regular discounts (apply to everyone)
            for (const item of cart.items) {
                const price = item.product.getPriceForUser(true); // Always apply discount
                totalPrice += price * item.quantity;
            }
            
            // Apply additional 10% discount for new users
            if (isNewUser) {
                totalPrice = totalPrice * 0.9; // 10% additional discount
                // Mark user as no longer new (will be saved after transaction)
                user.isNewUser = false;
                await user.save({ session });
            }
            
            totalPrice = Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
            
            // Reduce inventory for each cart item
            for (const item of cart.items) {
                const success = item.product.reduceInventory(item.size, item.quantity);
                if (!success) {
                    throw new Error(`Failed to reduce inventory for ${item.product.title} size ${item.size}`);
                }
                await item.product.save({ session });
            }
            
            // Extract product IDs
            const productIds = cart.items.map(item => item.product._id);
            
            // Create order
            const orderData = {
                products: productIds, 
                totalPrice, 
                status, 
                address, 
                phoneNumber,
                isGuestOrder,
                newUserDiscount: isNewUser // Track if new user discount was applied
            };
            
            if (isGuestOrder) {
                orderData.guestInfo = { email, name };
            } else {
                orderData.user = userId;
            }
            
            const order = await Order.create([orderData], { session });
            
            // Store cart items for email before clearing (need quantity, size, and product info)
            const cartItemsForEmail = cart.items.map(item => ({
                product: item.product,
                quantity: item.quantity,
                size: item.size,
                unitPrice: item.product.getPriceForUser(true), // Always apply discount as per new logic
                lineTotal: item.product.getPriceForUser(true) * item.quantity
            }));
            
            // Clear cart after successful order creation
            cart.items = [];
            cart.totalAmount = 0;
            await cart.save({ session });
            
            // Store order and cart data for email sending (outside transaction)
            req.orderData = {
                order: order[0],
                user: user,
                cartItems: cartItemsForEmail
            };
            
            res.status(201).json({ message: "Order created successfully", order: order[0] });
        });
        
        // Send confirmation email after successful order creation
        if (req.orderData) {
            try {
                // Fetch the complete order for email
                const completeOrder = await Order.findById(req.orderData.order._id)
                    .populate('user', 'name email');
                
                const emailData = {
                    order: completeOrder,
                    user: req.orderData.user,
                    cartItems: req.orderData.cartItems // Use stored cart items with quantities
                };
                
                emailService.testEmailConnection();
                const emailResult = await emailService.sendOrderConfirmation(emailData);
                if (emailResult.success) {
                    console.log(`Order confirmation email sent for order ${completeOrder._id}`);
                } else {
                    console.error(`Failed to send confirmation email for order ${completeOrder._id}:`, emailResult.error);
                }
            } catch (emailError) {
                // Log email error but don't fail the order creation
                console.error('Error sending order confirmation email:', emailError.message);
            }
        }
    } catch (err) {
        res.status(400).json({ message: err.message });
    } finally {
        session.endSession();
    }
};

// Get all orders with pagination
const getOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const filter = status ? { status } : {};
        
        const orders = await Order.find(filter)
            .populate('user', 'name email')
            .populate('products', 'title price')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
            console.log(orders);
        const total = await Order.countDocuments(filter);
        res.json({ orders, total, page: +page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get order by ID
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phoneNumber')
            .populate('products', 'title price image');
            
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get orders by user ID
const getOrdersByUserId = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const orders = await Order.find({ user: req.params.userId })
            .populate('products', 'title price image')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
            
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update order
const updateOrder = async (req, res) => {
    try {
        const allowedFields = ['status', 'address', 'phoneNumber'];
        const updates = Object.keys(req.body).reduce((acc, key) => {
            if (allowedFields.includes(key)) acc[key] = req.body[key];
            return acc;
        }, {});
        
        const order = await Order.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
            .populate('user', 'name email')
            .populate('products', 'title price');
            
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order updated successfully", order });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// Delete order
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { createOrder, getOrders, getOrderById, getOrdersByUserId, updateOrder, deleteOrder };