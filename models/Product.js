const mongoose = require("mongoose");

const sizeInventorySchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
}, { _id: false });

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    discount: {
        type: Number,
        min: 0,
        max: 100,
        default: 0, // Discount percentage (0-100)
    },
    description: {
        type: String,
    },
    gender: {
        type: String,
        enum: ["boy", "girl", "unisex"],
        required: true,
    },
    image: {
        type: String,
    },
    inventory: [sizeInventorySchema], // Array of size-specific inventory
    category: {
        type: String,
    },
    brand: {
        type: String,
    },
}, { timestamps: true });

// Virtual field to get total quantity across all sizes
productSchema.virtual('totalQuantity').get(function() {
    return this.inventory.reduce((total, item) => total + item.quantity, 0);
});

// Virtual field to get available sizes (sizes with quantity > 0)
productSchema.virtual('availableSizes').get(function() {
    return this.inventory.filter(item => item.quantity > 0).map(item => item.size);
});

// Virtual field to get discounted price
productSchema.virtual('discountedPrice').get(function() {
    if (this.discount > 0) {
        return Math.round(this.price * (1 - this.discount / 100) * 100) / 100;
    }
    return this.price;
});

// Virtual field to get savings amount
productSchema.virtual('savings').get(function() {
    if (this.discount > 0) {
        return Math.round((this.price - this.discountedPrice) * 100) / 100;
    }
    return 0;
});

// Virtual field to check if product is on sale
productSchema.virtual('isOnSale').get(function() {
    return this.discount > 0;
});

// Method to check if a specific size is available
productSchema.methods.isAvailable = function(size, requestedQuantity = 1) {
    const sizeItem = this.inventory.find(item => item.size === size);
    return sizeItem && sizeItem.quantity >= requestedQuantity;
};

// Method to get quantity for a specific size
productSchema.methods.getQuantityForSize = function(size) {
    const sizeItem = this.inventory.find(item => item.size === size);
    return sizeItem ? sizeItem.quantity : 0;
};

// Method to update inventory for a specific size
productSchema.methods.updateInventory = function(size, quantity) {
    const sizeItem = this.inventory.find(item => item.size === size);
    if (sizeItem) {
        sizeItem.quantity = Math.max(0, quantity);
    } else {
        this.inventory.push({ size, quantity: Math.max(0, quantity) });
    }
};

// Method to reduce inventory (for orders)
productSchema.methods.reduceInventory = function(size, quantity) {
    const sizeItem = this.inventory.find(item => item.size === size);
    if (sizeItem && sizeItem.quantity >= quantity) {
        sizeItem.quantity -= quantity;
        return true;
    }
    return false;
};

// Method to get price based on user authentication (discounts only for authenticated users)
productSchema.methods.getPriceForUser = function(isAuthenticated = false) {
    if (isAuthenticated && this.discount > 0) {
        return Math.round(this.price * (1 - this.discount / 100) * 100) / 100;
    }
    return this.price;
};

// Method to get savings for authenticated users only
productSchema.methods.getSavingsForUser = function(isAuthenticated = false) {
    if (isAuthenticated && this.discount > 0) {
        return Math.round((this.price - this.getPriceForUser(true)) * 100) / 100;
    }
    return 0;
};

module.exports = mongoose.model("Product", productSchema);