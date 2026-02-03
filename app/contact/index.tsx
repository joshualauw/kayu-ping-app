import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { desc } from "drizzle-orm";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ContactListItem {
  id: number;
  name: string;
  phoneNumber: string;
  category: string;
  notes: string | null;
  createdAt: string | null;
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    fetchContacts(nextPage, true);
  };

  const fetchContacts = async (pageNum: number = 1, append = false) => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      const res = await db.select().from(contacts).orderBy(desc(contacts.id)).limit(limit).offset(offset);

      if (append) {
        setData((prev) => [...prev, ...res]);
      } else {
        setData(res);
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
      fetchContacts(1, false);
      setPage(1);
    }, []),
  );

  const renderItem = ({ item }: { item: any }) => (
    <Pressable onPress={() => router.push(`/contact/${item.id}`)}>
      <View style={styles.card}>
        <Avatar name={item.name} />
        <View style={styles.infoColumn}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.phoneText}>{item.phoneNumber}</Text>
          <Badge label={item.category} />
        </View>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-search-outline" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Belum Ada Kontak</Text>
      <Text style={styles.emptySubtitle}>Mulai catat supplier atau supir Anda untuk mempermudah transaksi kayu.</Text>
      <Pressable style={styles.emptyButton} onPress={() => router.push("/contact/add")}>
        <MaterialCommunityIcons name="plus" size={20} color="white" />
        <Text style={styles.emptyButtonText}>Tambah Kontak</Text>
      </Pressable>
    </View>
  );

  return (
    <Container>
      <Stack.Screen options={{ title: "Kontak" }} />

      {loading ? (
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
            fetchContacts(1, false);
          }}
          contentContainerStyle={[
            { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs },
            data.length === 0 && {
              flex: 1,
              justifyContent: "center",
              paddingBottom: 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {data.length > 0 && (
        <Pressable style={[styles.fab, { bottom: insets.bottom + 16 }]} onPress={() => router.push("/contact/add")}>
          <MaterialCommunityIcons name="plus" size={30} color="white" />
        </Pressable>
      )}
    </Container>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label.toLowerCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.background,
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  infoColumn: { flex: 1, justifyContent: "center" },
  nameText: { fontSize: 16, fontWeight: "700", color: Colors.text },
  phoneText: { fontSize: 13, color: "#888", marginTop: Spacing.xs },
  emptyText: { textAlign: "center", marginTop: Spacing.lg, color: Colors.border },
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  avatarText: { color: Colors.primary, fontWeight: "700", fontSize: 18 },
  badge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  badgeText: { fontSize: 11, color: Colors.text, fontWeight: "600" },
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
  emptyButton: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    marginTop: Spacing.lg,
    alignItems: "center",
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});
