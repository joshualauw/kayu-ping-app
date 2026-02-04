import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices } from "@/db/schema";
import "@/lib/dayjs-config";
import { formatCurrency } from "@/lib/utils";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { and, desc, eq } from "drizzle-orm";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

interface InvoiceListItem {
  id: number;
  clientName: string;
  entryDate: string;
  amount: number;
  status: "pending" | "paid";
  type: "sales" | "purchase";
}

export default function InvoiceScreen() {
  const [selectedType, setSelectedType] = useState<"sales" | "purchase">("sales");
  const [data, setData] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    fetchInvoices(nextPage, true);
  };

  const fetchInvoices = async (pageNum: number = 1, append = false, type = "sales") => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;
      const filters = [eq(invoices.type, type)];

      const res = await db
        .select({
          id: invoices.id,
          clientName: contacts.name,
          entryDate: invoices.entryDate,
          amount: invoices.amount,
          status: invoices.status,
          type: invoices.type,
        })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(and(...filters))
        .orderBy(desc(invoices.entryDate))
        .limit(limit)
        .offset(offset);

      if (append) {
        setData((prev) => [...prev, ...(res as InvoiceListItem[])]);
      } else {
        setData(res as InvoiceListItem[]);
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
      fetchInvoices(1, false, selectedType);
    }, [selectedType]),
  );

  const renderItem = ({ item }: { item: InvoiceListItem }) => (
    <Pressable style={styles.card} android_ripple={{ color: Colors.secondary }}>
      <View style={styles.cardRow}>
        <Text style={styles.client}>{item.clientName}</Text>
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
            fetchInvoices(1, false, selectedType);
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
  cardRowSmall: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  client: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
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
});
