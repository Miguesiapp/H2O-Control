import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, ScrollView, Platform } from "react-native";
import { ChevronDown, X } from "lucide-react-native";
import { formatDisplayName, splitSynonyms } from "../config/constants";

const normalizeString = (str) => {
  if (!str) return "";
  return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const getDisplayName = (str) => {
  if (!str) return "";
  return formatDisplayName(str);
};

// Filtro inteligente que prioriza los nombres que empiezan con lo tipeado
export const smartFilterData = (dataList, input) => {
  if (!dataList || dataList.length === 0) return [];
  const rawNorm = normalizeString(input).trim();
  if (!rawNorm) return dataList;

  const stopWords = new Set(["etiqueta", "etiquetas", "bidon", "bidones", "caja", "cajas", "de", "para", "mp", "granel"]);
  const tokens = rawNorm.split(/\s+/).filter(t => t.length > 0 && !stopWords.has(t));
  const effectiveTokens = tokens.length > 0 ? tokens : [rawNorm];

  const scored = [];
  dataList.forEach(item => {
    if (!item) return;
    const itemStr = String(item);
    const itemNorm = normalizeString(itemStr);
    const mainName = getDisplayName(itemStr);
    const mainNameNorm = normalizeString(mainName);
    const parts = splitSynonyms(itemStr).map(p => normalizeString(p.trim()));

    // El ítem debe contener todos los tokens buscados
    const matchesAll = effectiveTokens.every(tok => itemNorm.includes(tok));
    if (!matchesAll) return;

    let score = 0;

    // 1. Coincidencia exacta con el nombre principal o con algún sinónimo
    if (mainNameNorm === rawNorm) {
      score += 1500;
    } else if (parts.includes(rawNorm)) {
      score += 1300;
    }
    // 2. El nombre principal empieza con el texto buscado (ej: CLORO -> CLOR...)
    else if (mainNameNorm.startsWith(rawNorm)) {
      score += 1000;
    }
    // 3. Algún sinónimo empieza con el texto buscado (ej: CLORO GRANULADO -> CL...)
    else if (parts.some(p => p.startsWith(rawNorm))) {
      score += 850;
    }
    // 4. Alguna palabra dentro del nombre principal empieza con el texto buscado (ej: ACIDO CLORHIDRICO -> CL...)
    else if (mainNameNorm.split(/\s+/).some(w => w.startsWith(rawNorm))) {
      score += 700;
    }
    // 5. Alguna palabra dentro de algún sinónimo empieza con el texto buscado
    else if (parts.some(p => p.split(/\s+/).some(w => w.startsWith(rawNorm)))) {
      score += 500;
    }
    // 6. Substring general
    else if (itemNorm.includes(rawNorm)) {
      score += 200;
    }

    scored.push({ item, score, mainName });
  });

  // Ordenar por relevancia de coincidencia (mayor score primero)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.mainName.localeCompare(b.mainName);
  });

  return scored.map(s => s.item);
};

