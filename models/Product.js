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

const colorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    hexCode: {
        type: String,
        required: true,
    },
    inventory: [sizeInventorySchema], // Array of size-specific inventory for this color
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
    colors: [colorSchema], // Array of colors with their own inventories
    category: {
        type: String,
    },
    brand: {
        type: String,
    },
}, { timestamps: true });

// Virtual field to get total quantity across all colors and sizes
productSchema.virtual('totalQuantity').get(function() {
    return this.colors.reduce((total, color) => {
        return total + color.inventory.reduce((colorTotal, item) => colorTotal + item.quantity, 0);
    }, 0);
});

// Virtual field to get available sizes across all colors
productSchema.virtual('availableSizes').get(function() {
    const sizeSet = new Set();
    this.colors.forEach(color => {
        color.inventory.forEach(item => {
            if (item.quantity > 0) {
                sizeSet.add(item.size);
            }
        });
    });
    return Array.from(sizeSet);
});

// Virtual field to get all available colors with their available sizes
productSchema.virtual('availableColors').get(function() {
    return this.colors.map(color => ({
        name: color.name,
        hexCode: color.hexCode,
        availableSizes: color.inventory
            .filter(item => item.quantity > 0)
            .map(item => ({ size: item.size, quantity: item.quantity }))
    })).filter(color => color.availableSizes.length > 0);
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

// Method to check if a specific size and color combination is available
productSchema.methods.isAvailable = function(colorName, size, requestedQuantity = 1) {
    const color = this.colors.find(c => c.name === colorName);
    if (!color) return false;
    
    const sizeItem = color.inventory.find(item => item.size === size);
    return sizeItem && sizeItem.quantity >= requestedQuantity;
};

// Method to get quantity for a specific color and size
productSchema.methods.getQuantityForColorAndSize = function(colorName, size) {
    const color = this.colors.find(c => c.name === colorName);
    if (!color) return 0;
    
    const sizeItem = color.inventory.find(item => item.size === size);
    return sizeItem ? sizeItem.quantity : 0;
};

// Method to get total quantity for a specific color
productSchema.methods.getTotalQuantityForColor = function(colorName) {
    const color = this.colors.find(c => c.name === colorName);
    if (!color) return 0;
    
    return color.inventory.reduce((total, item) => total + item.quantity, 0);
};

// Method to update inventory for a specific color and size
productSchema.methods.updateInventory = function(colorName, size, quantity) {
    let color = this.colors.find(c => c.name === colorName);
    
    if (!color) {
        // Create new color if it doesn't exist
        color = { name: colorName, hexCode: '#000000', inventory: [] };
        this.colors.push(color);
    }
    
    const sizeItem = color.inventory.find(item => item.size === size);
    if (sizeItem) {
        sizeItem.quantity = Math.max(0, quantity);
    } else {
        color.inventory.push({ size, quantity: Math.max(0, quantity) });
    }
};

// Method to reduce inventory (for orders)
productSchema.methods.reduceInventory = function(colorName, size, quantity) {
    const color = this.colors.find(c => c.name === colorName);
    if (!color) return false;
    
    const sizeItem = color.inventory.find(item => item.size === size);
    if (sizeItem && sizeItem.quantity >= quantity) {
        sizeItem.quantity -= quantity;
        return true;
    }
    return false;
};

// Method to add a new color to the product
productSchema.methods.addColor = function(colorName, hexCode, inventory = []) {
    const existingColor = this.colors.find(c => c.name === colorName);
    if (existingColor) {
        throw new Error(`Color ${colorName} already exists`);
    }
    
    this.colors.push({
        name: colorName,
        hexCode: hexCode,
        inventory: inventory
    });
};

// Method to remove a color from the product
productSchema.methods.removeColor = function(colorName) {
    this.colors = this.colors.filter(c => c.name !== colorName);
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