import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Linking } from 'react-native';

import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const KeyIcon = () => (
 
  <Ionicons name="key" size={24} color="#3B82F6" />
);

const DeleteIcon = () => (

  <FontAwesome5 name="trash-alt" size={24} color="#E63946" />
);

const CloseIcon = () => (
  
  <MaterialIcons name="close" size={26} color="#E0E0E0" />
);

const DrawerContent = ({ closeDrawer, openApiKeyModal, clearMessages }) => {
  const handleClearHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to clear all chat messages? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: () => {
            clearMessages();
            closeDrawer(); 
          }
        }
      ]
    );
  };

  const handleSetApiKey = () => {
    openApiKeyModal();
  };
  
  const openLinkedIn = () => {
    Linking.openURL('https://www.linkedin.com/in/aman-raj-3a3ab02b2/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={closeDrawer}
          accessibilityLabel="Close menu"
        >
          <CloseIcon />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={handleSetApiKey}
      >
        <KeyIcon />
        <Text style={styles.menuItemText}>Set API Key</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={handleClearHistory}
      >
        <DeleteIcon />
        <Text style={styles.menuItemText}>Clear Chat History</Text>
      </TouchableOpacity>
      
      <View style={styles.footer}>
        <View style={styles.footerContent}>
        <Text style={styles.footerText}>
          Created by{' '}
          <Text style={styles.link} onPress={openLinkedIn}>
            Aman Raj
          </Text>
        </Text>
        </View>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A25', 
    width: '100%',
  },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#0F172A', 
  },
  closeButton: {
    padding: 10,
    borderRadius: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3A', 
  },
  menuItemText: {
    fontSize: 16,
    color: '#E0E0E0', 
    marginLeft: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    height: 60,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#2D2D3A', 
    backgroundColor: '#1A1A25', 
  },
  footerContent: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#9E9E9E', 
    textAlign: 'center',
  },
  link: {
    color: '#3B82F6', 
    fontWeight: 'bold',
    textDecorationLine: 'underline',
   
  }
});




export default DrawerContent;