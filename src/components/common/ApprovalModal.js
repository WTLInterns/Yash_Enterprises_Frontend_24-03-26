import React from "react";

const ApprovalModal = ({ isOpen, type, title, message, onConfirm, onCancel, confirmText = "Send Request", cancelText = "Cancel" }) => {
  if (!isOpen) return null;

  const modalStyles = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };

  const contentStyles = {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center",
  };

  const iconStyles = {
    fontSize: "48px",
    marginBottom: "16px",
  };

  const titleStyles = {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#1f2937",
  };

  const messageStyles = {
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "24px",
    lineHeight: "1.5",
  };

  const buttonContainerStyles = {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  };

  const buttonStyles = {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
  };

  const confirmButtonStyles = {
    ...buttonStyles,
    backgroundColor: type === "error" ? "#dc2626" : "#3b82f6",
    color: "white",
  };

  const cancelButtonStyles = {
    ...buttonStyles,
    backgroundColor: "#f3f4f6",
    color: "#374151",
  };

  const getIcon = () => {
    switch (type) {
      case "error":
        return "⚠️";
      case "success":
        return "✅";
      case "question":
        return "❓";
      default:
        return "ℹ️";
    }
  };

  return (
    <div style={modalStyles}>
      <div style={contentStyles}>
        <div style={iconStyles}>{getIcon()}</div>
        <h3 style={titleStyles}>{title}</h3>
        <p style={messageStyles}>{message}</p>
        
        {type === "question" ? (
          <div style={buttonContainerStyles}>
            <button
              style={cancelButtonStyles}
              onClick={onCancel}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#e5e7eb")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
            >
              {cancelText}
            </button>
            <button
              style={confirmButtonStyles}
              onClick={onConfirm}
              onMouseOver={(e) => (e.target.style.backgroundColor = type === "error" ? "#b91c1c" : "#2563eb")}
              onMouseOut={(e) => (e.target.style.backgroundColor = type === "error" ? "#dc2626" : "#3b82f6")}
            >
              {confirmText}
            </button>
          </div>
        ) : (
          <div style={buttonContainerStyles}>
            <button
              style={confirmButtonStyles}
              onClick={onCancel}
              onMouseOver={(e) => (e.target.style.backgroundColor = type === "error" ? "#b91c1c" : "#2563eb")}
              onMouseOut={(e) => (e.target.style.backgroundColor = type === "error" ? "#dc2626" : "#3b82f6")}
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalModal;
