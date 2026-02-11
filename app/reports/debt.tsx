import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, payments } from "@/db/schema";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq, like } from "drizzle-orm";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface ContactFilterItem {
  id: number;
  name: string;
  phoneNumber: string;
}

interface DebtItem {
  id: number;
  type: "invoice" | "payment";
  date: string;
  amount: number;
  code?: string;
}

export default function DebtReportScreen() {
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactFilterItem[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [debtData, setDebtData] = useState<DebtItem[]>([]);
  const [debtLoading, setDebtLoading] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(0);

  const fetchDebtData = async (contactId: number | null) => {
    if (contactId === null) {
      setDebtData([]);
      setRemainingAmount(0);
      return;
    }

    try {
      setDebtLoading(true);

      const invoiceRes = await db
        .select({
          id: invoices.id,
          date: invoices.entryDate,
          amount: invoices.amount,
          code: invoices.code,
        })
        .from(invoices)
        .where(eq(invoices.contactId, contactId));

      const paymentRes = await db
        .select({
          id: payments.id,
          date: payments.paymentDate,
          amount: payments.amount,
        })
        .from(payments)
        .where(eq(payments.contactId, contactId));

      const combinedData: DebtItem[] = [
        ...invoiceRes.map((inv) => ({
          id: inv.id,
          type: "invoice" as const,
          date: inv.date,
          amount: inv.amount,
          code: inv.code,
        })),
        ...paymentRes.map((pay) => ({
          id: pay.id,
          type: "payment" as const,
          date: pay.date,
          amount: pay.amount,
        })),
      ];

      combinedData.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

      const total = combinedData.reduce((sum, item) => {
        return item.type === "invoice" ? sum + item.amount : sum - item.amount;
      }, 0);

      setDebtData(combinedData);
      setRemainingAmount(total);
    } catch (err) {
      console.error(err);
    } finally {
      setDebtLoading(false);
    }
  };

  const fetchContacts = async (query: string = "") => {
    if (contactLoading) return;

    try {
      setContactLoading(true);

      let filters = [];

      if (query.trim()) {
        filters.push(like(contacts.name, `%${query.trim()}%`));
      }

      let q = db
        .select({
          id: contacts.id,
          name: contacts.name,
          phoneNumber: contacts.phoneNumber,
        })
        .from(contacts)
        .where(and(...filters))
        .orderBy(desc(contacts.id))
        .limit(40);

      const res = await q;
      setContactResults(res as ContactFilterItem[]);
    } catch (err) {
      console.error(err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSelectContact = (contact: ContactFilterItem) => {
    setSelectedContactId(contact.id);
    setSelectedContactName(contact.name);
    setFilterVisible(false);
    fetchDebtData(contact.id);
  };

  const handleClearFilter = () => {
    setSelectedContactId(null);
    setSelectedContactName(null);
    fetchDebtData(null);
  };

  useEffect(() => {
    if (!filterVisible) return;

    const delayDebounceFn = setTimeout(() => {
      fetchContacts(filterQuery);
    }, 100);

    return () => clearTimeout(delayDebounceFn);
  }, [filterQuery, filterVisible]);

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ContactFilter
          selectedContactName={selectedContactName}
          onOpenFilter={() => setFilterVisible(true)}
          onClearFilter={handleClearFilter}
        />

        {selectedContactId !== null ? (
          <>
            {debtLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.debtContainer}>
                <Text style={styles.sectionTitle}>Riwayat Hutang</Text>

                {debtData.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada hutang untuk kontak ini.</Text>
                ) : (
                  <View style={styles.debtList}>
                    {debtData.map((item, index) => (
                      <Pressable
                        key={`${item.type}-${item.id}-${index}`}
                        style={({ pressed }) => [
                          styles.debtItem,
                          { backgroundColor: pressed ? Colors.secondary : "transparent" },
                        ]}
                        onPress={() => {
                          if (item.type === "invoice") {
                            router.push(`/invoice/${item.id}`);
                          } else {
                            router.push(`/payment/${item.id}`);
                          }
                        }}
                      >
                        <View style={styles.debtLeftSection}>
                          {item.type === "invoice" && item.code && <Text style={styles.debtCode}>#{item.code}</Text>}
                          <Text style={styles.debtDate}>{dayjs(item.date).format("DD MMM YYYY")}</Text>
                        </View>
                        <View style={styles.debtAmountContainer}>
                          <MaterialCommunityIcons
                            name={item.type === "invoice" ? "minus" : "plus"}
                            size={16}
                            color={item.type === "invoice" ? "#EF4444" : "#19a14b"}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.debtAmount,
                              item.type === "invoice" ? styles.debtAmountInvoice : styles.debtAmountPayment,
                            ]}
                          >
                            {formatCurrency(item.amount)}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                <View style={styles.remainingContainer}>
                  <Text style={styles.remainingLabel}>Total Sisa Utang:</Text>
                  <View style={styles.remainingAmountContainer}>
                    <Text style={styles.remainingAmount}>{formatCurrency(Math.abs(remainingAmount))}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.placeholderText}>Pilih kontak untuk melihat riwayat hutang.</Text>
        )}

        <ContactFilterModal
          visible={filterVisible}
          onClose={() => setFilterVisible(false)}
          selectedContactId={selectedContactId}
          filterQuery={filterQuery}
          onFilterQueryChange={setFilterQuery}
          contactResults={contactResults}
          contactLoading={contactLoading}
          onSelectContact={handleSelectContact}
        />
      </ScrollView>
    </Container>
  );
}

export function ContactFilter({ selectedContactName, onOpenFilter, onClearFilter }: any) {
  return (
    <View style={styles.filterButtonContainer}>
      <Pressable style={styles.filterButton} onPress={onOpenFilter}>
        <MaterialCommunityIcons name="filter-variant" size={18} color={Colors.text} />
        <Text style={styles.filterButtonText}>{selectedContactName ? `${selectedContactName}` : "Filter Kontak"}</Text>
      </Pressable>
      {selectedContactName && (
        <Pressable style={styles.clearFilterButton} onPress={onClearFilter}>
          <MaterialCommunityIcons name="close" size={18} color={Colors.text} />
        </Pressable>
      )}
    </View>
  );
}

export function ContactFilterModal({
  visible,
  onClose,
  selectedContactId,
  filterQuery,
  onFilterQueryChange,
  contactResults,
  contactLoading,
  onSelectContact,
}: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Pilih Kontak</Text>

              <View style={styles.sheetSearchContainer}>
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Cari kontak..."
                  placeholderTextColor="#9CA3AF"
                  value={filterQuery}
                  onChangeText={onFilterQueryChange}
                />
              </View>

              {contactLoading && <ActivityIndicator style={{ marginTop: Spacing.sm }} />}

              <FlatList
                style={styles.sheetList}
                data={contactResults}
                keyExtractor={(item: ContactFilterItem) => item.id.toString()}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.contactRow, selectedContactId === item.id && styles.contactRowSelected]}
                    onPress={() => onSelectContact(item)}
                  >
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumber ? <Text style={styles.contactPhone}>{item.phoneNumber}</Text> : null}
                  </Pressable>
                )}
                ListEmptyComponent={
                  !contactLoading ? <Text style={styles.sheetEmptyText}>Belum ada kontak ditampilkan.</Text> : null
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  filterButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  clearFilterButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  sheetSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  sheetList: {
    marginTop: Spacing.sm,
    maxHeight: 320,
  },
  contactRow: {
    padding: Spacing.sm,
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 0,
    borderColor: "transparent",
    marginBottom: Spacing.sm,
  },
  contactRowSelected: {
    backgroundColor: Colors.primary + "20",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  contactName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  contactPhone: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  sheetEmptyText: {
    marginTop: Spacing.sm,
    fontSize: 12,
    color: Colors.border,
    textAlign: "center",
  },
  debtContainer: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  debtList: {
    marginBottom: Spacing.sm,
  },
  debtItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
  },
  debtLeftSection: {
    flexDirection: "column",
    flex: 1,
  },
  debtCode: {
    fontSize: 12,
    color: "#999",
    fontWeight: "400",
    marginBottom: Spacing.xs,
  },
  debtDate: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  debtAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.md,
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: "600",
  },
  debtAmountInvoice: {
    color: "#EF4444",
  },
  debtAmountPayment: {
    color: "#19a14b",
  },
  remainingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
  },
  remainingLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  remainingAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  remainingAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: Spacing.md,
    fontWeight: "500",
  },
  placeholderText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: Spacing.lg,
    fontWeight: "500",
  },
});
