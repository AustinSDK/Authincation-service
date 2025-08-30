require("dotenv").config();

const db = require("./libs/db")

const path = require("path");
const fs = require("fs")

const express = require("express");
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const auth = require("./libs/auth")(express,db);
app.use(auth.router);

app.set("views", path.join(__dirname, "pages"));
app.set("view engine", "ejs");

// dynamic file paths

// css paths
app.get("/css/:path",(req,res,next)=>{
    // get path
    const css_path = path.join(__dirname,'css')
    const _path = path.join(css_path,req.params.path)

    // check path to make sure its real
    if (!_path.startsWith(css_path)) return next()

    // send file
    if (!fs.existsSync(_path)) return next();
    res.sendFile(_path)
});

// TODO: make a basic user auth
// app.get("/createuser",async (req,res,next)=>{
//     let username = req.query.username;
//     let password = req.query.password;

//     return res.send(await auth.createAccount(username,password))
// })

// Static file paths
app.get("/",(req,res)=>{
    res.render("index.ejs");
});

const port = process.env.port
app.listen(port,e=>{
    if (e){
        console.error(e);
        return;
    }
    console.log("hosting on port "+port);
});