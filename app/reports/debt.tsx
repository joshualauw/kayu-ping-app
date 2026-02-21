import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, payments } from "@/db/schema";
import { getContactCategoryLabel, getDebtTypeLabel } from "@/lib/label-helper";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router } from "expo-router";
import { shareAsync } from "expo-sharing";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ContactFilterItem {
  id: number;
  name: string;
  category: string;
}

interface DebtItem {
  id: number;
  type: "invoice" | "payment";
  date: string;
  amount: number;
  code?: string;
}

export default function DebtReportScreen() {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<"piutang" | "utang">("piutang");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactFilterItem[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [debtData, setDebtData] = useState<DebtItem[]>([]);
  const [debtLoading, setDebtLoading] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [dateAnchor, setDateAnchor] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("YYYY"));

  const getDateLabel = (anchor: dayjs.Dayjs) => {
    return anchor.format("YYYY");
  };

  const getDateRange = (anchor: dayjs.Dayjs) => {
    return {
      startDate: anchor.startOf("year").toISOString(),
      endDate: anchor.endOf("year").toISOString(),
    };
  };

  const fetchDebtData = async (
    contactId: number | null,
    type: "piutang" | "utang",
    startDate?: string,
    endDate?: string,
  ) => {
    if (contactId === null) {
      setDebtData([]);
      setRemainingAmount(0);
      return;
    }

    try {
      setDebtLoading(true);

      const invoiceType = type === "piutang" ? "sales" : "purchase";
      const paymentType = type === "piutang" ? "income" : "expense";

      const invoiceFilters = [eq(invoices.contactId, contactId), eq(invoices.type, invoiceType)];
      if (startDate && endDate) {
        invoiceFilters.push(gte(invoices.entryDate, startDate));
        invoiceFilters.push(lte(invoices.entryDate, endDate));
      }

      const paymentFilters = [eq(payments.contactId, contactId), eq(payments.type, paymentType)];
      if (startDate && endDate) {
        paymentFilters.push(gte(payments.paymentDate, startDate));
        paymentFilters.push(lte(payments.paymentDate, endDate));
      }

      const invoiceRes = await db
        .select({
          id: invoices.id,
          date: invoices.entryDate,
          amount: invoices.amount,
          code: invoices.code,
        })
        .from(invoices)
        .where(and(...invoiceFilters));

      const paymentRes = await db
        .select({
          id: payments.id,
          date: payments.paymentDate,
          amount: payments.amount,
        })
        .from(payments)
        .where(and(...paymentFilters));

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
          category: contacts.category,
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
    const { startDate, endDate } = getDateRange(dateAnchor);
    fetchDebtData(contact.id, selectedType, startDate, endDate);
  };

  const handleClearFilter = () => {
    setSelectedContactId(null);
    setSelectedContactName(null);
    fetchDebtData(null, selectedType);
  };

  const handleShiftDate = (direction: -1 | 1) => {
    const nextAnchor = dateAnchor.add(direction, "year");
    setDateAnchor(nextAnchor);
    setSelectedDate(getDateLabel(nextAnchor));
    if (selectedContactId !== null) {
      const { startDate, endDate } = getDateRange(nextAnchor);
      fetchDebtData(selectedContactId, selectedType, startDate, endDate);
    }
  };

  const handleExportToPDF = async () => {
    if (!selectedContactName || debtData.length === 0) return;

    const debtTypeLabel = selectedType === "piutang" ? "Piutang" : "Utang";

    const rows = debtData
      .map(
        (item) => `
        <div class="debt-row">
          <div>
            <div style="font-size: 14px; color: #666; font-weight: 500;">${dayjs(item.date).format("DD MMM YYYY")}</div>
          </div>
          <div style="display: flex; align-items: center;">
            <span style="font-size: 14px; font-weight: 600;">${item.type === "invoice" ? "+" : "-"} ${formatCurrency(item.amount)}</span>
          </div>
        </div>
      `,
      )
      .join("");

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body {
              font-family: 'Helvetica', 'Arial', sans-serif;
              padding: 20px;
              margin: 0;
            }
            @page {
              margin: 10mm;
              size: A4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
              page-break-inside: avoid;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .subtitle {
              font-size: 14px;
              color: #666;
            }
            .info-section {
              margin-bottom: 20px;
              page-break-inside: avoid;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .info-label {
              font-weight: 600;
            }
            .list-container {
              margin-top: 20px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #000;
              page-break-inside: avoid;
            }
            .debt-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
              page-break-inside: avoid;
            }
            .total-section {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 2px solid #000;
              display: flex;
              justify-content: space-between;
              font-size: 16px;
              font-weight: bold;
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Laporan ${debtTypeLabel}</div>
            <div class="subtitle">Dicetak pada ${dayjs().format("DD MMMM YYYY HH:mm")}</div>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Kontak:</span>
              <span>${selectedContactName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Periode:</span>
              <span>${selectedDate}</span>
            </div>
          </div>

          <div class="list-container">
            <div class="section-title">Riwayat ${debtTypeLabel}</div>
            ${rows}
          </div>

          <div class="total-section">
            <span>Total Sisa ${debtTypeLabel}:</span>
            <span>${formatCurrency(Math.abs(remainingAmount))}</span>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });

      const contactNameKebab = selectedContactName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const fileName = `Laporan-${debtTypeLabel}-${contactNameKebab}-${selectedDate}.pdf`;
      const newUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      await shareAsync(newUri, { UTI: ".pdf", mimeType: "application/pdf" });
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  useEffect(() => {
    if (selectedContactId !== null) {
      const { startDate, endDate } = getDateRange(dateAnchor);
      fetchDebtData(selectedContactId, selectedType, startDate, endDate);
    }
  }, [selectedType]);

  useEffect(() => {
    if (!filterVisible) return;

    const delayDebounceFn = setTimeout(() => {
      fetchContacts(filterQuery);
    }, 100);

    return () => clearTimeout(delayDebounceFn);
  }, [filterQuery, filterVisible]);

  return (
    <Container>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom }}>
        <View style={styles.typeTabs}>
          <Pressable
            style={[styles.typeTab, selectedType === "piutang" && styles.typeTabActive]}
            onPress={() => setSelectedType("piutang")}
          >
            <Text style={[styles.typeTabText, selectedType === "piutang" && styles.typeTabTextActive]}>Piutang</Text>
          </Pressable>
          <Pressable
            style={[styles.typeTab, selectedType === "utang" && styles.typeTabActive]}
            onPress={() => setSelectedType("utang")}
          >
            <Text style={[styles.typeTabText, selectedType === "utang" && styles.typeTabTextActive]}>Utang</Text>
          </Pressable>
        </View>

        <ContactFilter
          selectedContactName={selectedContactName}
          onOpenFilter={() => setFilterVisible(true)}
          onClearFilter={handleClearFilter}
        />

        <DateFilter
          selectedDate={selectedDate}
          onChevronLeftPress={() => handleShiftDate(-1)}
          onChevronRightPress={() => handleShiftDate(1)}
        />

        {selectedContactId !== null ? (
          <>
            {debtLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.debtContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Riwayat {getDebtTypeLabel(selectedType)}</Text>
                  {debtData.length > 0 && (
                    <Pressable style={styles.pdfButton} onPress={handleExportToPDF}>
                      <MaterialCommunityIcons name="printer" size={18} color={Colors.primary} />
                      <Text style={styles.pdfButtonText}>Cetak PDF</Text>
                    </Pressable>
                  )}
                </View>

                {debtData.length === 0 ? (
                  <Text style={styles.emptyText}>Belum ada {getDebtTypeLabel(selectedType)} untuk kontak ini.</Text>
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
                          <Text style={styles.debtDate}>{dayjs(item.date).format("DD MMM YYYY")}</Text>
                        </View>
                        <View style={styles.debtAmountContainer}>
                          <MaterialCommunityIcons
                            name={item.type === "invoice" ? "plus" : "minus"}
                            size={16}
                            color={item.type === "invoice" ? Colors.success : Colors.danger}
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
                  <Text style={styles.remainingLabel}>Total Sisa {getDebtTypeLabel(selectedType)}:</Text>
                  <View style={styles.remainingAmountContainer}>
                    <Text style={styles.remainingAmount}>{formatCurrency(Math.abs(remainingAmount))}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.placeholderText}>
            Pilih kontak untuk melihat riwayat {getDebtTypeLabel(selectedType)}.
          </Text>
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

export function DateFilter({ selectedDate, onChevronLeftPress, onChevronRightPress }: any) {
  return (
    <View style={styles.dateFilterRow}>
      <Pressable style={styles.dateNavButton} onPress={onChevronLeftPress}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.text} />
      </Pressable>
      <Text style={styles.dateFilterLabel}>{selectedDate}</Text>
      <Pressable style={styles.dateNavButton} onPress={onChevronRightPress}>
        <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.text} />
      </Pressable>
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
                    <Text style={styles.contactCategory}>{getContactCategoryLabel(item.category)}</Text>
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
  typeTabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: "center",
  },
  typeTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  typeTabTextActive: {
    color: "white",
  },
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
    paddingBottom: 32,
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
  contactCategory: {
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
  },
  pdfButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
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
    color: Colors.success,
  },
  debtAmountPayment: {
    color: Colors.danger,
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
  dateFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
  },
  dateFilterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  dateNavButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
});
