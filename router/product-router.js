const express = require("express");
const { 
    getAllProducts, 
    createProduct, 
    updateProduct, 
    deleteProduct, 
    getProductById,
    updateInventory,
    bulkUpdateInventory,
    uploadProductImage, 
    resizeProductImage 
} = require("../controllers/product-controller");

const router = express.Router();

router.get("/", getAllProducts);
router.get("/:id", getProductById);

router.post("/", uploadProductImage, resizeProductImage, createProduct);

router.patch("/:id", updateProduct);
router.patch("/:productId/inventory", updateInventory);
router.put("/:productId/inventory", bulkUpdateInventory);

router.delete("/:id", deleteProduct);

module.exports = router;