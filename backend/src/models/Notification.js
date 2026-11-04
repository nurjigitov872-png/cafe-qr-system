const mongoose = require("mongoose");
const schema = new mongoose.Schema({
 key:{type:String,unique:true,required:true}, audiences:[String], kind:String, orderId:String,
 status:String, tableNumber:Number, createdAt:{type:Date,default:Date.now},
 expiresAt:{type:Date,required:true,index:{expires:0}}
});
schema.index({audiences:1,createdAt:-1});
module.exports=mongoose.model("Notification",schema);
