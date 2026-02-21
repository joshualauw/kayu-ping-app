import { Container } from "@/components/Container";
import PaymentAllocationModal, { AllocationItem } from "@/components/PaymentAllocation";
import { image_compression_quality } from "@/constants/common";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, paymentAllocations, payments } from "@/db/schema";
import { saveFileToDisk } from "@/lib/image-helper";
import { getContactCategoryLabel } from "@/lib/label-helper";
import { formatDate, formatNumber, unformatNumber } from "@/lib/utils";
import { yupResolver } from "@hookform/resolvers/yup";
import dayjs from "dayjs";
import { desc, like } from "drizzle-orm";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import * as yup from "yup";

interface ContactDropdownItem {
  id: number;
  name: string;
  category: string;
}

const schema = yup.object({
  paymentDate: yup.date().required("Tanggal wajib diisi"),
  contactId: yup.number().required("Kontak wajib dipilih"),
  amount: yup.number().required("Jumlah wajib diisi").min(1, "Jumlah harus lebih dari 0"),
  type: yup.string().oneOf(["income", "expense"], "Tipe tidak valid").required("Tipe wajib dipilih"),
  method: yup
    .string()
    .oneOf(["cash", "credit_card", "bank_transfer"], "Metode tidak valid")
    .required("Metode wajib dipilih"),
  notes: yup.string().optional(),
  mediaUri: yup.string().optional(),
});

type FormValues = yup.InferType<typeof schema>;

