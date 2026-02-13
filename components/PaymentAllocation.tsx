import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { invoices, paymentAllocations } from "@/db/schema";
import { formatCurrency, formatNumber, unformatNumber } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { and, asc, eq, sql } from "drizzle-orm";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export interface AllocationItem {
  id: string;
  invoiceId: number | null;
  amount: number;
}

interface InvoiceOption {
  id: number;
  code: string;
  amount: number;
  entryDate: string;
}

interface PaymentAllocationProps {
  visible: boolean;
  amount: number;
  contactId: number | null;
  type: "income" | "expense";
  initialAllocations?: AllocationItem[];
  onApply: (allocations: AllocationItem[]) => void;
  onClose: () => void;
}

export default function PaymentAllocationModal({
  visible,
  amount,
  contactId,
  type,
  initialAllocations,
  onApply,
  onClose,
}: PaymentAllocationProps) {
  const [allocations, setAllocations] = useState<AllocationItem[]>(initialAllocations ?? []);
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAllocations(initialAllocations ?? []);
    setOpenDropdownId(null);
  }, [initialAllocations, visible]);

  useEffect(() => {
    const fetchData = async () => {
      if (!visible) return;

      try {
        setLoading(true);

        if (!contactId) {
          setInvoiceOptions([]);
          return;
        }

        const invoicesWithAllocations = await db
          .select({
            id: invoices.id,
            code: invoices.code,
            amount: invoices.amount,
            entryDate: invoices.entryDate,
            totalAllocated: sql<number>`COALESCE(SUM(${paymentAllocations.amount}), 0)`.as("total_allocated"),
          })
          .from(invoices)
          .leftJoin(paymentAllocations, eq(paymentAllocations.invoiceId, invoices.id))
          .where(and(eq(invoices.contactId, contactId), eq(invoices.type, type === "income" ? "sales" : "purchase")))
          .groupBy(invoices.id)
          .orderBy(asc(invoices.entryDate));

        const invoicesWithRemaining = invoicesWithAllocations
          .map((inv) => ({
            id: inv.id,
            code: inv.code,
            entryDate: inv.entryDate,
            amount: Math.max(0, inv.amount - inv.totalAllocated),
          }))
          .filter((inv) => inv.amount > 0);

        setInvoiceOptions(invoicesWithRemaining);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contactId, type, visible]);

  const addAllocation = () => {
    const newId = Date.now().toString();
    setAllocations([...allocations, { id: newId, invoiceId: null, amount: 0 }]);
  };

  const autoAllocate = () => {
    if (!amount || invoiceOptions.length === 0) return;

    const newAllocations: AllocationItem[] = [];
    let remainingBalance = amount;

    const sortedInvoices = [...invoiceOptions].sort((a, b) => {
      return new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
    });

    for (const invoice of sortedInvoices) {
      if (remainingBalance <= 0) break;

      const amountToAllocate = Math.min(remainingBalance, invoice.amount);

      newAllocations.push({
        id: Date.now().toString() + Math.random(),
        invoiceId: invoice.id,
        amount: amountToAllocate,
      });

      remainingBalance -= amountToAllocate;
    }

    setAllocations(newAllocations);
  };

  const deleteAllocation = (allocationId: string) => {
    setAllocations(allocations.filter((a) => a.id !== allocationId));
  };

  const updateAllocation = (allocationId: string, invoiceId: number | null, amount: number) => {
    setAllocations(allocations.map((a) => (a.id === allocationId ? { ...a, invoiceId, amount } : a)));
  };

  const getRemainingBalance = () => {
    if (!amount) return 0;
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    return amount - allocated;
  };

  const renderAllocationItem = (item: AllocationItem, index: number) => {
    const matchingInvoice = invoiceOptions.find((inv) => inv.id === item.invoiceId);

    return (
      <View key={item.id} style={styles.allocationCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Alokasi {index + 1}</Text>
          <Pressable onPress={() => deleteAllocation(item.id)}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={Colors.danger} />
          </Pressable>
        </View>

        <View style={{ marginBottom: Spacing.sm, position: "relative" }}>
          <Pressable
            style={[styles.input, styles.dropdownInput]}
            onPress={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
          >
            <Text style={{ color: item.invoiceId ? Colors.text : Colors.border }}>
              {matchingInvoice ? matchingInvoice.code : "Pilih Nota"}
            </Text>
          </Pressable>

          {openDropdownId === item.id && (
            <View style={styles.dropdown}>
              {invoiceOptions.map((inv) => (
                <Pressable
                  key={inv.id}
                  style={styles.option}
                  onPress={() => {
                    updateAllocation(item.id, inv.id, item.amount);
                    setOpenDropdownId(null);
                  }}
                >
                  <Text style={styles.optionText}>{inv.code}</Text>
                  <Text style={styles.optionAmount}>Sisa: {formatCurrency(inv.amount)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View>
          <Text style={styles.amountLabel}>Jumlah (Rp.)</Text>
          <View style={styles.amountInputRow}>
            <Text style={styles.amountPrefix}>{matchingInvoice ? formatCurrency(matchingInvoice.amount) : "Rp 0"}</Text>
            <Text style={styles.amountSeparator}>-</Text>
            <TextInput
              style={[styles.input, styles.amountInputField]}
              placeholder="0"
              keyboardType="numeric"
              value={formatNumber(item.amount)}
              onChangeText={(text) => {
                const cleanNumber = unformatNumber(text);
                updateAllocation(item.id, item.invoiceId, Number(cleanNumber) || 0);
              }}
            />
          </View>
          <View style={styles.remainingAmountRow}>
            <Text style={styles.remainingLabel}>Sisa:</Text>
            <Text
              style={[
                styles.remainingAmount,
                matchingInvoice && matchingInvoice.amount - item.amount <= 0 && styles.remainingDanger,
              ]}
            >
              {formatCurrency(matchingInvoice ? matchingInvoice.amount - item.amount : 0)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const remaining = useMemo(() => getRemainingBalance(), [amount, allocations]);
  const isNegativeBalance = remaining < 0;

  useEffect(() => {
    const validate = () => {
      const hasDuplicateInvoices = new Set(allocations.map((a) => a.invoiceId)).size !== allocations.length;
      if (hasDuplicateInvoices) {
        return "Ada duplikasi pada pilihan nota.";
      }

      if (allocations.some((a) => !a.invoiceId)) {
        return "Semua baris harus memiliki nota yang dipilih.";
      }
      if (allocations.some((a) => a.amount <= 0)) {
        return "Semua jumlah alokasi harus lebih besar dari nol.";
      }

      const overAllocated = allocations.some((a) => {
        const inv = invoiceOptions.find((i) => i.id === a.invoiceId);
        return inv && a.amount > inv.amount;
      });
      if (overAllocated) {
        return "Satu atau lebih alokasi melebihi sisa saldo nota.";
      }

      if (remaining < 0) {
        return "Total alokasi melebihi jumlah pembayaran.";
      }

      return null;
    };

    setError(validate());
  }, [allocations, invoiceOptions, remaining]);

  const disableSave = !!error;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alokasi Pembayaran</Text>
                <Pressable onPress={onClose} style={styles.modalCloseButton}>
                  <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading ? (
                  <Text style={styles.loadingText}>Loading...</Text>
                ) : (
                  <>
                    <View style={styles.balanceContainer}>
                      <Text style={styles.balanceLabel}>Belum Dialokasikan</Text>
                      <Text style={[styles.balanceAmount, isNegativeBalance && styles.balanceNegative]}>
                        {formatCurrency(remaining)}
                      </Text>
                    </View>

                    <View style={styles.listHeaderContainer}>
                      <Text style={styles.listTitle}>Daftar Alokasi</Text>
                      <View style={styles.headerButtons}>
                        <Pressable style={styles.autoAllocateButton} onPress={autoAllocate}>
                          <MaterialCommunityIcons name="auto-fix" size={18} color={Colors.primary} />
                        </Pressable>
                        <Pressable style={styles.addButton} onPress={addAllocation}>
                          <MaterialCommunityIcons name="plus" size={20} color="white" />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.allocationsList}>
                      {allocations.length === 0 ? (
                        <Text style={styles.emptyText}>Belum ada alokasi</Text>
                      ) : (
                        allocations.map((item, index) => renderAllocationItem(item, index))
                      )}
                    </View>

                    <Pressable
                      style={[styles.saveButton, disableSave && styles.saveButtonDisabled]}
                      disabled={disableSave}
                      onPress={() => {
                        onApply(allocations);
                        onClose();
                      }}
                    >
                      <Text style={styles.saveButtonText}>Simpan</Text>
                    </Pressable>
                    <Text style={styles.errorText}>{error}</Text>
                  </>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: "92%",
    width: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: Spacing.lg,
  },
  balanceContainer: {
    backgroundColor: Colors.secondary,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text,
  },
  balanceNegative: {
    color: Colors.danger,
  },
  listHeaderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  headerButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  autoAllocateButton: {
    backgroundColor: Colors.secondary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  allocationsList: {
    marginBottom: Spacing.md,
  },
  allocationCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    color: Colors.text,
  },
  dropdownInput: {
    justifyContent: "center",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    zIndex: 10,
    maxHeight: 150,
    marginTop: 4,
    overflow: "hidden",
  },
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  optionText: {
    fontSize: 14,
    color: Colors.text,
  },
  optionAmount: {
    fontSize: 12,
    color: "#666",
  },
  amountLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  amountPrefix: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  amountSeparator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
  },
  amountInputField: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  amountInput: {
    paddingVertical: Spacing.sm,
  },
  remainingAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  remainingLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },
  remainingAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  remainingDanger: {
    color: Colors.danger,
  },
  emptyText: {
    textAlign: "center",
    color: "#888",
    paddingVertical: Spacing.md,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    color: Colors.danger,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  loadingText: {
    textAlign: "center",
    color: Colors.text,
    paddingVertical: Spacing.lg,
  },
});
