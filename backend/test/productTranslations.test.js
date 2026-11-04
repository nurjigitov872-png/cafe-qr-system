const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const Product = require("../src/models/Product");
const { buildTranslationUpdate, TranslationValidationError } = require("../src/utils/productTranslations");
const id = "000000000000000000000001", optionId = "000000000000000000000002";
const source = () => ({ _id: id, name: "Кофе", description: "Түпнуска", category: "Drink", price: 150, image: "https://test.invalid/image.jpg", options: [{ _id: optionId, name: "Объем", values: ["0.3 л", "0.5 л"] }] });
test("legacy products remain valid without any translations", () => {
  const product = new Product(source()); assert.equal(product.validateSync(), undefined);
  assert.equal(product.name,"Кофе"); assert.equal(product.options[0]._id.toString(),optionId);
});
test("four locale schemas round-trip product/category/option labels including decimal raw values", () => {
  const raw=source(); raw.translations={};
  for(const language of ["ky","ru","en","tr"]){raw.translations[language]={name:language+" name",description:language+" description",category:language+" category"};raw.options[0].translations??={};raw.options[0].translations[language]={name:language+" label",values:[{value:"0.3 л",label:language+" 0.3 L"}]};}
  const product=new Product(raw);assert.equal(product.validateSync(),undefined);const json=product.toJSON();
  for(const language of ["ky","ru","en","tr"]){assert.equal(json.translations[language].name,language+" name");assert.equal(json.options[0].translations[language].values[0].value,"0.3 л");}
  assert.equal(json.name,raw.name);assert.equal(json.price,150);assert.equal(json.options[0]._id.toString(),optionId);
});
test("translation PATCH builds only locale field paths and uses option ID array filters", () => {
  const raw=source(),snapshot=JSON.stringify(raw);
  const patch=buildTranslationUpdate(raw,{translations:{en:{name:"Coffee"}},options:[{optionId,translations:{en:{name:"Volume",values:[{value:"0.3 л",label:"0.3 L"}]}}}]});
  assert.deepEqual(Object.keys(patch.update.$set).sort(),["options.$[option0].translations.en.name","options.$[option0].translations.en.values","translations.en.name"]);
  assert.deepEqual(patch.arrayFilters,[{"option0._id":optionId}]);assert.equal(JSON.stringify(raw),snapshot);
});
test("invalid languages, unknown options, protected fields and technical value changes are rejected", () => {
  for(const body of [{price:1},{name:"Changed"},{translations:{fr:{name:"French"}}},{translations:{en:{price:1}}},{options:[{optionId:"other",translations:{en:{name:"X"}}}]},{options:[{optionId,translations:{en:{values:[{value:"0.7 л",label:"X"}]}}}]},{translations:{en:{name:2}}},{translations:{en:{name:"x".repeat(201)}}},{options:[{optionId,translations:{en:{values:[{value:"0.3 л",label:"A"},{value:"0.3 л",label:"B"}]}}}]},{}])assert.throws(()=>buildTranslationUpdate(source(),body),TranslationValidationError);
});
process.env.JWT_SECRET=crypto.randomBytes(48).toString("hex");process.env.ADMIN_USERNAME="mock-admin";
const { signToken }=require("../src/middleware/auth");let reads=0,writes=0,lastUpdate,lastOptions;
const mock={findById:async()=>{reads++;return source();},findByIdAndUpdate:async(_id,update,options)=>{writes++;lastUpdate=update;lastOptions=options;return{...source(),translations:{en:{name:"Coffee"}}};}};
const filename=require.resolve("../src/models/Product");require.cache[filename]={id:filename,filename,loaded:true,exports:mock};
const app=express();app.use(express.json());app.use("/api/products",require("../src/routes/productRoutes"));let server,base;
before(async()=>{server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));base="http://127.0.0.1:"+server.address().port;});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
async function request(token,body){const r=await fetch(base+"/api/products/"+id+"/translations",{method:"PATCH",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};}
test("translation API rejects missing/invalid/customer tokens before model access",async()=>{const baseline={reads,writes};for(const [token,status]of [[undefined,401],["invalid",401],[signToken({role:"customer"},id),403]])assert.equal((await request(token,{translations:{en:{name:"Coffee"}}})).status,status);assert.deepEqual({reads,writes},baseline);});
test("admin can update labels with validators, while protected writes return 400",async()=>{const token=signToken({role:"admin"},"mock-admin");const response=await request(token,{translations:{en:{name:"Coffee"}},options:[{optionId,translations:{en:{values:[{value:"0.3 л",label:"0.3 L"}]}}}]});assert.equal(response.status,200);assert.equal(lastOptions.runValidators,true);assert.ok(lastOptions.arrayFilters.length===1);assert.ok(Object.keys(lastUpdate.$set).every(key=>key.startsWith("translations.")||key.startsWith("options.$[")));const count=writes;assert.equal((await request(token,{price:0})).status,400);assert.equal(writes,count);});
