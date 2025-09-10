const express = require("express");

const router = express.Router();

const { createOrder, getOrders, getOrderById,getOrdersByUserId, updateOrder, deleteOrder } = require("../controllers/order-controller");


router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.get("/user/:userId", getOrdersByUserId);
router.patch("/:id", updateOrder);
router.delete("/:id", deleteOrder);

module.exports = router;