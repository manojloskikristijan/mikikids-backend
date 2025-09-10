require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

const userRouter = require("./router/user-router");
const productRouter = require("./router/product-router");
const orderRouter = require("./router/order-router");
const cartRouter = require("./router/cart-router");

const corsOptions = {
    origin: (origin, cb) => cb(null, true), 
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  };
  
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); 
app.use(cookieParser());
app.use(express.json());

app.use("/img", express.static("public/img"));





app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/order", orderRouter);
app.use("/api/cart", cartRouter);


app.use((req, res, next) => {
    throw new Error("Route not found");
});

app.use((err, req, res, next) => {
    res.status(500).json({message: err.message});
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.DATABASE_URL)
.then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((err) => {
    console.log(err);
});





