const mongoose=require("mongoose");
const schema=new mongoose.Schema({owner:String,endpointHash:String,subscription:mongoose.Schema.Types.Mixed,language:String,expiresAt:{type:Date,index:{expires:0}}});
schema.index({owner:1,endpointHash:1},{unique:true});
module.exports=mongoose.model("PushSubscription",schema);
