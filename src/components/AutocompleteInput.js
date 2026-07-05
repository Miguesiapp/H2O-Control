import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Keyboard } from 'react-native';

export default function AutocompleteInput({ 
  data, 
  value, 
  onChangeText, 
  placeholder, 
  icon: IconComponent, 
  containerStyle 
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (value && showSuggestions) {
      const filtered = data.filter(item => 
        item.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredData(filtered);
    } else {
      setFilteredData([]);
    }
  }, [value, data, showSuggestions]);

  const handleSelect = (item) => {
    onChangeText(item);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputWrapper}>
        {IconComponent && <View style={styles.icon}>{IconComponent}</View>}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={(txt) => {
            onChangeText(txt);
            setShowSuggestions(true);
          }}
          onFocus={() => {
             if (value) setShowSuggestions(true);
          }}
          placeholderTextColor="#94a3b8"
          autoCapitalize="characters"
        />
      </View>

      {showSuggestions && filteredData.length > 0 && (
        <View style={styles.dropdown}>
          {filteredData.slice(0, 5).map((item, index) => {
             const displayName = item.split('/')[0].trim();
             return (
             <TouchableOpacity 
               key={index.toString()} 
               style={styles.suggestionItem}
               onPress={() => handleSelect(displayName)}
             >
               <Text style={styles.suggestionText}>{displayName}</Text>
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
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 15,
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
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 9999,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  }
});
