const express = require("express");
const router = express.Router();

const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require("../controllers/cart-controller");

// Cart routes for authenticated users
router.get("/user/:userId", getCart);
router.delete("/user/:userId/clear", clearCart);

// Cart routes for guests
router.get("/guest/:sessionId", getCart);
router.delete("/guest/:sessionId/clear", clearCart);

// Common cart operations (both authenticated and guest)
router.post("/add", addToCart);
router.patch("/update", updateCartItem);
router.delete("/remove", removeFromCart);

module.exports = router;
