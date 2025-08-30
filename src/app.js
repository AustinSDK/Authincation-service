const express = require("express");
const app = express();

app.get("/",(req,res)=>{
    res.send("hii")
})

app.listen(3000,e=>{
    if (e){
        console.error(e)
        return
    }
    console.log("hosting on port "+3000)
})