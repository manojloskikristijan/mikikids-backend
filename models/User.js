const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user",
    },
    cart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cart",
    },
    isNewUser: {
        type: Boolean,
        default: true, // New users start as true
    },
}, {timestamps: true});

// Create cart when user is created
userSchema.post('save', async function(user) {
    if (this.isNew && !this.cart) {
        const Cart = mongoose.model('Cart');
        const cart = await Cart.create({ user: this._id, items: [] });
        this.cart = cart._id;
        await this.save();
    }
});

module.exports = mongoose.model("User", userSchema);