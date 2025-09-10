const mongoose = require("mongoose");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    // domain: isProduction ? ".myspotly.com" : "localhost",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };

exports.register = async (req, res, next) => {
    const {name, email, password} = req.body;

    try{
        const existingUser = await User.findOne({email});

        if(existingUser){
            return res.status(400).json({message: "Email already exists"});
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new User({name, email, password: hashedPassword});

        await user.save();


        const token = jwt.sign({user}, process.env.JWT_SECRET, {expiresIn: "1h"});
        const refreshToken = jwt.sign({user}, process.env.JWT_SECRET, {expiresIn: "360d"});

        res.cookie("refreshToken", refreshToken, cookieOptions);

        // Remove password from response
        const userResponse = { ...user.toObject() };
        delete userResponse.password;
        
        res.status(201).json({message: "User registered successfully", user: userResponse, token});

    }catch(err){
        res.status(500).json({message: err.message});
    }
}

exports.login = async (req, res, next) => {
    const {email, password} = req.body;

    if(!email || !password){
        return res.status(400).json({message: "Email and password are required"});
    }

    try{
        const existingUser = await User.findOne({email});

        if(!existingUser){
            return res.status(400).json({message: "User not found"});
        }

        const isPasswordCorrect = await bcrypt.compare(password, existingUser.password);

        if(!isPasswordCorrect){
            return res.status(400).json({message: "Invalid email or password"});
        }

        const token = jwt.sign({user: existingUser}, process.env.JWT_SECRET, {expiresIn: "1h"});
        const refreshToken = jwt.sign({user: existingUser}, process.env.JWT_SECRET, {expiresIn: "360d"});

        res.cookie("refreshToken", refreshToken, cookieOptions);

        // Remove password from response
        const userResponse = { ...existingUser.toObject() };
        delete userResponse.password;
        
        res.status(200).json({message: "User logged in successfully", user: userResponse, token});

    }catch(err){
        res.status(500).json({message: err.message});
    }
}