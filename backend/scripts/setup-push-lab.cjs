// Run manually when ready. Generates only local test secrets; never prints them.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"../.."),file=path.join(root,".env.push-lab");
if(fs.existsSync(file))throw Error(".env.push-lab already exists; refusing to overwrite test secrets");
execFileSync("git",["check-ignore","--quiet",".env.push-lab"],{cwd:root,stdio:"ignore"});
const keys=require("web-push").generateVAPIDKeys();
const text=["PUSH_LAB_ORIGIN=https://push-test.example.com","PUSH_LAB_ADMIN_USERNAME=push-test-admin","PUSH_LAB_ADMIN_PASSWORD="+crypto.randomBytes(24).toString("base64url"),"PUSH_LAB_JWT_SECRET="+crypto.randomBytes(48).toString("base64url"),"PUSH_LAB_ENABLE_REAL_PUSH=false","VAPID_SUBJECT=mailto:you@example.com","VAPID_PUBLIC_KEY="+keys.publicKey,"VAPID_PRIVATE_KEY="+keys.privateKey,""].join("\n");
fs.writeFileSync(file,text,{encoding:"utf8",mode:0o600,flag:"wx"});console.log("Private .env.push-lab created and ignored by Git. Edit it locally; do not paste its contents into chat.");
