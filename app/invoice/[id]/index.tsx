import { Container } from "@/components/Container";
import DeleteModal from "@/components/DeleteModal";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, invoices, paymentAllocations, payments } from "@/db/schema";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { deleteFileFromDisk } from "@/lib/image-helper";
import { formatCurrency } from "@/lib/utils";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";

interface InvoiceDetail {
  id: number;
  code: string;
  contactName: string;
  amount: number;
  entryDate: string;
  type: "sales" | "purchase";
  notes: string | null;
  mediaUrl: string | null;
  remainingAmount: number;
  status: "pending" | "paid";
  allocations: {
    id: number;
    paymentDate: string;
    amount: number;
    originalAmount: number;
  }[];
}

export default function InvoiceDetailPage() {
  const { id } = useLocalSearchParams();
  const { isVisible, show, hide, item } = useDeleteConfirm();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);

  const handleDelete = async (invoiceId: number) => {
    try {
      if (invoice?.mediaUrl) {
        await deleteFileFromDisk(invoice.mediaUrl);
      }

      await db.delete(invoices).where(eq(invoices.id, invoiceId));

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Nota dihapus",
      });
      router.replace("/invoice");
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Gagal!",
        text2: "Gagal menghapus nota",
      });
    }
  };

  const confirmDelete = () => {
    if (item) {
      handleDelete(item.id);
    }
    hide();
  };

  useFocusEffect(
    useCallback(() => {
      const fetchDetail = async () => {
        if (loading) return;

        try {
          setLoading(true);

          const res = await db
            .select({
              id: invoices.id,
              code: invoices.code,
              contactName: contacts.name,
              amount: invoices.amount,
              entryDate: invoices.entryDate,
              type: invoices.type,
              notes: invoices.notes,
              mediaUrl: invoices.mediaUri,
            })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.contactId, contacts.id))
            .where(eq(invoices.id, Number(id)))
            .get();

          if (!res) {
            setInvoice(null);
            return;
          }

          const allocationRows = await db
            .select({
              id: payments.id,
              paymentDate: payments.paymentDate,
              amount: paymentAllocations.amount,
              originalAmount: payments.amount,
            })
            .from(paymentAllocations)
            .leftJoin(payments, eq(paymentAllocations.paymentId, payments.id))
            .where(eq(paymentAllocations.invoiceId, Number(id)));

          const allocations = allocationRows
            .filter((row) => row.id !== null)
            .map((row) => ({
              id: row.id!,
              paymentDate: row.paymentDate || "",
              amount: row.amount,
              originalAmount: row.originalAmount,
            }));

          const paidAmount = allocations.reduce((sum, row) => sum + row.amount, 0);
          const remainingAmount = Math.max(0, res.amount - paidAmount);
          const status = remainingAmount === 0 ? "paid" : "pending";

          setInvoice({
            ...res,
            contactName: res.contactName || "",
            type: res.type as "sales" | "purchase",
            remainingAmount,
            status,
            allocations,
          } as InvoiceDetail);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      };

      fetchDetail();
    }, [id]),
  );

  if (!invoice) return <Text>Loading...</Text>;

  return (
    <Container>
      <ScrollView>
        <Stack.Screen options={{ title: "Detail Nota" }} />

        <View style={styles.header}>
          <Text style={styles.code}>{invoice.code}</Text>
          <Text style={styles.amount}>{formatCurrency(invoice.amount)}</Text>
          <Text style={styles.name}>{invoice.contactName}</Text>
          <Text style={styles.typeTag}>{(invoice.type === "sales" ? "penjualan" : "pembelian").toUpperCase()}</Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.actionButton, styles.editButton]}
              onPress={() => router.push(`/invoice/${invoice.id}/edit`)}
            >
              <Text style={styles.editButtonText}>Ubah</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => show(invoice)}>
              <Text style={styles.deleteButtonText}>Hapus</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.infoBox}>
          <InfoItem
            label="Tanggal Nota"
            value={invoice.entryDate ? dayjs(invoice.entryDate).format("DD MMM YYYY") : "-"}
            icon="calendar-outline"
          />
          {invoice.notes && <InfoItem label="Catatan" value={invoice.notes} icon="document-text-outline" />}
          {invoice.mediaUrl && (
            <Pressable style={styles.photoItem} onPress={() => setPhotoVisible(true)}>
              <View style={styles.photoItemLeft}>
                <Ionicons name="image-outline" size={20} color={Colors.text} style={{ marginRight: 12 }} />
                <Text style={styles.photoItemText}>Lihat Foto</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={Colors.text} />
            </Pressable>
          )}
        </View>

        <View style={styles.paymentBox}>
          <View style={styles.paymentHeader}>
            <Text style={styles.sectionTitle}>History Pembayaran</Text>
            <View
              style={[styles.status, { backgroundColor: invoice.status === "paid" ? Colors.accent : Colors.secondary }]}
            >
              <Text style={[styles.statusText, { color: invoice.status === "paid" ? "white" : Colors.text }]}>
                {invoice.status === "paid" ? "Lunas" : "Belum Lunas"}
              </Text>
            </View>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Harga Awal:</Text>
            <Text style={styles.paymentValue}>{formatCurrency(invoice.amount)}</Text>
          </View>

          {invoice.allocations.length > 0 && (
            <View style={styles.allocationsSection}>
              {invoice.allocations.map((allocation, index) => (
                <Pressable
                  key={`${allocation.id}-${index}`}
                  style={({ pressed }) => [
                    styles.allocationItem,
                    { backgroundColor: pressed ? Colors.secondary : "transparent" },
                  ]}
                  onPress={() => router.push(`/payment/${allocation.id}`)}
                >
                  <View style={styles.allocationLeft}>
                    <Text style={styles.allocationDate}>{dayjs(allocation.paymentDate).format("DD MMM YYYY")}</Text>
                    <Text>Dari {formatCurrency(allocation.originalAmount)}</Text>
                  </View>
                  <View style={styles.allocationRight}>
                    <Text style={styles.allocationAmount}>{formatCurrency(allocation.amount)}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.paymentRow, styles.paymentRowLast]}>
            <Text style={styles.paymentLabelTotal}>Sisa:</Text>
            <Text style={[styles.paymentValueTotal, styles.remainingText]}>
              {formatCurrency(invoice.remainingAmount)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <DeleteModal
        visible={isVisible}
        title="Hapus Nota?"
        message="Nota akan dihapus permanen dan tidak bisa dikembalikan."
        onConfirm={confirmDelete}
        onCancel={hide}
      />

      <Modal visible={photoVisible} transparent animationType="fade">
        <Pressable style={styles.photoOverlay} onPress={() => setPhotoVisible(false)}>
          <Pressable style={styles.photoContainer} onPress={() => null}>
            {invoice.mediaUrl && (
              <Image source={{ uri: invoice.mediaUrl }} style={styles.photoImage} resizeMode="contain" />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

const InfoItem = ({ label, value, icon }: any) => (
  <View style={styles.infoItem}>
    <Ionicons name={icon} size={20} color="#666" style={{ marginRight: 12 }} />
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.lg, backgroundColor: Colors.background },
  code: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginBottom: Spacing.xs,
  },
  amount: { fontSize: 28, fontWeight: "700", color: Colors.text },
  name: { fontSize: 18, fontWeight: "600", color: Colors.text, marginTop: Spacing.sm },
  typeTag: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
    overflow: "hidden",
  },
  infoBox: { marginTop: Spacing.md, backgroundColor: Colors.background, paddingHorizontal: Spacing.md },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  photoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  photoItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: "400",
  },
  infoLabel: { fontSize: 12, color: "#666", marginBottom: Spacing.xs },
  infoValue: { fontSize: 16, color: Colors.text },
  paymentBox: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: Colors.text },
  status: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  paymentRowLast: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
  },
  paymentLabel: { fontSize: 14, color: "#888", fontWeight: "500" },
  paymentValue: { fontSize: 14, fontWeight: "600", color: Colors.text },
  paymentLabelTotal: { fontSize: 15, color: "#888", fontWeight: "600" },
  paymentValueTotal: { fontSize: 15, fontWeight: "700", color: Colors.text },
  remainingText: { color: Colors.primary, fontSize: 16 },
  allocationsSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  allocationsSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888",
    marginBottom: Spacing.xs,
  },
  allocationItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
  },
  allocationLeft: {
    flexDirection: "column",
    flex: 1,
  },
  allocationDate: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.text,
  },
  allocationRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  allocationAmount: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    width: "100%",
    paddingHorizontal: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: Colors.secondary,
  },
  editButtonText: {
    color: Colors.text,
    fontWeight: "600",
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: Colors.danger,
  },
  deleteButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  photoContainer: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
});