export default function AddPaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: "income" | "expense" }>();

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { paymentDate: new Date(), contactId: 0, amount: 0, type, method: "cash" },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [contactList, setContactList] = useState<ContactDropdownItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [allocationDraft, setAllocationDraft] = useState<AllocationItem[]>([]);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const watchedContactId = watch("contactId");
  const watchedAmount = watch("amount");
  const watchedType = watch("type");
  const amountValue = Number(watchedAmount) || 0;
  const canOpenAllocation = !!watchedContactId && amountValue > 0;

  const isManualSelection = useRef(false);

  useEffect(() => {
    if (isManualSelection.current) {
      isManualSelection.current = false;
      return;
    }

    const loadContacts = async (searchTerm: string) => {
      if (searchTerm.length < 2) {
        setContactList([]);
        setShowSuggestions(false);
        return;
      }

      const res = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          category: contacts.category,
        })
        .from(contacts)
        .where(like(contacts.name, `%${searchTerm}%`))
        .limit(5);

      setContactList(res);
      setShowSuggestions(true);
    };

    const delayDebounceFn = setTimeout(() => {
      loadContacts(searchTerm);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    setAllocationDraft([]);
  }, [watchedContactId, watchedType, watchedAmount]);

  const selectContact = (contact: ContactDropdownItem) => {
    isManualSelection.current = true;
    setValue("contactId", contact.id);
    setSearchTerm(contact.name);
    setShowSuggestions(false);
    setContactList([]);
  };

  const onSubmit = async (data: FormValues) => {
    try {
      if (data.contactId === 0) {
        setError("contactId", { type: "required", message: "Kontak wajib dipilih" });
        return;
      }

      if (data.mediaUri) {
        const savedUri = await saveFileToDisk(data.mediaUri);
        data.mediaUri = savedUri;
      }

      await db.transaction(async (tx) => {
        await tx.insert(payments).values({
          paymentDate: dayjs(data.paymentDate).format("YYYY-MM-DD"),
          contactId: data.contactId,
          amount: Number(data.amount) || 0,
          type: data.type,
          method: data.method,
          notes: data.notes,
          mediaUri: data.mediaUri,
        });

        if (allocationDraft.length > 0) {
          const insertedPayment = await tx
            .select({ id: payments.id })
            .from(payments)
            .orderBy(desc(payments.id))
            .limit(1);

          const paymentId = insertedPayment[0]?.id;

          if (paymentId) {
            await tx.insert(paymentAllocations).values(
              allocationDraft.map((allocation) => ({
                paymentId,
                invoiceId: allocation.invoiceId!,
                amount: allocation.amount,
              })),
            );
          }
        }
      });

      Toast.show({
        type: "success",
        text1: "Berhasil!",
        text2: "Pembayaran berhasil disimpan",
      });

      router.back();
    } catch (error) {
      console.error(error);
      Toast.show({
        type: "error",
        text1: "Gagal!",
        text2: "Terjadi kesalahan saat menyimpan",
      });
    }
  };

  return (
    <Container>
      <Stack.Screen options={{ title: "Tambah Pembayaran" }} />
      <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: Spacing.lg + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Nama Kontak</Text>
          <Controller
            control={control}
            name="contactId"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <TextInput
                  style={[styles.input, errors.contactId && styles.inputError]}
                  placeholder="Nama Kontak"
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    setSearchTerm(text);
                  }}
                  value={searchTerm}
                  returnKeyType="next"
                />
                {showSuggestions && (
                  <View style={styles.dropdown}>
                    {contactList.length === 0 && (
                      <View style={styles.option}>
                        <Text style={{ color: "gray" }}>-Tidak ada kontak ditemukan-</Text>
                      </View>
                    )}
                    {contactList.map((contact, i) => (
                      <Pressable key={i} style={styles.option} onPress={() => selectContact(contact)}>
                        <Text style={{ fontWeight: "bold" }}>{contact.name}</Text>
                        <Text style={{ fontSize: 12, color: "gray" }}>{getContactCategoryLabel(contact.category)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
          {errors.contactId && <Text style={styles.error}>{errors.contactId.message}</Text>}

          <Text style={styles.label}>Tanggal Pembayaran</Text>
          <Controller
            control={control}
            name="paymentDate"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <Pressable onPress={() => setDatePickerVisibility(true)}>
                  <View pointerEvents="none">
                    <TextInput
                      style={[styles.input, errors.paymentDate && styles.inputError]}
                      placeholder="Pilih Tanggal"
                      value={formatDate(value)}
                      editable={false}
                    />
                  </View>
                </Pressable>
                <DateTimePickerModal
                  isVisible={isDatePickerVisible}
                  mode="date"
                  date={value || new Date()}
                  onConfirm={(date) => {
                    onChange(date);
                    setDatePickerVisibility(false);
                  }}
                  onCancel={() => setDatePickerVisibility(false)}
                />
              </View>
            )}
          />
          {errors.paymentDate && <Text style={styles.error}>{errors.paymentDate.message}</Text>}

          <Text style={styles.label}>Tipe</Text>
          <Controller
            control={control}
            name="type"
            render={({ field: { onChange, value } }) => {
              const options = [
                { label: "Pemasukan", value: "income" },
                { label: "Pengeluaran", value: "expense" },
              ];

              return (
                <>
                  <Pressable
                    style={[styles.input, errors.type && styles.inputError]}
                    onPress={() => setTypeOpen((s) => !s)}
                  >
                    <Text style={{ color: value ? Colors.text : Colors.border }}>
                      {value ? options.find((o) => o.value === value)?.label : "Pilih Tipe"}
                    </Text>
                  </Pressable>

                  {typeOpen && (
                    <View style={styles.dropdown}>
                      {options.map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={styles.option}
                          onPress={() => {
                            onChange(opt.value);
                            setTypeOpen(false);
                          }}
                        >
                          <Text>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              );
            }}
          />
          {errors.type && <Text style={styles.error}>{errors.type.message}</Text>}

          <Text style={styles.label}>Metode Pembayaran</Text>
          <Controller
            control={control}
            name="method"
            render={({ field: { onChange, value } }) => {
              const options = [
                { label: "Tunai", value: "cash" },
                { label: "Transfer Bank", value: "bank_transfer" },
                { label: "Lainnya", value: "others" },
              ];

              return (
                <>
                  <Pressable
                    style={[styles.input, errors.method && styles.inputError]}
                    onPress={() => setMethodOpen((s) => !s)}
                  >
                    <Text style={{ color: value ? Colors.text : Colors.border }}>
                      {value ? options.find((o) => o.value === value)?.label : "Pilih Metode"}
                    </Text>
                  </Pressable>

                  {methodOpen && (
                    <View style={styles.dropdown}>
                      {options.map((opt) => (
                        <Pressable
                          key={opt.value}
                          style={styles.option}
                          onPress={() => {
                            onChange(opt.value);
                            setMethodOpen(false);
                          }}
                        >
                          <Text>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              );
            }}
          />
          {errors.method && <Text style={styles.error}>{errors.method.message}</Text>}

          <Text style={styles.label}>Jumlah (Rp.)</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.amount && styles.inputError]}
                placeholder="Masukkan Jumlah"
                onChangeText={(text) => {
                  const cleanNumber = unformatNumber(text);
                  onChange(cleanNumber);
                }}
                value={formatNumber(value)}
                keyboardType="numeric"
                onBlur={onBlur}
                editable={true}
              />
            )}
          />
          {errors.amount && <Text style={styles.error}>{errors.amount.message}</Text>}

          <Pressable
            style={[styles.allocationButton, !canOpenAllocation && styles.allocationButtonDisabled]}
            onPress={() => {
              if (!canOpenAllocation) {
                Toast.show({
                  type: "error",
                  text1: "Lengkapi dulu",
                  text2: "Pilih kontak dan masukkan jumlah pembayaran",
                });
                return;
              }

              setAllocationModalOpen(true);
            }}
          >
            <Text style={styles.allocationButtonText}>Atur Alokasi</Text>
          </Pressable>

          <Text style={styles.label}>Catatan (opsional)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Catatan singkat"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                multiline
                numberOfLines={3}
              />
            )}
          />

          <Text style={styles.label}>Gambar (opsional)</Text>
          <Controller
            control={control}
            name="mediaUri"
            render={({ field: { onChange, value } }) => (
              <View>
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ["images"],
                      quality: image_compression_quality,
                    });
                    if (!result.canceled) {
                      onChange(result.assets[0].uri);
                    }
                  }}
                >
                  <Text>{value ? "Ubah Foto" : "Pilih Foto"}</Text>
                </TouchableOpacity>
                {value && (
                  <Pressable onPress={() => setPreviewImageUri(value)}>
                    <Image
                      source={{ uri: value }}
                      style={{ width: 120, height: 120, marginTop: 10, borderRadius: 8 }}
                    />
                  </Pressable>
                )}
              </View>
            )}
          />

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>Simpan</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!previewImageUri} transparent animationType="fade">
        <Pressable style={styles.photoOverlay} onPress={() => setPreviewImageUri(null)}>
          <Pressable style={styles.photoContainer} onPress={() => null}>
            {previewImageUri && (
              <Image source={{ uri: previewImageUri }} style={styles.photoImage} resizeMode="contain" />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <PaymentAllocationModal
        visible={allocationModalOpen}
        amount={amountValue}
        contactId={watchedContactId || null}
        type={watchedType as "income" | "expense"}
        initialAllocations={allocationDraft}
        onApply={(items) => setAllocationDraft(items)}
        onClose={() => setAllocationModalOpen(false)}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: Spacing.sm,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    marginBottom: Spacing.xs,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  option: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.secondary,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  error: {
    color: Colors.danger,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
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
  allocationButton: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  allocationButtonDisabled: {
    borderColor: Colors.border,
    opacity: 0.6,
  },
  allocationButtonText: {
    color: Colors.primary,
    fontWeight: "600",
  },
});
