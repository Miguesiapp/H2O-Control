import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, ScrollView } from "react-native";
import { ChevronDown } from "lucide-react-native";

const normalizeString = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const getDisplayName = (str) => {
  if (!str) return "";
  return str.split(" / ")[0];
};

const filterData = (dataList, input) => {
  if (!dataList || dataList.length === 0) return [];
  const rawNorm = normalizeString(input).trim();
  if (!rawNorm) return dataList;

  const stopWords = new Set(["etiqueta", "etiquetas", "bidon", "bidones", "caja", "cajas", "de", "para", "mp", "granel"]);
  const tokens = rawNorm.split(/\s+/).filter(t => t.length > 0 && !stopWords.has(t));

  if (tokens.length === 0) {
    return dataList.filter(item => normalizeString(item).includes(rawNorm));
  }

  return dataList.filter(item => {
    const itemNorm = normalizeString(item);
    return tokens.every(tok => itemNorm.includes(tok)) || itemNorm.includes(rawNorm);
  });
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
  
  // Sincronizar el estado local si el valor externo cambia
  useEffect(() => {
    setInputText(getDisplayName(value || ""));
  }, [value]);

  useEffect(() => {
    if (showSuggestions) {
      const items = filterData(data || [], inputText);
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
    const displayName = getDisplayName(item);
    setInputText(displayName);
    onChangeText(item);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 300);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputWrapper}>
        {IconComponent && <View style={styles.icon}>{IconComponent}</View>}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={inputText}
          onChangeText={(txt) => {
            setInputText(txt);
            if (allowCustom) {
               onChangeText(txt);
            } else {
               const exactMatch = (data || []).find(d => getDisplayName(d).toUpperCase() === txt.trim().toUpperCase());
               if (exactMatch) {
                 onChangeText(exactMatch);
               } else if (value !== "") {
                 onChangeText("");
               }
            }
            setShowSuggestions(true);
          }}
          onFocus={() => {
             setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />
        <TouchableOpacity 
          style={styles.chevronBtn} 
          onPress={() => setShowSuggestions(prev => !prev)}
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
          {filteredData.map((item, index) => (
             <TouchableOpacity 
               key={index.toString()} 
               style={styles.suggestionItem}
               onPress={() => handleSelect(item)}
             >
               <Text style={styles.suggestionText}>{getDisplayName(item)}</Text>
             </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginBottom: 15,
    zIndex: 1000,
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
  chevronBtn: {
    padding: 6,
    marginLeft: 4,
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
    maxHeight: 250,
    overflow: "hidden",
    marginTop: -5,
    marginBottom: 15,
    elevation: 10,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestionText: {
    fontSize: 15,
    color: "#334155",
    fontWeight: "600",
  }
});
