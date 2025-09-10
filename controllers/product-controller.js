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
        const products = await Product.find().select('title price discount description gender image inventory category brand createdAt');
        
        // Add virtual fields to response
        const productsWithVirtuals = products.map(product => ({
            ...product.toObject(),
            totalQuantity: product.totalQuantity,
            availableSizes: product.availableSizes,
            discountedPrice: product.discountedPrice,
            savings: product.savings,
            isOnSale: product.isOnSale
        }));
        
        res.status(200).json({message: "Products fetched successfully", products: productsWithVirtuals});
    }catch(err){
        return next(err);
    }
}

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
            discountedPrice: product.discountedPrice,
            savings: product.savings,
            isOnSale: product.isOnSale
        };
        
        res.status(200).json({message: "Product fetched successfully", product: productWithVirtuals});
    }catch(err){
        return next(err);
    }
}

// Update inventory for a specific product and size
const updateInventory = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { size, quantity } = req.body;
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        product.updateInventory(size, quantity);
        await product.save();
        
        res.status(200).json({
            message: "Inventory updated successfully", 
            inventory: product.inventory,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

// Bulk update inventory
const bulkUpdateInventory = async (req, res, next) => {
    try{
        const { productId } = req.params;
        const { inventory } = req.body; // Array of {size, quantity}
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({message: "Product not found"});
        }
        
        // Clear existing inventory and set new one
        product.inventory = inventory.map(item => ({
            size: item.size,
            quantity: Math.max(0, item.quantity)
        }));
        
        await product.save();
        
        res.status(200).json({
            message: "Inventory updated successfully", 
            inventory: product.inventory,
            totalQuantity: product.totalQuantity
        });
    }catch(err){
        return next(err);
    }
}

module.exports = {
    getAllProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    updateInventory,
    bulkUpdateInventory,
    uploadProductImage,
    resizeProductImage
}