export default function AutocompleteInput({ 
  data, 
  value, 
  onChangeText, 
  placeholder, 
  icon: IconComponent, 
  containerStyle,
  allowCustom = false
}) {
  const [inputText, setInputText] = useState(getDisplayName(value || ""));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const isUserTyping = useRef(false);

  // Sincronizar el estado local si el valor externo cambia y NO estamos tipeando activamente
  useEffect(() => {
    if (!isUserTyping.current) {
      setInputText(getDisplayName(value || ""));
    }
  }, [value]);

  useEffect(() => {
    if (showSuggestions) {
      // Si el usuario está tipeando activamente en el input, filtramos por lo que escribió
      // Si el usuario abrió con el chevron sin tipear, mostramos toda la lista
      const searchTerm = isUserTyping.current ? inputText : (inputText && inputText !== getDisplayName(value || "") ? inputText : "");
      const items = smartFilterData(data || [], searchTerm);

      const uniqueFiltered = [];
      const seenNames = new Set();
      items.forEach(item => {
        const dName = getDisplayName(item);
        if (!seenNames.has(dName)) {
          seenNames.add(dName);
          uniqueFiltered.push(item);
        }
      });
      setFilteredData(uniqueFiltered);
    } else {
      setFilteredData([]);
    }
  }, [inputText, data, showSuggestions]);

  const handleSelect = (item) => {
    isUserTyping.current = false;
    const displayName = getDisplayName(item);
    setInputText(displayName);
    onChangeText(item);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleClear = () => {
    isUserTyping.current = false;
    setInputText("");
    onChangeText("");
    setShowSuggestions(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      isUserTyping.current = false;
      setShowSuggestions(false);
    }, 250);
  };

  return (
    <View style={[styles.container, containerStyle, { zIndex: showSuggestions ? 99999 : 10 }]}>
      <View style={styles.inputWrapper}>
        {IconComponent && <View style={styles.icon}>{IconComponent}</View>}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={inputText}
          onChangeText={(txt) => {
            isUserTyping.current = true;
            setInputText(txt);
            setShowSuggestions(true);

            if (allowCustom) {
              onChangeText(txt);
            } else {
              const txtNorm = txt.trim().toUpperCase();
              const exactMatch = (data || []).find(d => {
                const dUpper = (d || "").toUpperCase();
                const parts = dUpper.split('/').map(p => p.trim());
                return parts.includes(txtNorm) || getDisplayName(d).toUpperCase() === txtNorm || dUpper === txtNorm;
              });
              if (exactMatch) {
                onChangeText(exactMatch);
              } else if (value !== "") {
                onChangeText("");
              }
            }
          }}
          onFocus={() => {
            setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />

        {inputText.length > 0 && (
          <TouchableOpacity 
            style={styles.clearBtn} 
            onPress={handleClear}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color="#94a3b8" size={16} />
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.chevronBtn} 
          onPress={() => {
            isUserTyping.current = false;
            setShowSuggestions(prev => !prev);
          }}
          activeOpacity={0.7}
        >
          <ChevronDown color="#94a3b8" size={18} />
        </TouchableOpacity>
      </View>

      {showSuggestions && filteredData.length > 0 && (
        <ScrollView 
          style={styles.dropdown} 
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {filteredData.slice(0, 40).map((item, index) => {
            const mainName = getDisplayName(item);
            const queryNorm = normalizeString(inputText).trim();
            const rawParts = typeof item === 'string' ? splitSynonyms(item) : [];
            const otherSynonyms = rawParts.length > 1 ? rawParts.slice(1).join(' / ') : null;

            // Detectar si el texto buscado coincide específicamente con algún sinónimo alternativo
            let matchedSynonym = null;
            if (queryNorm.length > 0 && rawParts.length > 1) {
              const foundPart = rawParts.slice(1).find(p => normalizeString(p).includes(queryNorm));
              if (foundPart && normalizeString(foundPart) !== normalizeString(mainName)) {
                matchedSynonym = foundPart.trim();
              }
            }

            return (
              <TouchableOpacity 
                key={index.toString()} 
                style={styles.suggestionItem}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionText}>
                    {mainName}
                    {matchedSynonym ? (
                      <Text style={styles.matchedBadge}> ({matchedSynonym})</Text>
                    ) : null}
                  </Text>
                  {otherSynonyms && (
                    <Text style={styles.suggestionSubText} numberOfLines={1}>
                      {otherSynonyms}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginBottom: 15,
    width: "100%",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 15,
    width: "100%",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "600",
  },
  clearBtn: {
    padding: 6,
    marginRight: 2,
  },
  chevronBtn: {
    padding: 6,
    marginLeft: 2,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    maxHeight: 280,
    marginTop: 4,
    marginBottom: 15,
    elevation: 20,
    zIndex: 99999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestionText: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  matchedBadge: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "700",
  },
  suggestionSubText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
    fontWeight: "500",
  }
});
