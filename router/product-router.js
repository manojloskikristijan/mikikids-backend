const express = require("express");
const { 
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
    parseProductForm
} = require("../controllers/product-controller");

const router = express.Router();

router.get("/", getAllProducts);
router.get("/latest", getLatestProducts);
router.get("/:id", getProductById);

router.post("/", uploadProductImage, resizeProductImage, parseProductForm, createProduct);

router.patch("/sell/:id", sellProduct);
router.patch("/add/:id", addProduct);

router.patch("/:id", updateProduct);
router.patch("/:productId/inventory", updateInventory);
router.put("/:productId/inventory", bulkUpdateInventory);

router.delete("/:id", deleteProduct);

module.exports = router;