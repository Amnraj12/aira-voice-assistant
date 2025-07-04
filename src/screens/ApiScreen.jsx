import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  BackHandler
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import axios from 'axios';
import { Linking } from 'react-native';

const CloseIcon = () => (
  <View style={iconStyles.closeContainer}>
    <View style={iconStyles.closeLine1} />
    <View style={iconStyles.closeLine2} />
  </View>
);

const iconStyles = StyleSheet.create({
  closeContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeLine1: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: '#E0E0E0', 
    transform: [{rotate: '45deg'}]
  },
  closeLine2: {
    position: 'absolute',
    width: 16,
    height: 2,
    backgroundColor: '#E0E0E0', 
    transform: [{rotate: '-45deg'}]
  }
});

const ApiScreen = ({ visible, onClose, onApiKeySaved, isFirstTimeSetup = false }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState(null); 

  useEffect(() => {
    if (visible) {
      setTestResult(null);
      checkExistingApiKey();
    }
  }, [visible]);

  const checkExistingApiKey = async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'groqApiKey'
      });
      
      if (credentials) {
        setApiKey(credentials.password);
      }
    } catch (error) {
      console.log('Error retrieving API key:', error);
    }
  };

  const testAndSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
          max_tokens: 50
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      if (response.data) {
        await Keychain.setGenericPassword('groqApiKey', apiKey, {
          service: 'groqApiKey'
        });
        
        setTestResult('success');
        
        setTimeout(() => {
          if (onApiKeySaved) {
            onApiKeySaved(apiKey);
            setTestResult(null); 
          }
        }, 800); 
      }
    } catch (error) {
      console.log('API Test Error:', error);
      setTestResult('error');
      
      
      setTimeout(() => {
        setTestResult(null);
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleBackPress = () => {
    if (!isFirstTimeSetup && onClose) {
      onClose();
    }
    return true; 
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleBackPress}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            {!isFirstTimeSetup && (
              <TouchableOpacity 
                onPress={onClose}
                style={styles.closeButtonContainer}
                accessibilityLabel="Close API key screen"
              >
                <CloseIcon />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>Enter Groq API Key</Text>
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Enter your Groq API key"
            placeholderTextColor="#94A3B8"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry={true}
            autoCapitalize="none"
          />
          
          <Text style={styles.securityMessage}>
            Your API key is stored securely on your device and is only used to make direct API calls to Groq. We do not save your API key or any data you provide.
          </Text>

          <Text style={styles.helpText}>
            You can see how to create a Groq API key{' '}
            <Text 
              style={styles.linkText}
              onPress={() => Linking.openURL('https://youtu.be/TTG7Uo8lS1M?si=WKY3buaXzQ898gxD')}
            >
              here
            </Text>.
          </Text>
          
          <TouchableOpacity 
            style={styles.testButton} 
            onPress={testAndSaveApiKey}
            disabled={isLoading}
            accessibilityLabel="Save API key"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save</Text>
            )}
          </TouchableOpacity>
          
          {testResult === 'success' && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                API key verified and saved successfully!
              </Text>
            </View>
          )}

          {testResult === 'error' && (
            <Text style={styles.errorText}>
              Failed to verify API key. Please check the key and try again.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1A1A25', 
    padding: 20,
    borderRadius: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#2D2D3A', 
  },
  modalHeader: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButtonContainer: {
    position: 'absolute',
    left: 4,
    top: 3,
    padding: 5,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E0E0E0', 
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2D2D3A', 
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#3B82F6', 
    color: '#E0E0E0', 
  },
  securityMessage: {
    fontSize: 13,
    color: '#94A3B8', 
    marginBottom: 8,
    lineHeight: 18,
  },
  helpText: {
    fontSize: 13,
    color: '#94A3B8', 
    marginBottom: 20, 
    lineHeight: 18,
    textAlign: 'center',
  },
  linkText: {
    color: '#3B82F6', 
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#3B82F6', 
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  successContainer: {
    marginTop: 20,
  },
  successText: {
    color: '#4ADE80', 
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    marginTop: 20,
    color: '#F87171', 
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ApiScreen;