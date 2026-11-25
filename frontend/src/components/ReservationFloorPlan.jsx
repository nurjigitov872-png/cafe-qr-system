import React from "react";

export default function ReservationFloorPlan({ tables, selected, onSelect, label, seats, admin = false }) {
  const columns = Math.max(1, ...tables.map(table => table.position?.column ?? 1));
  return <div role="group" aria-label={label} style={{
    display: "grid", gridTemplateColumns: "repeat(" + columns + ", minmax(0, 1fr))", gap: "0.5rem",
  }}>
    {tables.map(table => {
      const content = <><strong>№{table.number}</strong><br />{seats} · {table.capacity}</>;
      const style = table.position && { gridColumn: table.position.column, gridRow: table.position.row };
      return onSelect
        ? <button type="button" key={table.number} style={style}
            className={admin
              ? "pos-button " + (selected === table.number ? "pos-button--primary" : "pos-button--quiet")
              : "cafe-button " + (selected === table.number ? "cafe-button-primary" : "cafe-button-outline")}
            disabled={table.available === false} aria-pressed={selected === table.number}
            onClick={() => onSelect(table.number)}>{content}</button>
        : <div key={table.number} style={style} className={admin ? "pos-panel" : undefined}>{content}</div>;
    })}
  </div>;
}
