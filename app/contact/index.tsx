import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts } from "@/db/schema";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { and, desc, eq, like, or } from "drizzle-orm";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
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
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [data, setData] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadMore = () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    setPage(nextPage);
    fetchContacts(nextPage, true);
  };

  const fetchContacts = async (pageNum: number = 1, append = false, query = "", category = "all") => {
    if (loading) return;

    try {
      setLoading(true);

      const limit = 20;
      const offset = (pageNum - 1) * limit;
      const filters = [];

      if (query) {
        filters.push(or(like(contacts.name, `%${query}%`), like(contacts.phoneNumber, `%${query}%`)));
      }
      if (category !== "all") {
        filters.push(eq(contacts.category, category));
      }

      const res = await db
        .select()
        .from(contacts)
        .where(and(...filters))
        .orderBy(desc(contacts.id))
        .limit(limit)
        .offset(offset);

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

  const isFirstRender = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstRender.current) {
        fetchContacts(1, false, searchQuery, selectedCategory);
        setPage(1);
        isFirstRender.current = false;
        return;
      }

      const delayDebounceFn = setTimeout(() => {
        setPage(1);
        fetchContacts(1, false, searchQuery, selectedCategory);
      }, 200);

      return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, selectedCategory]),
  );

  const renderItem = ({ item }: { item: ContactListItem }) => (
    <Pressable
      onPress={() => router.push(`/contact/${item.id}`)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
      android_ripple={{
        color: "rgba(0, 0, 0, 0.1)",
        borderless: false,
        foreground: true,
      }}
    >
      <Avatar name={item.name} />
      <View style={styles.infoColumn}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.phoneText}>{item.phoneNumber}</Text>
        <Badge label={item.category} />
      </View>
    </Pressable>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="account-search-outline" size={80} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Belum Ada Kontak</Text>
      <Text style={styles.emptySubtitle}>Mulai catat supplier atau supir Anda untuk mempermudah transaksi kayu.</Text>
    </View>
  );

  return (
    <Container>
      <Stack.Screen options={{ title: "Kontak" }} />
      <SearchBar
        searchQuery={searchQuery}
        onChangeText={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
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

      <Pressable style={[styles.fab, { bottom: insets.bottom + 16 }]} onPress={() => router.push("/contact/add")}>
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </Pressable>
    </Container>
  );
}

export function SearchBar({ searchQuery, onChangeText, selectedCategory, onSelectCategory }: any) {
  const [visible, setVisible] = useState(false);

  const categories = [
    { label: "Semua", value: "all" },
    { label: "Supplier", value: "supplier" },
    { label: "Langganan", value: "client" },
    { label: "Supir", value: "driver" },
    { label: "Lainnya", value: "others" },
  ];

  const handleSelect = (category: string) => {
    onSelectCategory(category);
    setVisible(false);
  };

  return (
    <View style={styles.searchContainer}>
      <MaterialCommunityIcons name="magnify" size={20} color={Colors.border} style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Cari nama atau nomor"
        placeholderTextColor={Colors.border}
        value={searchQuery}
        onChangeText={onChangeText}
      />

      <Pressable style={styles.searchFilterButton} onPress={() => setVisible(true)}>
        <MaterialCommunityIcons
          name="filter-variant"
          size={18}
          color={selectedCategory !== "all" ? Colors.primary : Colors.text}
        />
      </Pressable>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.dropdownMenu}>
              <Text style={styles.dropdownTitle}>Filter Kategori</Text>
              {categories.map((item) => {
                const isSelected = selectedCategory === item.value;

                return (
                  <Pressable
                    key={item.value}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      pressed && { backgroundColor: "#F3F4F6" },
                      isSelected && { backgroundColor: Colors.primary + "10" },
                    ]}
                    onPress={() => handleSelect(item.value)}
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
    </View>
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
    padding: Spacing.sm,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    alignItems: "center",
    justifyContent: "space-between",
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.secondary,
    marginTop: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 0,
  },
  searchFilterButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
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
