import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, payments } from "@/db/schema";
import "@/lib/dayjs-config";
import { getContactCategoryLabel } from "@/lib/label-helper";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

interface PaymentListItem {
  id: number;
  clientName: string;
  paymentDate: string;
  amount: number;
  type: "income" | "expense";
}

interface ContactFilterItem {
  id: number;
  name: string;
  category: string;
}

export default function PaymentScreen() {
  const [selectedType, setSelectedType] = useState<"income" | "expense">("income");
  const [data, setData] = useState<PaymentListItem[]>([]);
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
  const [selectedDate, setSelectedDate] = useState<string>("Semua");
  const [dateFilterType, setDateFilterType] = useState<"all" | "day" | "week" | "month" | "year">("all");
  const [dateAnchor, setDateAnchor] = useState(dayjs());
  const [totalAmount, setTotalAmount] = useState<number>(0);

  const isManualSelection = useRef(false);

  const getDateLabel = (type: "all" | "day" | "week" | "month" | "year", anchor: dayjs.Dayjs) => {
    if (type === "all") return "Semua";
    if (type === "day") return anchor.format("DD MMM YYYY");
    if (type === "week") {
      const start = anchor.startOf("week");
      const end = anchor.endOf("week");
      return `${start.format("DD MMM")} - ${end.format("DD MMM YYYY")}`;
    }
    if (type === "month") return anchor.format("MMM YYYY");
    return anchor.format("YYYY");
  };

  const getDateRange = (type: "all" | "day" | "week" | "month" | "year", anchor: dayjs.Dayjs) => {
    if (type === "all") {
      return {
        startDate: undefined,
        endDate: undefined,
      };
    }
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
    fetchPayments(nextPage, true, selectedType, selectedContactId, startDate, endDate);
  };

  const fetchTotalPaymentAmount = async (
    type: "income" | "expense" = "income",
    contactId: number | null = null,
    startDate?: string,
    endDate?: string,
  ) => {
    try {
      const filters = [eq(payments.type, type)];
      if (contactId) {
        filters.push(eq(payments.contactId, contactId));
      }
      if (startDate && endDate) {
        filters.push(gte(payments.paymentDate, startDate));
        filters.push(lte(payments.paymentDate, endDate));
      }

      const allRes = await db
        .select({
          amount: payments.amount,
        })
        .from(payments)
        .where(and(...filters));

      const totalPaymentAmount = allRes.reduce((sum, item) => sum + item.amount, 0);
      setTotalAmount(totalPaymentAmount);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayments = async (
    pageNum: number = 1,
    append = false,
    type: "income" | "expense" = "income",
    contactId: number | null = null,
    startDate?: string,
    endDate?: string,
  ) => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      const filters = [eq(payments.type, type)];
      if (contactId) {
        filters.push(eq(payments.contactId, contactId));
      }
      if (startDate && endDate) {
        filters.push(gte(payments.paymentDate, startDate));
        filters.push(lte(payments.paymentDate, endDate));
      }

      const res = await db
        .select({
          id: payments.id,
          clientName: contacts.name,
          paymentDate: payments.paymentDate,
          amount: payments.amount,
          type: payments.type,
        })
        .from(payments)
        .leftJoin(contacts, eq(payments.contactId, contacts.id))
        .where(and(...filters))
        .orderBy(desc(payments.paymentDate), desc(payments.id))
        .limit(limit)
        .offset(offset);

      if (append) {
        setData((prev) => [...prev, ...(res as PaymentListItem[])]);
      } else {
        setData(res as PaymentListItem[]);
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
      fetchPayments(1, false, selectedType, selectedContactId, startDate, endDate);
      fetchTotalPaymentAmount(selectedType, selectedContactId, startDate, endDate);
    }, [selectedType, selectedContactId, dateFilterType, dateAnchor]),
  );

  const fetchContacts = async (query: string = "") => {
    if (contactLoading) return;

    try {
      setContactLoading(true);

      let filters = [];

      if (query.trim()) {
        filters.push(like(contacts.name, `%${query.trim()}%`));
      }

      const res = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          category: contacts.category,
        })
        .from(contacts)
        .where(and(...filters))
        .orderBy(desc(contacts.id))
        .limit(40);

      setContactResults(res as ContactFilterItem[]);
    } catch (err) {
      console.error(err);
    } finally {
      setContactLoading(false);
    }
  };

  const handleSelectContact = (contact: ContactFilterItem) => {
    isManualSelection.current = true;
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

  const handleSelectDateFilter = (type: "all" | "day" | "week" | "month" | "year") => {
    const anchor = dayjs();
    setDateFilterType(type);
    setDateAnchor(anchor);
    setSelectedDate(getDateLabel(type, anchor));
    setDateFilterVisible(false);
    setPage(1);
  };

  const handleShiftDate = (direction: -1 | 1) => {
    if (dateFilterType === "all") return;

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

  const renderItem = ({ item }: { item: PaymentListItem }) => (
    <Pressable
      onPress={() => router.push(`/payment/${item.id}`)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
      android_ripple={{
        color: "rgba(0, 0, 0, 0.1)",
        borderless: false,
        foreground: true,
      }}
    >
      <View style={styles.cardRow}>
        <View style={styles.clientInfo}>
          <Text style={styles.client}>{item.clientName || "Unnamed"}</Text>
        </View>
      </View>

      <View style={styles.cardRowSmall}>
        <Text style={styles.meta}>{dayjs(item.paymentDate).format("DD MMM YYYY")}</Text>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="cash" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Belum Ada Pembayaran</Text>
      <Text style={styles.emptySubtitle}>
        {selectedType === "income"
          ? "Tambahkan pembayaran masuk untuk memulai"
          : "Tambahkan pembayaran keluar untuk memulai"}
      </Text>
    </View>
  );

  return (
    <Container>
      <View style={styles.typeTabs}>
        <Pressable
          onPress={() => setSelectedType("income")}
          style={[styles.typeTab, selectedType === "income" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "income" && styles.typeTabTextActive]}>Pemasukan</Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectedType("expense")}
          style={[styles.typeTab, selectedType === "expense" && styles.typeTabActive]}
        >
          <Text style={[styles.typeTabText, selectedType === "expense" && styles.typeTabTextActive]}>Pengeluaran</Text>
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
        onChevronLeftPress={() => handleShiftDate(-1)}
        onChevronRightPress={() => handleShiftDate(1)}
      />

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>Total {selectedType === "income" ? "Pemasukan" : "Pengeluaran"}</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
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
            fetchPayments(1, false, selectedType, selectedContactId, startDate, endDate);
            fetchTotalPaymentAmount(selectedType, selectedContactId, startDate, endDate);
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

      <Pressable
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: "/payment/add",
            params: { type: selectedType },
          })
        }
      >
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
                      <Text style={styles.contactCategory}>{getContactCategoryLabel(item.category)}</Text>
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

export function DateFilter({
  selectedDate,
  dateFilterType,
  onOpenDateFilter,
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
        {dateFilterType !== "all" && (
          <>
            <Pressable style={styles.dateNavButton} onPress={onChevronLeftPress}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.text} />
            </Pressable>
            <Pressable style={styles.dateNavButton} onPress={onChevronRightPress}>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.text} />
            </Pressable>
          </>
        )}
      </View>
    </View>
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
                <Pressable style={styles.datePresetItem} onPress={() => onSelectDateFilter("all")}>
                  <View>
                    <Text style={styles.datePresetTop}>Semua</Text>
                    <Text style={styles.datePresetBottom}>Tanpa filter tanggal</Text>
                  </View>
                </Pressable>
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
  totalContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.secondary,
  },
  totalLabel: {
    fontSize: 13,
    color: "#888",
    fontWeight: "500",
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
});
