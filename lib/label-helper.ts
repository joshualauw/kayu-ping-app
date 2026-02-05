export function getContactCategoryLabel(category: string) {
  switch (category) {
    case "supplier":
      return "Supplier";
    case "client":
      return "Langganan";
    case "driver":
      return "Supir";
    default:
      return "Lainnya";
  }
}
