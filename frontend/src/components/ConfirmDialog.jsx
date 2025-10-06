// frontend/src/components/ConfirmDialog.jsx
import React from "react";

export default function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-lg p-5 shadow">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-600 mt-2">{message}</p>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-md bg-gray-100">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 rounded-md bg-red-600 text-white">Delete</button>
        </div>
      </div>
    </div>
  );
}
