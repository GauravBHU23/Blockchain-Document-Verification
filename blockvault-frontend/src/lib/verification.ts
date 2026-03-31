const QR_IMAGE_BASE = "https://api.qrserver.com/v1/create-qr-code/";

export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function buildPublicVerifyPath(documentHash: string): string {
  return `/public/verify/${encodeURIComponent(documentHash)}`;
}

export function buildPublicVerifyUrl(documentHash: string): string {
  return `${getAppOrigin()}${buildPublicVerifyPath(documentHash)}`;
}

export function buildQrImageUrl(targetUrl: string): string {
  const url = new URL(QR_IMAGE_BASE);
  url.searchParams.set("size", "220x220");
  url.searchParams.set("data", targetUrl);
  url.searchParams.set("margin", "12");
  return url.toString();
}
