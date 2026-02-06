import dayjs from "dayjs";

export function generateInvoiceCode(type: "sales" | "purchase", contactName: string): string {
  const typeSegment = type === "sales" ? "JUAL" : "BELI";

  const initials = contactName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const timestamp = dayjs().format("DDMMYYHHmmss");

  return `INV-${typeSegment}-${initials}-${timestamp}`;
}
