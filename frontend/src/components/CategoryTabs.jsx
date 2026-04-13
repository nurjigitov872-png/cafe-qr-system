import React from "react";
export default function CategoryTabs({ categories, activeCategory, onSelect }) {
  return <div className="category-tabs"><button className={!activeCategory ? "active" : ""} onClick={()=>onSelect("")}>Баары</button>{categories.map(cat=><button key={cat} className={activeCategory===cat?"active":""} onClick={()=>onSelect(cat)}>{cat}</button>)}</div>;
}
