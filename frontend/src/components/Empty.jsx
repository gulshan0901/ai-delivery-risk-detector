import React from "react";
import { Sparkles } from "lucide-react";

export function Empty({ title, text }) {
  return (
    <div className="empty">
      <Sparkles size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}
