import React, { useEffect, useRef, useState } from "react";
import { deliveryLabel } from "../i18n/delivery";

const apiKey = import.meta.env.VITE_YANDEX_MAPS_KEY;
const fallback = { lat: 42.8746, lng: 74.5698 };
let loader;

function loadMaps(language) {
  if (!loader) loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const locale = { ky: "ru_RU", ru: "ru_RU", en: "en_US", tr: "tr_TR" }[language] || "en_US";
    script.src = "https://api-maps.yandex.ru/v3/?" + new URLSearchParams({ apikey: apiKey, lang: locale });
    script.onload = () => window.ymaps3?.ready.then(() => resolve(window.ymaps3), reject) ?? reject();
    script.onerror = reject;
    document.head.append(script);
  });
  return loader;
}

export default function DeliveryMap({ language, center = fallback, point, courier, onPoint }) {
  const t = key => deliveryLabel(language, key);
  const element = useRef(null);
  const instance = useRef(null);
  const onSelect = useRef(onPoint);
  onSelect.current = onPoint;
  const [online, setOnline] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    let map;
    loadMaps(language).then(sdk => {
      if (!active) return;
      map = new sdk.YMap(element.current, { location: { center: [center.lng, center.lat], zoom: 12 } });
      map.addChild(new sdk.YMapDefaultSchemeLayer()).addChild(new sdk.YMapDefaultFeaturesLayer());
      map.addChild(new sdk.YMapListener({ layer: "any", onClick: (_, event) => {
        if (event?.coordinates) onSelect.current?.({ lng: event.coordinates[0], lat: event.coordinates[1] });
      } }));
      instance.current = { map, sdk };
      setOnline(true);
    }).catch(() => { if (active) { setOnline(false); setFailed(true); } });
    return () => { active = false; instance.current = null; map?.destroy(); };
  }, [center.lat, center.lng, language]);

  useEffect(() => {
    if (!online || !instance.current) return;
    const { map, sdk } = instance.current;
    const markers = [point, courier].flatMap((position, index) => {
      if (!position) return [];
      const marker = document.createElement("span");
      marker.textContent = index === 0 ? "●" : "◆";
      const child = new sdk.YMapMarker({ coordinates: [position.lng, position.lat] }, marker);
      map.addChild(child);
      return [child];
    });
    return () => { if (instance.current?.map === map) markers.forEach(marker => map.removeChild(marker)); };
  }, [online, point?.lat, point?.lng, courier?.lat, courier?.lng, center.lat, center.lng, language]);

  const width = 0.11, height = 0.08;
  const MapSurface = onPoint ? "button" : "div";
  const marker = (position, symbol) => position && <span aria-hidden="true" style={{
    position: "absolute", left: (50 + (position.lng - center.lng) * 100 / width) + "%",
    top: (50 - (position.lat - center.lat) * 100 / height) + "%",
  }}>{symbol}</span>;
  return <div>
    {apiKey && !failed && <div ref={element} style={{ width: "100%", height: 220 }} aria-label={t("map")} />}
    {(!apiKey || failed) && <>
      <MapSurface {...(onPoint ? { type: "button" } : { role: "img" })} className="cafe-button cafe-button-outline" aria-label={t("map") + " · DEMO"} style={{
        width: "100%", minHeight: 130, position: "relative", overflow: "hidden", display: "block",
      }} onClick={event => {
        if (!onPoint) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onPoint(event.detail === 0 ? center : {
          lng: center.lng + ((event.clientX - rect.left) / rect.width - 0.5) * width,
          lat: center.lat - ((event.clientY - rect.top) / rect.height - 0.5) * height,
        });
      }}>DEMO{marker(point, "●")}{marker(courier, "◆")}</MapSurface>
      {onPoint && <div className="cafe-choice-group">
        <label>{t("latitude")} <input type="number" step="0.0001" value={point?.lat ?? center.lat} onChange={event => {
          if (event.target.value !== "") onPoint({ lat: Number(event.target.value), lng: point?.lng ?? center.lng });
        }} /></label>
        <label>{t("longitude")} <input type="number" step="0.0001" value={point?.lng ?? center.lng} onChange={event => {
          if (event.target.value !== "") onPoint({ lng: Number(event.target.value), lat: point?.lat ?? center.lat });
        }} /></label>
      </div>}
    </>}
  </div>;
}
