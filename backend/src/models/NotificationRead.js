const mongoose=require("mongoose");
const schema=new mongoose.Schema({owner:String,key:String,expiresAt:{type:Date,index:{expires:0}}});
schema.index({owner:1,key:1},{unique:true});
module.exports=mongoose.model("NotificationRead",schema);
