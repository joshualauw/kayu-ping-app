import { Container } from "@/components/Container";
import { Colors, Spacing } from "@/constants/theme";
import { db } from "@/db/client";
import { contacts, payments } from "@/db/schema";
import { saveFileToDisk } from "@/lib/image-helper";
import { formatDate, formatNumber, unformatNumber } from "@/lib/utils";
import { yupResolver } from "@hookform/resolvers/yup";
import { like } from "drizzle-orm";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Image,
  KeyboardAvoidingView,
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
  phoneNumber: string;
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

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { paymentDate: new Date(), contactId: 0, amount: 0, type: "income", method: "cash" },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [contactList, setContactList] = useState<ContactDropdownItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

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
          phoneNumber: contacts.phoneNumber,
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
        const savedUri = saveFileToDisk(data.mediaUri);
        data.mediaUri = savedUri;
      }

      await db.insert(payments).values({
        paymentDate: data.paymentDate.toISOString(),
        contactId: data.contactId,
        amount: data.amount,
        type: data.type,
        method: data.method,
        notes: data.notes,
        mediaUri: data.mediaUri,
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
                        <Text style={{ fontSize: 12, color: "gray" }}>{contact.phoneNumber}</Text>
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
                      quality: 0.9,
                    });
                    if (!result.canceled) {
                      onChange(result.assets[0].uri);
                    }
                  }}
                >
                  <Text>{value ? "Ubah Foto" : "Pilih Foto"}</Text>
                </TouchableOpacity>
                {value && (
                  <Image source={{ uri: value }} style={{ width: 120, height: 120, marginTop: 10, borderRadius: 8 }} />
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
});
