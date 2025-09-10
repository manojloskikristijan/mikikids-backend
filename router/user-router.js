const express = require("express");
const router = express.Router();

const userController = require("../controllers/user-controller");



router.get("/", (req, res) => {
    res.status(200).json({message: "Hello from the user router"});
});

router.post("/register", userController.register);
router.post("/login", userController.login);

module.exports = router;