import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { createProduct, deleteProduct, fetchProducts, updateProduct } from "../services/api";
import { useAdminAuth } from "./useAdminAuth";
const emptyForm = { name:"", category:"Coffee", price:100, image:"", description:"", available:true, hidden:false, popular:false, discountPrice:"", optionsText:"" };
export default function AdminProducts() {
  useAdminAuth();
  const [products, setProducts] = useState([]), [form, setForm] = useState(emptyForm), [editingId, setEditingId] = useState(""), [search, setSearch] = useState("");
  const load = async () => setProducts(await fetchProducts({ adminView:"true" }));
  useEffect(() => { load().catch((e) => alert(e.message)); }, []);
  const filtered = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const resetForm = () => { setEditingId(""); setForm(emptyForm); };
  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...form, price:Number(form.price), discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      options: form.optionsText ? form.optionsText.split(";").map((item)=>{ const [name, values] = item.split(":"); return { name:(name||"").trim(), values:(values||"").split(",").map((v)=>v.trim()).filter(Boolean) }; }).filter((item)=>item.name) : [] };
    delete payload.optionsText;
    if (editingId) await updateProduct(editingId, payload); else await createProduct(payload);
    resetForm(); await load();
  };
  const startEdit = (product) => setForm({ name:product.name, category:product.category, price:product.price, image:product.image||"", description:product.description||"", available:product.available, hidden:product.hidden, popular:product.popular, discountPrice:product.discountPrice || "", optionsText:(product.options||[]).map((o)=>`${o.name}:${(o.values||[]).join(",")}`).join(";") }) || setEditingId(product._id);
  return <AdminLayout title="Products"><div className="two-col-grid"><form className="card" onSubmit={submit}><h3>{editingId ? "Продукт оңдоо" : "Продукт кошуу"}</h3><div className="form-grid"><input value={form.name} onChange={(e)=>setForm({ ...form, name:e.target.value })} placeholder="Name" /><input value={form.category} onChange={(e)=>setForm({ ...form, category:e.target.value })} placeholder="Category" /><input type="number" value={form.price} onChange={(e)=>setForm({ ...form, price:e.target.value })} placeholder="Price" /><input type="number" value={form.discountPrice} onChange={(e)=>setForm({ ...form, discountPrice:e.target.value })} placeholder="Discount price" /><input value={form.image} onChange={(e)=>setForm({ ...form, image:e.target.value })} placeholder="Image URL" /><textarea value={form.description} onChange={(e)=>setForm({ ...form, description:e.target.value })} placeholder="Description" /><textarea value={form.optionsText} onChange={(e)=>setForm({ ...form, optionsText:e.target.value })} placeholder="Options: Size:S,M,L;Milk:Regular,Oat" /></div><div className="check-grid"><label><input type="checkbox" checked={form.available} onChange={(e)=>setForm({ ...form, available:e.target.checked })} /> available</label><label><input type="checkbox" checked={form.hidden} onChange={(e)=>setForm({ ...form, hidden:e.target.checked })} /> hidden</label><label><input type="checkbox" checked={form.popular} onChange={(e)=>setForm({ ...form, popular:e.target.checked })} /> popular</label></div><div className="button-row"><button className="small-btn" type="submit">{editingId ? "Сактоо" : "Кошуу"}</button><button className="secondary-link buttonish" type="button" onClick={resetForm}>Тазалоо</button></div></form><div className="card"><div className="toolbar"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search product" /></div><div className="list-box">{filtered.map((product)=><div className="product-admin-row" key={product._id}><div><b>{product.name}</b><div className="muted">{product.category} · {product.price} сом</div></div><div className="button-row wrap"><button className="small-btn" onClick={()=>{ setEditingId(product._id); startEdit(product); }}>edit</button><button className="danger-btn small-btn" onClick={()=>deleteProduct(product._id).then(load)}>delete</button></div></div>)}</div></div></div></AdminLayout>;
}
