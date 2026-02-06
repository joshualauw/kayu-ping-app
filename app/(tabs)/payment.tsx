import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, paymentAllocations, payments } from "@/db/schema";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq, inArray } from "drizzle-orm";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface PaymentListItem {
  id: number;
  clientName: string;
  paymentDate: string;
  amount: number;
  type: "income" | "expense";
  allocations: {
    label: string;
    amount: number;
  }[];
}

export default function PaymentScreen() {
  const [selectedType, setSelectedType] = useState<"income" | "expense">("income");
  const [data, setData] = useState<PaymentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    fetchPayments(nextPage, true, selectedType);
  };

  const fetchPayments = async (pageNum: number = 1, append = false, type: "income" | "expense" = "income") => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      const filters = [eq(payments.type, type)];

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
        .orderBy(desc(payments.paymentDate))
        .limit(limit)
        .offset(offset);

      const paymentIds = res.map((row) => row.id);
      const allocationMap = new Map<number, { label: string; amount: number }[]>();

      if (paymentIds.length > 0) {
        const allocationRows = await db
          .select({
            paymentId: paymentAllocations.paymentId,
            invoiceCode: invoices.code,
            amount: paymentAllocations.amount,
          })
          .from(paymentAllocations)
          .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
          .where(inArray(paymentAllocations.paymentId, paymentIds));

        allocationRows.forEach((row) => {
          if (!row.paymentId) return;
          const label = row.invoiceCode ? row.invoiceCode : "Tanpa Nota";
          const existing = allocationMap.get(row.paymentId) || [];
          existing.push({ label, amount: row.amount });
          allocationMap.set(row.paymentId, existing);
        });
      }

      const dataWithAllocations: PaymentListItem[] = res.map((row) => {
        const allocations = allocationMap.get(row.id) || [];
        const allocatedSum = allocations.reduce((sum, item) => sum + item.amount, 0);
        const remaining = Math.max(0, row.amount - allocatedSum);
        const finalAllocations =
          remaining > 0 ? [...allocations, { label: "Belum teralokasi", amount: remaining }] : allocations;

        return {
          ...row,
          allocations: finalAllocations,
        } as PaymentListItem;
      });

      if (append) {
        setData((prev) => [...prev, ...dataWithAllocations]);
      } else {
        setData(dataWithAllocations);
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
      fetchPayments(1, false, selectedType);
    }, [selectedType]),
  );

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

      {item.allocations.length > 0 && (
        <View style={styles.paymentInfo}>
          {item.allocations.map((allocation, index) => (
            <View key={`${allocation.label}-${index}`} style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>{allocation.label}:</Text>
              <Text style={[styles.paymentValue, allocation.label === "Belum teralokasi" && styles.remainingText]}>
                {formatCurrency(allocation.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
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
            fetchPayments(1, false, selectedType);
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

      <Pressable style={styles.fab} onPress={() => router.push("/payment/add")}>
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </Pressable>
    </Container>
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
});
