const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    size: {
        type: String,
        required: true, // Size is now required for all cart items
    },
    color: {
        type: String,
        required: true, // Color is now required for all cart items
    },
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // Allow guest carts without user
    },
    sessionId: {
        type: String, // For guest carts identification
        required: false,
    },
    isGuestCart: {
        type: Boolean,
        default: false,
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

// Calculate total amount before saving (discounts only for authenticated users)
cartSchema.pre('save', async function(next) {
    if (this.isModified('items')) {
        await this.populate('items.product', 'price discount');
        const isAuthenticated = !this.isGuestCart && this.user;
        
        this.totalAmount = this.items.reduce((total, item) => {
            const price = item.product.getPriceForUser(isAuthenticated);
            return total + (price * item.quantity);
        }, 0);
    }
    next();
});

module.exports = mongoose.model("Cart", cartSchema);
