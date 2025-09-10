const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // Not required for guest orders
    },
    products: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Product",
    },
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