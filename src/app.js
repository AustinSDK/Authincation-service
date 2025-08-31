require("dotenv").config();

const db = require("./libs/db")

const path = require("path");
const fs = require("fs")

const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const { stringify } = require("querystring");
const { date } = require("joi");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req,res,next)=>{
    if (!req.cookies || !req.cookies.token){
        req.user = false;
    } else{
        req.user = auth.getUserFromToken(req.cookies.token);
    }
    next()
})

const auth = require("./libs/auth")(express,db);
app.use(auth.router);

app.set("views", path.join(__dirname, "pages"));
app.set("view engine", "ejs");

// dynamic file paths

// css paths
app.get("/css/:path",(req,res,next)=>{
    // get path
    const css_path = path.join(__dirname,'css');
    const _path = path.join(css_path,req.params.path);

    // check path to make sure its real
    if (!_path.startsWith(css_path)) return next();

    // send file
    if (!fs.existsSync(_path)) return next();
    res.sendFile(_path);
});

// User auth endpoints? static.
app.get("/register",async (req,res,next)=>{
    res.render("register.ejs")
})
app.get("/login",async (req,res,next)=>{
    res.render("login.ejs")
})

// Static file paths
app.get("/",(req,res)=>{
    let user = req.user
    if (!user){
        res.redirect("/login")
    }
    res.render("index.ejs",{token:stringify(user)});
});

const port = process.env.port
app.listen(port,e=>{
    if (e){
        console.error(e);
        return;
    }
    console.log("hosting on port "+port);
});