'use client';

export default function UpiQrCode({ upiUri, amount, upiId }) {
  if (!upiUri) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 text-sm">No UPI ID</span>
        </div>
        <p className="text-sm text-gray-600 mt-2">Enter UPI ID to generate QR code</p>
      </div>
    );
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <img
          src={qrCodeUrl}
          alt="UPI QR Code"
          className="w-32 h-32 border-2 border-gray-300 rounded-lg"
        />
      </div>
      
      <div className="text-center space-y-1">
        <p className="text-sm text-gray-600">Scan to pay</p>
        <p className="text-xs text-gray-600">Amount: ₹{Number(amount || 0).toFixed(2)}</p>
        <p className="text-xs text-gray-500">Maximum ₹1,00,000 via UPI</p>
        <p className="text-xs font-medium text-gray-700">UPI ID: {upiId}</p>
      </div>
    </div>
  );
}
