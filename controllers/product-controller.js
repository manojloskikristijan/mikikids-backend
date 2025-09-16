const mongoose = require("mongoose");
const Product = require("../models/Product");
const multer = require("multer");
const sharp = require("sharp");

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
    if(file.mimetype.startsWith("image")){
        cb(null, true);
    }else{
        cb(new Error("Not an image! Please upload an image."), false);
    }
}

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});

const uploadProductImage = upload.single("image");



const resizeProductImage = async (req, res, next) => {
      if (!req.file) {
        return next();
      }
      req.file.filename = `product-${Date.now()}.jpeg`;

      try{
        sharp(req.file.buffer)
        .rotate()
        .resize({ height: 1200, fit: "inside" })
        .toFormat("jpeg")
        .jpeg({ quality: 90 })
        .toFile(`public/img/products/${req.file.filename}`);
      }catch(err){
        return next(err);
      }
    
      next();
    };



    const getAllProducts = async (req, res, next) => {
    try{
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Get total count for pagination metadata
        const totalProducts = await Product.countDocuments();
        
        // Fetch products with pagination
        const products = await Product.find()
            .select('title price discount description gender image colors category brand createdAt')
            .skip(skip)
            .limit(limit)
            .sort({ 
                discount: -1, // Products with discount first (discount > 0)
                createdAt: -1 // Then by newest first
            });
        
        // Add virtual fields to response
        const productsWithVirtuals = products.map(product => ({
            ...product.toObject(),
            totalQuantity: product.totalQuantity,
            availableSizes: product.availableSizes,
            availableColors: product.availableColors,
            discountedPrice: product.discountedPrice,
            savings: product.savings,
            isOnSale: product.isOnSale
        }));
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;
        
        res.status(200).json({
            message: "Products fetched successfully", 
            products: productsWithVirtuals,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                productsPerPage: limit,
                hasNextPage,
                hasPrevPage
            }
        });
    }catch(err){
        return next(err);
    }
}

const getLatestProducts = async (req, res, next) => {
    try{
        const products = await Product.find().sort({ createdAt: -1 }).limit(3);
        res.status(200).json({message: "Latest products fetched successfully", products});
    }catch(err){
        return next(err);
    }
}

// middleware: parse JSON fields that come via multipart/form-data
const parseProductForm = (req, res, next) => {
    try {
      if (typeof req.body.colors === "string") {
        req.body.colors = JSON.parse(req.body.colors);
      }
      next();
    } catch (e) {
      e.statusCode = 400;
      e.message = `Invalid JSON in "colors": ${e.message}`;
      next(e);
    }
  };
  

const createProduct = async (req, res, next) => {
    const transaction = await mongoose.startSession();
    transaction.startTransaction();
    try{
        const product = await Product.create({...req.body, image: req.file.filename});
        await transaction.commitTransaction();
        res.status(201).json({message: "Product created successfully", product});
    }catch(err){
        await transaction.abortTransaction();
            return next(err);
    }finally{
        transaction.endSession();
    }
}

const updateProduct = async (req, res, next) => {
    console.log(req.body);
    console.log(req.params.id);
    
    try{
        const product = await Product.findByIdAndUpdate(req.params.id, req.body, {new: true});
        res.status(200).json({message: "Product updated successfully", product});
    }catch(err){
        return next(err);
    }
}

const deleteProduct = async (req, res, next) => {
    try{
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json({message: "Product deleted successfully"});
    }catch(err){
        return next(err);
    }
}

// Get product with inventory details
const getProductById = async (req, res, next) => {
    try{
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        const productWithVirtuals = {
            ...product.toObject(),
            totalQuantity: product.totalQuantity,
            availableSizes: product.availableSizes,
            availableColors: product.availableColors,
            discountedPrice: product.discountedPrice,
            savings: product.savings,
            isOnSale: product.isOnSale
        };
        
        res.status(200).json({message: "Product fetched successfully", product: productWithVirtuals});
    }catch(err){
        return next(err);
    }
}

// Update inventory for a specific product, color and size
const updateInventory = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName, size, quantity } = req.body;
        
        if (!colorName || !size || quantity === undefined) {
            return res.status(400).json({message: "colorName, size, and quantity are required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        product.updateInventory(colorName, size, quantity);
        await product.save();
        
        res.status(200).json({
            message: "Inventory updated successfully", 
            colors: product.colors,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

// Bulk update inventory for a specific color
const bulkUpdateInventory = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName, inventory } = req.body; // colorName and array of {size, quantity}
        
        if (!colorName || !inventory) {
            return res.status(400).json({message: "colorName and inventory array are required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        // Find the color or create it if it doesn't exist
        let color = product.colors.find(c => c.name === colorName);
        if (!color) {
            product.addColor(colorName, '#000000', []);
            color = product.colors.find(c => c.name === colorName);
        }
        
        // Update inventory for this color
        color.inventory = inventory.map(item => ({
            size: item.size,
            quantity: Math.max(0, item.quantity)
        }));
        
        await product.save();
        
        res.status(200).json({
            message: "Inventory updated successfully", 
            colors: product.colors,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

const sellProduct = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName, size, quantity = 1 } = req.body;
        
        if (!colorName || !size) {
            return res.status(400).json({message: "colorName and size are required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        const success = product.reduceInventory(colorName, size, quantity);
        if (!success) {
            return res.status(400).json({message: "Insufficient inventory or color/size not found"});
        }
        
        await product.save();
        
        res.status(200).json({
            message: "Product sold successfully", 
            product: product,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

const addProduct = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName, size, quantity = 1 } = req.body;
        
        if (!colorName || !size) {
            return res.status(400).json({message: "colorName and size are required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        product.updateInventory(colorName, size, product.getQuantityForColorAndSize(colorName, size) + quantity);
        await product.save();
        
        res.status(200).json({
            message: "Product inventory added successfully", 
            product: product,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

// Add a new color to a product
const addColor = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName, hexCode, inventory = [] } = req.body;
        
        if (!colorName || !hexCode) {
            return res.status(400).json({message: "colorName and hexCode are required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        product.addColor(colorName, hexCode, inventory);
        await product.save();
        
        res.status(200).json({
            message: "Color added successfully", 
            product: product,
            colors: product.colors
        });
    }catch(err){
        if (err.message.includes('already exists')) {
            return res.status(400).json({message: err.message});
        }
        return next(err);
    }
}

// Remove a color from a product
const removeColor = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { colorName } = req.body;
        
        if (!colorName) {
            return res.status(400).json({message: "colorName is required"});
        }
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        product.removeColor(colorName);
        await product.save();
        
        res.status(200).json({
            message: "Color removed successfully", 
            product: product,
            colors: product.colors
        });
    }catch(err){
        return next(err);
    }
}

module.exports = {
    getAllProducts,
    getLatestProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    updateInventory,
    bulkUpdateInventory,
    uploadProductImage,
    resizeProductImage,
    sellProduct,
    addProduct,
    addColor,
    removeColor,
    parseProductForm
}