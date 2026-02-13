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

export function getPaymentMethodLabel(method: string) {
  switch (method) {
    case "cash":
      return "Tunai";
    case "bank_transfer":
      return "Transfer Bank";
    default:
      return "Lainnya";
  }
}

export function getPaymentTypeLabel(type: string) {
  switch (type) {
    case "income":
      return "Pemasukan";
    case "expense":
      return "Pengeluaran";
    default:
      return "Tidak Diketahui";
  }
}

export function getDebtTypeLabel(type: string) {
  switch (type) {
    case "piutang":
      return "Piutang";
    case "utang":
      return "Utang";
    default:
      return "Tidak Diketahui";
  }
}
