import React from "react";

export function Signal({ icon: Icon, label, value }) {
  return (
    <div className="signal">
      <Icon size={19} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
