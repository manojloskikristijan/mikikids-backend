const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    size: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        required: true,
    },
    unitPrice: {
        type: Number,
        required: true,
    },
    lineTotal: {
        type: Number,
        required: true,
    },
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // Not required for guest orders
    },
    items: [orderItemSchema], // Changed from products to items with detailed info
    totalPrice: {
        type: Number,
    },
    status: {
        type: String,
        enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
        default: "pending",
    },
    address: {
        type: String,
    },
    phoneNumber: {
        type: String,
    },
    isGuestOrder: {
        type: Boolean,
        default: false,
    },
    guestInfo: {
        email: {
            type: String,
            required: function() { return this.isGuestOrder; }
        },
        name: {
            type: String,
            required: function() { return this.isGuestOrder; }
        }
    },
    newUserDiscount: {
        type: Boolean,
        default: false
    }
}, {timestamps: true});

module.exports = mongoose.model("Order", orderSchema);