import React, { useRef, useState } from "react";
import { PRODUCT_LANGUAGES, readTranslationProposal } from "../utils/productTranslationForm";
export default function ProductTranslations({ product, options, value, onChange, busy, onSave, approval, setApproval, needsApproval, setNeedsApproval, onError }) {
  const [language, setLanguage] = useState("ky");
  const input = useRef(null);
  const locale = value.translations[language] || {};
  const setField = (field, text) => onChange({ ...value, translations: { ...value.translations, [language]: { ...locale, [field]: text } } });
  const setOption = (option, index, field, text, rawValue) => {
    const id = String(option._id || "");
    const entries = [...value.options];
    const found = entries.findIndex(entry => id ? entry.optionId === id : entry.name === option.name);
    const entry = found >= 0 ? entries[found] : { optionId: id, name: option.name, translations: {} };
    const current = entry.translations[language] || {};
    const labels = Array.isArray(current.values) ? current.values : Object.entries(current.values || {}).map(([value,label]) => ({ value, label }));
    const next = field === "name" ? { ...current, name: text } : { ...current, values: [...labels.filter(item => item.value !== rawValue), { value: rawValue, label: text }] };
    const updated = { ...entry, translations: { ...entry.translations, [language]: next } };
    if (found >= 0) entries[found] = updated; else entries.push(updated);
    onChange({ ...value, options: entries });
  };
  const importDraft = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const manifest = JSON.parse(await file.text());
      onChange(readTranslationProposal(manifest, product)); setNeedsApproval(true); setApproval(false);
    } catch { onError("Котормо файлы туура эмес же товар өзгөргөн. Жаңы долбоорду колдонуп, кайра текшериңиз."); }
    finally { event.target.value = ""; }
  };
  return <section className="pos-form-section pos-translations" aria-labelledby="product-translations-heading"><h3 id="product-translations-heading">Товар котормолору</h3><p>Түпнуска талаалар жана техникалык маанилер сакталат. Бош котормо кардарга түпнуска текстти көрсөтөт.</p><div className="pos-language-tabs" role="tablist" aria-label="Товардын котормо тили">{PRODUCT_LANGUAGES.map(item => <button key={item.code} type="button" role="tab" id={"translation-tab-" + item.code} aria-selected={language === item.code} aria-controls="translation-panel" tabIndex={language === item.code ? 0 : -1} onKeyDown={event => { const index = PRODUCT_LANGUAGES.findIndex(candidate => candidate.code === language); const next = event.key === "ArrowRight" ? (index + 1) % 4 : event.key === "ArrowLeft" ? (index + 3) % 4 : event.key === "Home" ? 0 : event.key === "End" ? 3 : null; if (next !== null) { event.preventDefault(); const code = PRODUCT_LANGUAGES[next].code; setLanguage(code); document.getElementById("translation-tab-" + code)?.focus(); } }} onClick={() => setLanguage(item.code)}>{item.label}<span title="Толтурулган аталыш / сүрөттөмө / категория">{["name", "description", "category"].filter(field => value.translations[item.code]?.[field]?.trim()).length}/3</span></button>)}</div><div id="translation-panel" role="tabpanel" aria-labelledby={"translation-tab-" + language} className="pos-form-grid"><label className="pos-field pos-field--full">Аталыш · {PRODUCT_LANGUAGES.find(item => item.code === language).label}<input name={"translation-name-" + language} value={locale.name || ""} maxLength={200} onChange={event => setField("name",event.target.value)} placeholder="Котормо жок — түпнуска көрсөтүлөт" /></label><label className="pos-field pos-field--full">Сүрөттөмө<textarea name={"translation-description-" + language} value={locale.description || ""} maxLength={4000} onChange={event => setField("description",event.target.value)} placeholder="Ушул тилдеги сүрөттөмө" /></label><label className="pos-field pos-field--full">Категориянын көрүнгөн аталышы<input name={"translation-category-" + language} value={locale.category || ""} maxLength={120} onChange={event => setField("category",event.target.value)} placeholder="Баштапкы категория өзгөрбөйт" /></label>{options.map((option,index) => {
    const entry = value.options.find(item => option._id ? item.optionId === String(option._id) : item.name === option.name);
    const translated = entry?.translations?.[language] || {};
    const labels = Array.isArray(translated.values) ? translated.values : Object.entries(translated.values || {}).map(([value,label]) => ({ value,label }));
    return <fieldset className="pos-option-translations pos-field--full" key={option._id || index}><legend>Вариант: {option.name}</legend><label className="pos-field">Варианттын котормосу<input maxLength={200} value={translated.name || ""} onChange={event => setOption(option,index,"name",event.target.value)} /></label>{(option.values || []).map(raw => <label className="pos-field" key={raw}>{raw}<input maxLength={200} value={labels.find(item => item.value === raw)?.label || ""} onChange={event => setOption(option,index,"value",event.target.value,raw)} /></label>)}</fieldset>;
  })}</div>{product?._id && <div className="pos-translation-actions"><input type="file" ref={input} accept="application/json,.json" hidden onChange={importDraft} /><button type="button" className="pos-button pos-button--quiet" disabled={busy} onClick={() => input.current?.click()}>Котормо долбоорун ачуу</button><button type="button" className="pos-button pos-button--primary" disabled={busy || needsApproval && !approval} onClick={onSave}>Котормолорду гана сактоо</button></div>}{needsApproval && <label className="pos-translation-approval"><input type="checkbox" checked={approval} onChange={event => setApproval(event.target.checked)} />Сунушталган котормолорду текшердим жана бекитем. Файлды ачуу базага эч нерсе жазган жок.</label>}</section>;
}
