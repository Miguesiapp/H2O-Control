import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Keyboard, Alert } from 'react-native';

const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
  const [inputText, setInputText] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  
  // Sincronizar el estado local si el valor externo cambia (ej: cuando se resetea el form)
  useEffect(() => {
    setInputText(value || '');
  }, [value]);

  useEffect(() => {
    if (inputText && showSuggestions) {
      const normalizedInput = normalizeString(inputText);
      const filtered = data.filter(item => 
        normalizeString(item).includes(normalizedInput)
      );
      setFilteredData(filtered);
    } else {
      setFilteredData([]);
    }
  }, [inputText, data, showSuggestions]);

  const handleSelect = (item) => {
    const displayName = item.split('/')[0].trim();
    setInputText(displayName);
    onChangeText(displayName);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleBlur = () => {
    // Esconder sugerencias con un retraso mayor para asegurar que onPress en Web se registre
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
               // Vaciamos el valor en el componente padre hasta que seleccione algo válido
               if (value !== '') onChangeText(''); 
            }
            setShowSuggestions(true);
          }}
          onFocus={() => {
             if (inputText) setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />
      </View>

      {showSuggestions && filteredData.length > 0 && (
        <View style={styles.dropdown}>
          {filteredData.slice(0, 5).map((item, index) => {
             return (
             <TouchableOpacity 
               key={index.toString()} 
               style={styles.suggestionItem}
               onPress={() => handleSelect(item)}
               keyboardShouldPersistTaps="always"
             >
               <Text style={styles.suggestionText}>{item}</Text>
             </TouchableOpacity>
          )})}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 15,
    zIndex: 1000,
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
    width: '100%',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    maxHeight: 250,
    overflow: 'hidden',
    marginTop: -5,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000', // Sombra para iOS
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '600',
  }
});
