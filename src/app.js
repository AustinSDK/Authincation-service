require("dotenv").config()

const express = require("express");
const app = express();

app.get("/",(req,res)=>{
    res.send("hii")
})

const port = process.env.port
app.listen(port,e=>{
    if (e){
        console.error(e)
        return
    }
    console.log("hosting on port "+port)
})