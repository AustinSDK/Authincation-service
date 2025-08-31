require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const db = require("./libs/db")

const path = require("path");
const fs = require("fs")

const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const auth = require("./libs/auth")(express,db);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Add cache-control headers to prevent caching issues
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
});

app.use((req,res,next)=>{
    if (!req.cookies || !req.cookies.token){
        req.user = false;
    } else {
        let user = auth.getUserFromToken(req.cookies.token);

        if (user) {
            try {
                // Handle case where permissions might be null, undefined, empty string, array, or malformed JSON
                if (!user.permissions) {
                    user.permissions = [];
                } else if (Array.isArray(user.permissions)) {
                    // Already an array, use as is
                    user.permissions = user.permissions;
                } else if (typeof user.permissions === 'string') {
                    if (user.permissions.trim() === '') {
                        user.permissions = [];
                    } else {
                        user.permissions = JSON.parse(user.permissions);
                    }
                } else {
                    // Unknown type, default to empty array
                    user.permissions = [];
                }
            } catch (error) {
                console.error('Error parsing user permissions:', error);
                console.error('Problematic permissions value:', user.permissions);
                console.error('Permissions type:', typeof user.permissions);
                user.permissions = [];
            }
            user.token = req.cookies.token;
            req.user = user;
        } else {
            req.user = false;
        }
    }
    next();
});

let globalPermissions = []

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
    res.render("register.ejs", { user: req.user || null })
})
app.get("/login",async (req,res,next)=>{
    res.render("login.ejs", { user: req.user || null })
})

// Static file paths
app.get("/",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("index.ejs",{user:user,projects:projects});
});
app.get("/projects",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("projects.ejs",{user:user,projects:projects});
});
app.get("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.redirect("/login")
    }
    let projects = auth.getProjects(user.permissions)
    res.render("create-project.ejs",{user:user,projects:projects});
});

app.get("/settings",(req,res,next)=>{
    if (!req.user){
        return res.redirect('/login');
    }
    res.redirect(`/user/${req.user.id}/settings`)
})

// user settings mhm
app.get("/user/:id/settings", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user || (user.id !== id && (!user.permissions.includes("admin")))){
        return res.redirect("/login")
    }
    res.render("user-settings",{tokens:auth.getUserTokens(id),user:req.user})
})

// project settings
app.get("/project/:id", async (req,res,next)=>{
    let user = req.user
    let id = parseInt(req.params.id, 10)
    if (!user.permissions.includes("editor") && !user.permissions.includes("editor")){
        return res.redirect("/login")
    }
    res.render("create-project",{tokens:auth.getUserTokens(id),user:req.user})
})

// projects creation :shrug:
app.post("/projects/create",(req,res)=>{
    let user = req.user
    if (!user){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Check if user has proper permissions to create projects
    if (!user.permissions.includes("admin") && !user.permissions.includes("editor")) {
        return res.status(403).json({ message: "Insufficient permissions to create projects" });
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
        return res.status(400).json({ message: error.message });
    }
});
app.post("/projects/delete",(req,res)=>{
    let user = req.user
    if (!user || !user.permissions){
        return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.body || !req.body.id){
        return res.status(400).json({ message: "Project ID is required" });
    }
    
    // Check if user has admin permissions or is the project owner
    if (!user.permissions.includes("admin")) {
        return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    try {
        const result = auth.deleteProject(parseInt(req.body.id, 10));
        res.json({ message: "Project deleted successfully", result });
    } catch (error) {
        res.status(500).json({ message: "Error deleting project" });
    }
})

const port = process.env.PORT
app.listen(port,e=>{
    if (e){
        console.error(e);
        return;
    }
    console.log("hosting on port "+port);
});
