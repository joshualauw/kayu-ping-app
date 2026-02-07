import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, paymentAllocations } from "@/db/schema";
import "@/lib/dayjs-config";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface InvoiceListItem {
  id: number;
  code: string;
  clientName: string;
  entryDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "pending" | "paid";
  type: "sales" | "purchase";
}

interface ContactFilterItem {
  id: number;
  name: string;
  phoneNumber: string;
}

export default function InvoiceScreen() {
  const [selectedType, setSelectedType] = useState<"sales" | "purchase">("sales");
  const [data, setData] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [contactResults, setContactResults] = useState<ContactFilterItem[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedContactName, setSelectedContactName] = useState<string | null>(null);
  const [dateFilterVisible, setDateFilterVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format("MMM YYYY"));
  const [dateFilterType, setDateFilterType] = useState<"day" | "week" | "month" | "year">("month");
  const [dateAnchor, setDateAnchor] = useState(dayjs());
  const [statusFilterVisible, setStatusFilterVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"all" | "paid" | "pending">("all");
  const [totalUnpaid, setTotalUnpaid] = useState<number>(0);

  const getDateLabel = (type: "day" | "week" | "month" | "year", anchor: dayjs.Dayjs) => {
    if (type === "day") return anchor.format("DD MMM YYYY");
    if (type === "week") {
      const start = anchor.startOf("week");
      const end = anchor.endOf("week");
      return `${start.format("DD MMM")} - ${end.format("DD MMM YYYY")}`;
    }
    if (type === "month") return anchor.format("MMM YYYY");
    return anchor.format("YYYY");
  };

  const getDateRange = (type: "day" | "week" | "month" | "year", anchor: dayjs.Dayjs) => {
    return {
      startDate: anchor.startOf(type).toISOString(),
      endDate: anchor.endOf(type).toISOString(),
    };
  };

  const loadMore = () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    const { startDate, endDate } = getDateRange(dateFilterType, dateAnchor);
    fetchInvoices(nextPage, true, selectedType, selectedContactId, selectedStatus, startDate, endDate);
  };

  const fetchTotalUnpaidAmount = async (
    type = "sales",
    contactId: number | null = null,
    startDate?: string,
    endDate?: string,
  ) => {
    try {
      const filters = [eq(invoices.type, type)];
      if (contactId) {
        filters.push(eq(invoices.contactId, contactId));
      }
      if (startDate && endDate) {
        filters.push(gte(invoices.entryDate, startDate));
        filters.push(lte(invoices.entryDate, endDate));
      }

      const allRes = await db
        .select({
          id: invoices.id,
          amount: invoices.amount,
          paidAmount: sql<number>`CAST(COALESCE(SUM(${paymentAllocations.amount}), 0) AS INTEGER)`,
        })
        .from(invoices)
        .leftJoin(paymentAllocations, eq(invoices.id, paymentAllocations.invoiceId))
        .where(and(...filters))
        .groupBy(invoices.id);

      const totalUnpaid = allRes.reduce((sum, item) => {
        const paidAmount = Number(item.paidAmount) || 0;
        const remainingAmount = item.amount - paidAmount;
        return paidAmount >= item.amount ? sum : sum + remainingAmount;
      }, 0);

      setTotalUnpaid(totalUnpaid);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoices = async (
    pageNum: number = 1,
    append = false,
    type = "sales",
    contactId: number | null = null,
    status: "all" | "paid" | "pending" = "all",
    startDate?: string,
    endDate?: string,
  ) => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      const filters = [eq(invoices.type, type)];
      if (contactId) {
        filters.push(eq(invoices.contactId, contactId));
      }
      if (startDate && endDate) {
        filters.push(gte(invoices.entryDate, startDate));
        filters.push(lte(invoices.entryDate, endDate));
      }

      const res = await db
        .select({
          id: invoices.id,
          code: invoices.code,
          clientName: contacts.name,
          entryDate: invoices.entryDate,
          amount: invoices.amount,
          paidAmount: sql<number>`CAST(COALESCE(SUM(${paymentAllocations.amount}), 0) AS INTEGER)`,
          type: invoices.type,
        })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .leftJoin(paymentAllocations, eq(invoices.id, paymentAllocations.invoiceId))
        .where(and(...filters))
        .groupBy(invoices.id, contacts.name)
        .orderBy(desc(invoices.entryDate))
        .limit(limit)
        .offset(offset);

      const dataWithRemaining = res.map((item) => {
        const paidAmount = Number(item.paidAmount) || 0;
        const remainingAmount = item.amount - paidAmount;
        const derivedStatus: "pending" | "paid" = paidAmount >= item.amount ? "paid" : "pending";

        return {
          ...item,
          paidAmount,
          remainingAmount,
          status: derivedStatus,
        };
      });

      const filteredData =
        status === "all" ? dataWithRemaining : dataWithRemaining.filter((item) => item.status === status);

      if (append) {
        setData((prev) => [...prev, ...(filteredData as InvoiceListItem[])]);
      } else {
        setData(filteredData as InvoiceListItem[]);
      }

      setHasMore(res.length === limit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      const { startDate, endDate } = getDateRange(dateFilterType, dateAnchor);
      fetchInvoices(1, false, selectedType, selectedContactId, selectedStatus, startDate, endDate);
      fetchTotalUnpaidAmount(selectedType, selectedContactId, startDate, endDate);
    }, [selectedType, selectedContactId, selectedStatus, dateFilterType, dateAnchor]),
  );

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
    setPage(1);
  };

  const handleClearFilter = () => {
    setSelectedContactId(null);
    setSelectedContactName(null);
    setPage(1);
  };

  const handleSelectStatus = (status: "all" | "paid" | "pending") => {
    setSelectedStatus(status);
    setStatusFilterVisible(false);
    setPage(1);
  };

  const handleSelectDateFilter = (type: "day" | "week" | "month" | "year") => {
    const anchor = dayjs();
    setDateFilterType(type);
    setDateAnchor(anchor);
    setSelectedDate(getDateLabel(type, anchor));
    setDateFilterVisible(false);
    setPage(1);
  };

  const handleShiftDate = (direction: -1 | 1) => {
    let nextAnchor = dateAnchor;
    if (dateFilterType === "day") nextAnchor = dateAnchor.add(direction, "day");
    if (dateFilterType === "week") nextAnchor = dateAnchor.add(direction, "week");
    if (dateFilterType === "month") nextAnchor = dateAnchor.add(direction, "month");
    if (dateFilterType === "year") nextAnchor = dateAnchor.add(direction, "year");

    setDateAnchor(nextAnchor);
    setSelectedDate(getDateLabel(dateFilterType, nextAnchor));
    setPage(1);
  };

  useEffect(() => {
    if (!filterVisible) return;

    const delayDebounceFn = setTimeout(() => {
      fetchContacts(filterQuery);
    }, 100);

    return () => clearTimeout(delayDebounceFn);
  }, [filterQuery, filterVisible]);

  const renderItem = ({ item }: { item: InvoiceListItem }) => (
    <Pressable style={styles.card} android_ripple={{ color: Colors.secondary }}>
      <View style={styles.cardRow}>
        <View style={styles.clientInfo}>
          {item.code && <Text style={styles.code}>#{item.code}</Text>}
          <Text style={styles.client}>{item.clientName}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: item.status === "paid" ? Colors.accent : Colors.secondary }]}>
          <Text style={[styles.statusText, { color: item.status === "paid" ? "white" : Colors.text }]}>
            {item.status === "paid" ? "Lunas" : "Belum Lunas"}
          </Text>
        </View>
      </View>

      <View style={styles.cardRowSmall}>
        <Text style={styles.meta}>{dayjs(item.entryDate).format("LL")}</Text>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
      </View>

      <View style={styles.paymentInfo}>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Terbayar:</Text>
          <Text style={styles.paymentValue}>{formatCurrency(item.paidAmount)}</Text>
        </View>
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Sisa:</Text>
          <Text style={[styles.paymentValue, styles.remainingText]}>{formatCurrency(item.remainingAmount)}</Text>
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="file-document-outline" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Belum Ada Nota</Text>
      <Text style={styles.emptySubtitle}>
        {selectedType === "sales" ? "Belum ada nota penjualan." : "Belum ada nota pembelian."}
      </Text>
    </View>
  );

  return (
    <Container>
      <View style={styles.typeTabs}>
        <Pressable
          onPress={() => setSelectedType("sales")}
          style={[styles.typeTab, selectedType === "sales" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "sales" && styles.typeTabTextActive]}>Penjualan</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedType("purchase")}
          style={[styles.typeTab, selectedType === "purchase" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "purchase" && styles.typeTabTextActive]}>Pembelian</Text>
        </Pressable>
      </View>

      <ContactFilter
        selectedContactName={selectedContactName}
        onOpenFilter={() => setFilterVisible(true)}
        onClearFilter={handleClearFilter}
      />

      <DateFilter
        selectedDate={selectedDate}
        dateFilterType={dateFilterType}
        onOpenDateFilter={() => setDateFilterVisible(true)}
        onStatusFilterPress={() => setStatusFilterVisible(true)}
        onChevronLeftPress={() => handleShiftDate(-1)}
        onChevronRightPress={() => handleShiftDate(1)}
      />

      <View style={styles.totalUnpaidContainer}>
        <Text style={styles.totalUnpaidLabel}>Total Belum Terbayar</Text>
        <Text style={styles.totalUnpaidAmount}>{formatCurrency(totalUnpaid)}</Text>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          refreshing={loading && page === 1}
          onRefresh={() => {
            setPage(1);
            setData([]);
            const { startDate, endDate } = getDateRange(dateFilterType, dateAnchor);
            fetchInvoices(1, false, selectedType, selectedContactId, selectedStatus, startDate, endDate);
            fetchTotalUnpaidAmount(selectedType, selectedContactId, startDate, endDate);
          }}
          contentContainerStyle={[
            { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
            data.length === 0 && {
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingBottom: 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push("/invoice/add")}>
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </Pressable>

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

      <DateFilterModal
        visible={dateFilterVisible}
        onClose={() => setDateFilterVisible(false)}
        onSelectDateFilter={handleSelectDateFilter}
        dateFilterType={dateFilterType}
      />

      <StatusFilterModal
        visible={statusFilterVisible}
        onClose={() => setStatusFilterVisible(false)}
        selectedStatus={selectedStatus}
        onSelectStatus={handleSelectStatus}
      />
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

export function DateFilter({
  selectedDate,
  dateFilterType,
  onOpenDateFilter,
  onStatusFilterPress,
  onChevronLeftPress,
  onChevronRightPress,
}: any) {
  return (
    <View style={styles.dateFilterRow}>
      <Pressable style={styles.dateFilterButton} onPress={onOpenDateFilter}>
        <MaterialCommunityIcons name="calendar" size={18} color={Colors.primary} />
        <Text style={styles.dateFilterLabel}>{selectedDate}</Text>
      </Pressable>
      <View style={styles.dateNavButtons}>
        <Pressable style={styles.statusFilterButton} onPress={onStatusFilterPress}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={Colors.text} />
        </Pressable>
        <Pressable style={styles.dateNavButton} onPress={onChevronLeftPress}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.text} />
        </Pressable>
        <Pressable style={styles.dateNavButton} onPress={onChevronRightPress}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.text} />
        </Pressable>
      </View>
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
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Filter Kontak</Text>
              <View style={styles.sheetSearchContainer}>
                <MaterialCommunityIcons name="magnify" size={18} color={Colors.border} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Cari nama kontak"
                  placeholderTextColor={Colors.border}
                  value={filterQuery}
                  onChangeText={onFilterQueryChange}
                />
              </View>
              {contactLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.sm }} />
              ) : contactResults.length === 0 ? (
                <Text style={styles.sheetEmptyText}>Tidak ditemukan kontak</Text>
              ) : (
                <FlatList
                  data={contactResults}
                  keyExtractor={(item) => item.id.toString()}
                  style={styles.sheetList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <Pressable
                      style={[styles.contactRow, selectedContactId === item.id && styles.contactRowSelected]}
                      onPress={() => onSelectContact(item)}
                    >
                      <Text style={styles.contactName}>{item.name}</Text>
                      <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export function DateFilterModal({ visible, onClose, onSelectDateFilter, dateFilterType }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.sheetOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Filter Tanggal</Text>
              <View style={styles.datePresetList}>
                <Pressable style={styles.datePresetItem} onPress={() => onSelectDateFilter("day")}>
                  <View>
                    <Text style={styles.datePresetTop}>Hari ini</Text>
                    <Text style={styles.datePresetBottom}>{dayjs().format("DD MMM YYYY")}</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.datePresetItem} onPress={() => onSelectDateFilter("week")}>
                  <View>
                    <Text style={styles.datePresetTop}>Minggu ini</Text>
                    <Text style={styles.datePresetBottom}>
                      {dayjs().startOf("week").format("DD MMM YYYY")} - {dayjs().endOf("week").format("DD MMM YYYY")}
                    </Text>
                  </View>
                </Pressable>
                <Pressable style={styles.datePresetItem} onPress={() => onSelectDateFilter("month")}>
                  <View>
                    <Text style={styles.datePresetTop}>Bulan ini</Text>
                    <Text style={styles.datePresetBottom}>{dayjs().format("MMM YYYY")}</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.datePresetItem} onPress={() => onSelectDateFilter("year")}>
                  <View>
                    <Text style={styles.datePresetTop}>Tahun ini</Text>
                    <Text style={styles.datePresetBottom}>{dayjs().format("YYYY")}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export function StatusFilterModal({ visible, onClose, selectedStatus, onSelectStatus }: any) {
  const statuses = [
    { label: "Semua", value: "all" },
    { label: "Lunas", value: "paid" },
    { label: "Belum Lunas", value: "pending" },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownTitle}>Filter Status</Text>
            {statuses.map((item) => {
              const isSelected = selectedStatus === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    pressed && { backgroundColor: "#F3F4F6" },
                    isSelected && { backgroundColor: Colors.primary + "10" },
                  ]}
                  onPress={() => onSelectStatus(item.value as "all" | "paid" | "pending")}
                >
                  <Text style={[styles.dropdownItemText, isSelected && { color: Colors.primary, fontWeight: "700" }]}>
                    {item.label}
                  </Text>
                  {isSelected && <MaterialCommunityIcons name="check" size={18} color={Colors.primary} />}
                </Pressable>
              );
            })}
          </View>
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
  dateFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateFilterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  dateFilterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  dateNavButtons: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  statusFilterButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  dateNavButton: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: Colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  card: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  clientInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  client: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  code: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
    fontWeight: "500",
  },
  cardRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meta: {
    color: Colors.text,
  },
  amount: {
    fontWeight: "700",
    color: Colors.text,
  },
  status: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 120,
    paddingRight: 20,
  },
  dropdownMenu: {
    backgroundColor: "white",
    borderRadius: 16,
    width: 180,
    padding: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    textTransform: "uppercase",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  dropdownItemText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
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
  datePresetList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  datePresetItem: {
    padding: Spacing.sm,
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 0,
    borderColor: "transparent",
    marginBottom: Spacing.sm,
  },
  datePresetTop: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  datePresetBottom: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  paymentInfo: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
  },
  paymentValue: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  remainingText: {
    color: Colors.primary,
  },
  totalUnpaidContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
  },
  totalUnpaidLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
    marginBottom: 4,
  },
  totalUnpaidAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  notesContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  notesLabel: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
});
