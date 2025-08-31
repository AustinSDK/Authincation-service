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
        let user = auth.getUserFromToken(req.cookies.token);
        user.permissions = JSON.parse(user.permissions)
        req.user = user
    }
    next()
})

let globalPermissions = []

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

// js paths
app.get("/js/:path",(req,res,next)=>{
    // get path
    const js_path = path.join(__dirname,'js');
    const _path = path.join(js_path,req.params.path);

    // check path to make sure its real
    if (!_path.startsWith(js_path)) return next();

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
    let projects = auth.getProjects(user.permissions)
    res.render("index.ejs",{user:user,projects:projects});
});
app.get("/projects",(req,res)=>{
    let user = req.user
    if (!user){
        res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("projects.ejs",{user:user,projects:projects});
});
app.get("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("create-project.ejs",{user:user,projects:projects});
});

// user settings mhm
app.get("/user/:id/settings", async (req,res,next)=>{
    let user = req.user
    let id = req.params.id
    if (!user || (user.id !== id && (!user.permissions.includes("admin")))){
        res.redirect("/login")
    }
    res.render("user-settings",{tokens:auth.getUserTokens(req.params.id)})
})

// projects creation :shrug:
app.post("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
        const { name, description, link, permissions } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Project name is required" });
        }
        
        const result = auth.createProject(name.trim(), description || "", link || "/", permissions || []);
        res.json({ 
            message: "Project created successfully",
            projectId: result.lastInsertRowid
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});
app.get("/delete",(req,res)=>{
    let user = req.user
    if (!user || !user.permissions){
        res.redirect("/login")
    }
    
    if (!req.query || !req.query.id){
        return res.status(400).send("Giveme ID")
    }
    
    res.send(auth.deleteProject(req.query.id))
})

const port = process.env.port
app.listen(port,e=>{
    if (e){
        console.error(e);
        return;
    }
    console.log("hosting on port "+port);
});