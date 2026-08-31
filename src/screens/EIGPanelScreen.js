import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Modal, StatusBar, Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, G, Text as SvgText } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import { db, storage, auth } from "../config/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { ChevronLeft, Plus, FileText, Trash2, Edit3, ExternalLink, ShieldAlert, X, ChevronDown, ChevronUp, FileUp, Beaker, Package, FlaskConical } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { RAW_MATERIALS_LIST, PRODUCTS_MADRE_LIST, PRODUCTS_FINAL_LIST } from "../config/constants";

const EIGLogo = ({ size = 48 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <G transform="translate(12, 50)">
      <Circle cx="0" cy="0" r="32" stroke="#2a7d7b" strokeWidth="5" fill="none" />
      <Circle cx="0" cy="0" r="22" stroke="#2a7d7b" strokeWidth="4.5" fill="none" />
      <Circle cx="0" cy="0" r="13" stroke="#2a7d7b" strokeWidth="4" fill="none" />
      <Circle cx="0" cy="0" r="5" fill="#2a7d7b" />
      <Path d="M 28 -20 Q 45 0 28 20" stroke="#1aaa8a" strokeWidth="5" fill="none" strokeLinecap="round" />
    </G>
    <SvgText x="52" y="62" fontSize="34" fontWeight="bold" fill="#2a7d7b" fontFamily="sans-serif">eig</SvgText>
  </Svg>
);

const SECTIONS = [
  { key: "MP",         label: "Materia Prima", color: "#0369a1", bg: "#eff6ff", icon: "beaker" },
  { key: "PRODUCCION", label: "Produccion",    color: "#7c3aed", bg: "#f5f3ff", icon: "flask"  },
  { key: "ENVASADO",   label: "Envasado",      color: "#0f766e", bg: "#f0fdfa", icon: "package" },
];

const shortName = (str) => str?.split("/")[0]?.trim() || str;

export default function EIGPanelScreen({ navigation }) {
  const [docs, setDocs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [openSection, setOpenSection]   = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [prefillName, setPrefillName] = useState("");
  const [prefillType, setPrefillType] = useState("MP");
  const [formTitle, setFormTitle]   = useState("");
  const [formNotes, setFormNotes]   = useState("");
  const [formPdfFile, setFormPdfFile] = useState(null);

  const userEmail = auth.currentUser?.email;

  useEffect(() => {
    const q = query(collection(db, "EIG_Documents"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const findDoc = (linkedType, linkedName) =>
    docs.find(
      d => d.linkedType === linkedType &&
           d.linkedName?.trim().toUpperCase() === linkedName?.trim().toUpperCase()
    );

  const resetForm = () => {
    setFormTitle(""); setFormNotes(""); setFormPdfFile(null);
    setEditingDoc(null); setPrefillName(""); setPrefillType("MP");
  };

  const openCreate = (linkedType, linkedName) => {
    resetForm(); setPrefillType(linkedType); setPrefillName(linkedName); setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingDoc(item); setPrefillType(item.linkedType); setPrefillName(item.linkedName);
    setFormTitle(item.title || ""); setFormNotes(item.notes || ""); setFormPdfFile(null); setShowModal(true);
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) setFormPdfFile(result.assets[0]);
    } catch (e) { Alert.alert("Error", "No se pudo seleccionar el archivo."); }
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { Alert.alert("Atencion", "El titulo es obligatorio."); return; }
    setSaving(true);
    try {
      let pdfUrl = editingDoc?.pdfUrl || null;
      let pdfName = editingDoc?.pdfName || null;
      if (formPdfFile) {
        const blob = await (await fetch(formPdfFile.uri)).blob();
        const storageRef = ref(storage, "eig_docs/" + Date.now() + "_" + formPdfFile.name);
        await uploadBytes(storageRef, blob);
        pdfUrl = await getDownloadURL(storageRef);
        pdfName = formPdfFile.name;
      }
      const payload = { linkedType: prefillType, linkedName: prefillName, title: formTitle.trim(), notes: formNotes.trim(), pdfUrl, pdfName, uploadedBy: userEmail, updatedAt: serverTimestamp() };
      if (editingDoc) {
        await updateDoc(doc(db, "EIG_Documents", editingDoc.id), payload);
        Toast.show({ type: "success", text1: "Actualizado", text2: "Documento EIG actualizado." });
      } else {
        await addDoc(collection(db, "EIG_Documents"), payload);
        Toast.show({ type: "success", text1: "Guardado", text2: "Nuevo documento EIG registrado." });
      }
      setShowModal(false); resetForm();
    } catch (e) { Alert.alert("Error", "No se pudo guardar: " + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = (item) => {
    Alert.alert("Eliminar", "Esta accion no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        try {
          if (item.pdfUrl) { try { await deleteObject(ref(storage, item.pdfUrl)); } catch (_) {} }
          await deleteDoc(doc(db, "EIG_Documents", item.id));
          Toast.show({ type: "success", text1: "Eliminado" });
        } catch (e) { Alert.alert("Error", "No se pudo eliminar."); }
      }}
    ]);
  };

  const listForSection = (key) => {
    if (key === "MP")         return RAW_MATERIALS_LIST;
    if (key === "PRODUCCION") return PRODUCTS_MADRE_LIST;
    if (key === "ENVASADO")   return PRODUCTS_FINAL_LIST;
    return [];
  };

  const renderItem = (name, section, idx) => {
    const eigDoc    = findDoc(section.key, name);
    const itemKey   = section.key + "::" + idx;
    const isExpanded = expandedItem === itemKey;
    return (
      <View key={itemKey} style={[styles.item, { borderLeftColor: section.color }]}>
        <TouchableOpacity style={styles.itemHeader} onPress={() => setExpandedItem(isExpanded ? null : itemKey)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{shortName(name)}</Text>
            {eigDoc ? (
              <View style={styles.docTagRow}>
                <FileText size={11} color={section.color} />
                <Text style={[styles.docTag, { color: section.color }]}>{eigDoc.title}</Text>
                {eigDoc.pdfName && (<><Text style={styles.docTagSep}>·</Text><Text style={[styles.docTag, { color: "#0369a1" }]}>PDF</Text></>)}
              </View>
            ) : (
              <Text style={styles.noDocTag}>Sin informacion EIG cargada</Text>
            )}
          </View>
          <View style={styles.itemActions}>
            {eigDoc ? (
              <TouchableOpacity onPress={() => openEdit(eigDoc)} style={styles.iconBtn}>
                <Edit3 size={16} color="#3b82f6" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => openCreate(section.key, name)} style={[styles.addInfoBtn, { backgroundColor: section.color }]}>
                <Plus size={14} color="#fff" />
                <Text style={styles.addInfoBtnText}>Agregar</Text>
              </TouchableOpacity>
            )}
            {eigDoc && (
              <TouchableOpacity onPress={() => handleDelete(eigDoc)} style={styles.iconBtn}>
                <Trash2 size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
            {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
          </View>
        </TouchableOpacity>

        {isExpanded && eigDoc && (
          <View style={styles.itemBody}>
            {eigDoc.notes ? (
              <View style={[styles.notesBox, { backgroundColor: section.bg }]}>
                <Text style={[styles.notesLabel, { color: section.color }]}>Observaciones de Seguridad</Text>
                <Text style={styles.notesText}>{eigDoc.notes}</Text>
              </View>
            ) : <Text style={styles.noNotes}>Sin notas adicionales.</Text>}
            {eigDoc.pdfUrl && (
              <TouchableOpacity style={[styles.openPdfBtn, { backgroundColor: "#0369a1" }]}
                onPress={() => Linking.openURL(eigDoc.pdfUrl).catch(() => Alert.alert("Error", "No se pudo abrir el PDF."))}>
                <ExternalLink size={15} color="#fff" />
                <Text style={styles.openPdfBtnText}>Abrir Hoja Tecnica (PDF)</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.cardMeta}>
              Cargado por: {eigDoc.uploadedBy} · {eigDoc.updatedAt?.seconds ? new Date(eigDoc.updatedAt.seconds * 1000).toLocaleDateString() : "N/A"}
            </Text>
          </View>
        )}
        {isExpanded && !eigDoc && (
          <View style={styles.itemBody}>
            <TouchableOpacity onPress={() => openCreate(section.key, name)} style={[styles.openPdfBtn, { backgroundColor: section.color }]}>
              <Plus size={15} color="#fff" />
              <Text style={styles.openPdfBtnText}>Cargar Informacion EIG</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSection = (section) => {
    const isOpen = openSection === section.key;
    const list   = listForSection(section.key);
    const covered = docs.filter(d => d.linkedType === section.key).length;
    return (
      <View key={section.key} style={[styles.sectionCard, { borderLeftColor: section.color }]}>
        <TouchableOpacity style={styles.sectionHeader} onPress={() => { setOpenSection(isOpen ? null : section.key); setExpandedItem(null); }}>
          <View style={[styles.sectionIconBox, { backgroundColor: section.bg }]}>
            {section.icon === "beaker"  && <Beaker    size={20} color={section.color} />}
            {section.icon === "flask"   && <FlaskConical size={20} color={section.color} />}
            {section.icon === "package" && <Package   size={20} color={section.color} />}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <Text style={styles.sectionSub}>{covered} de {list.length} items con info EIG</Text>
          </View>
          {isOpen ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
        </TouchableOpacity>
        {isOpen && <View style={styles.sectionBody}>{list.map((name, idx) => renderItem(name, section, idx))}</View>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")} style={styles.backBtn}>
          <ChevronLeft color="#0f172a" size={28} />
        </TouchableOpacity>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <EIGLogo size={46} />
          <View>
            <Text style={styles.pageTitle}>Panel EIG</Text>
            <Text style={styles.pageSub}>Seguridad e Higiene</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2a7d7b" />
          <Text style={styles.loadingText}>Cargando documentos EIG...</Text>
        </View>
      ) : (
        <ScrollView maximumZoomScale={1} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {SECTIONS.map(s => renderSection(s))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{editingDoc ? "Editar Documento" : "Nuevo Documento EIG"}</Text>
                <Text style={styles.modalSub} numberOfLines={1}>{shortName(prefillName)}</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <X color="#64748b" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView maximumZoomScale={1} showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              <View style={[styles.typeTag, { backgroundColor: prefillType === "MP" ? "#eff6ff" : prefillType === "PRODUCCION" ? "#f5f3ff" : "#f0fdfa" }]}>
                <Text style={[styles.typeTagText, { color: prefillType === "MP" ? "#0369a1" : prefillType === "PRODUCCION" ? "#7c3aed" : "#0f766e" }]}>
                  {prefillType === "MP" ? "Materia Prima" : prefillType === "PRODUCCION" ? "Produccion (Granel)" : "Envasado (PT)"}
                </Text>
              </View>
              <Text style={styles.label}>Titulo del Documento</Text>
              <TextInput style={styles.input} placeholder="Ej: Hoja Tecnica de Seguridad" value={formTitle} onChangeText={setFormTitle} />
              <Text style={styles.label}>Archivo PDF (Hoja Tecnica)</Text>
              <TouchableOpacity style={styles.pdfPickerBtn} onPress={pickPdf}>
                <FileUp size={20} color="#2a7d7b" />
                <Text style={styles.pdfPickerText}>
                  {formPdfFile ? "Seleccionado: " + formPdfFile.name : editingDoc?.pdfName ? editingDoc.pdfName + " (toca para reemplazar)" : "Seleccionar PDF..."}
                </Text>
              </TouchableOpacity>
              <Text style={styles.label}>Notas / Observaciones adicionales</Text>
              <TextInput style={[styles.input, { height: 110, textAlignVertical: "top" }]}
                placeholder="Precauciones, EPP requerido, condiciones de uso..."
                value={formNotes} onChangeText={setFormNotes} multiline numberOfLines={4} />
            </ScrollView>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <><ShieldAlert size={18} color="#fff" /><Text style={styles.saveBtnText}>{editingDoc ? "Actualizar" : "Guardar Documento"}</Text></>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backBtn: { padding: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 14, marginBottom: 14 },
  titleLeft: { flexDirection: "row", alignItems: "center", gap: 15 },
  pageTitle: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  pageSub:   { fontSize: 13, color: "#64748b", fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#94a3b8", fontWeight: "700" },
  listContent: { padding: 16, gap: 14 },
  sectionCard: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 4, overflow: "hidden", elevation: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 4 },
  sectionIconBox: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  sectionSub:   { fontSize: 11, color: "#64748b", fontWeight: "700", marginTop: 2 },
  sectionBody:  { borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  item: { borderLeftWidth: 3, marginHorizontal: 12, marginVertical: 4, backgroundColor: "#fafafa", borderRadius: 10, overflow: "hidden" },
  itemHeader: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  itemName:   { fontSize: 13, fontWeight: "800", color: "#0f172a", marginBottom: 3 },
  docTagRow:  { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  docTag:     { fontSize: 11, fontWeight: "700" },
  docTagSep:  { fontSize: 11, color: "#cbd5e1" },
  noDocTag:   { fontSize: 11, color: "#94a3b8", fontStyle: "italic" },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn:     { padding: 4 },
  addInfoBtn:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addInfoBtnText: { fontSize: 11, fontWeight: "800", color: "#fff" },
  itemBody:  { borderTopWidth: 1, borderTopColor: "#f1f5f9", padding: 12, gap: 10 },
  notesBox:  { borderRadius: 10, padding: 12 },
  notesLabel:{ fontSize: 11, fontWeight: "800", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  notesText: { fontSize: 13, color: "#334155", lineHeight: 20 },
  noNotes:   { fontSize: 12, color: "#94a3b8", fontStyle: "italic" },
  openPdfBtn:{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, justifyContent: "center" },
  openPdfBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  cardMeta:  { fontSize: 10, color: "#94a3b8", textAlign: "right", fontStyle: "italic" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.65)", justifyContent: "flex-end" },
  modalBox:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle:   { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  modalSub:     { fontSize: 12, color: "#64748b", fontWeight: "700", marginTop: 2 },
  typeTag:     { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 4 },
  typeTagText: { fontSize: 12, fontWeight: "800" },
  label:  { fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  input:  { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 14, color: "#0f172a" },
  pdfPickerBtn:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f0fdf4", borderWidth: 1.5, borderColor: "#2a7d7b", borderRadius: 12, borderStyle: "dashed", padding: 14 },
  pdfPickerText: { flex: 1, fontSize: 13, color: "#2a7d7b", fontWeight: "700" },
  saveBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#2a7d7b", padding: 18, borderRadius: 14, marginTop: 20 },
  saveBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
