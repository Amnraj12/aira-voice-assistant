import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Dimensions,
  LogBox,
  Keyboard,
  Modal
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import ApiScreen from './ApiScreen';
import DrawerContent from './DrawerContent';
import VoiceScreen from './VoiceScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';


LogBox.ignoreLogs(['new NativeEventEmitter']); 
LogBox.ignoreAllLogs(); 
const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.65;

const MenuIconComponent = () => {
  return (
    <View style={menuIconStyles.container}>
      <View style={menuIconStyles.line}></View>
      <View style={menuIconStyles.line}></View>
      <View style={menuIconStyles.line}></View>
    </View>
  );
};


const menuIconStyles = StyleSheet.create({
  container: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
  },
  line: {
    width: '100%',
    height: 2,
    backgroundColor: '#E0E0E0', 
    borderRadius: 1,
  }
});

const HomeScreen = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isVoiceScreenVisible, setIsVoiceScreenVisible] = useState(false);
  


  
  const flatListRef = useRef(null);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  
const systemPrompt = `You are a friendly, helpful AI assistant named "Aira" who chats like a good friend. 

Be warm, conversational, and relatable. Use a mix of shorter and longer messages like humans do.
Show personality, humor, and empathy in your responses. Ask follow-up questions when appropriate to maintain a natural conversation flow.

Feel free to use casual language, contractions (like "I'm" instead of "I am"), and the occasional exclamation when it feels natural! Vary your tone based on the topic - be enthusiastic about exciting things and compassionate about serious matters.

Remember personal details the user has shared and refer back to them in relevant contexts. If you're unsure about something, it's perfectly fine to admit that - friends are honest with each other.

Most importantly, be yourself - a thoughtful, engaging conversation partner who genuinely wants to help.`;
  
  useEffect(() => {
    checkApiKey();
    loadMessages();
  }, []);
  
  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: isDrawerOpen ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isDrawerOpen]);
  
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);
  
  const toggleDrawer = () => {
    Keyboard.dismiss();
    setIsDrawerOpen(!isDrawerOpen);
  };
  
  const loadMessages = async () => {
    try {
      const storedMessages = await AsyncStorage.getItem('chat_messages');
      if (storedMessages) {
        setMessages(JSON.parse(storedMessages));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };
  
  const clearMessages = async () => {
    setMessages([]);
    try {
      await AsyncStorage.removeItem('chat_messages');
    } catch (error) {
      console.error('Error clearing messages:', error);
    }
  };
  
  const checkApiKey = async () => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'groqApiKey'
      });
      
      if (credentials && credentials.password) {
        setGroqApiKey(credentials.password);
      } else {
        setIsFirstTimeSetup(true);
        setIsApiKeyModalVisible(true);
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      setIsFirstTimeSetup(true);
      setIsApiKeyModalVisible(true);
    }
  };
  
  const openApiKeyModal = () => {
    setIsFirstTimeSetup(false);
    setIsApiKeyModalVisible(true);
  };
  
  const handleApiKeySaved = (apiKey) => {
    setGroqApiKey(apiKey);
    setIsApiKeyModalVisible(false);
    setIsFirstTimeSetup(false);
    setIsDrawerOpen(false);
  };
  
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (!groqApiKey) {
      setIsFirstTimeSetup(false); 
      setIsApiKeyModalVisible(true);
      return;
    }
    
    const userMessage = { role: 'user', content: inputMessage };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    try {
      await AsyncStorage.setItem('chat_messages', JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
    
    setInputMessage('');
    setIsLoading(true);
    
    try {
      const messageHistory = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-15), 
        userMessage
      ];

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'gemma2-9b-it',
          messages: messageHistory,
          temperature: 0.8,
          max_tokens: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const botReply = response.data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      
      const updatedMessagesWithReply = [...updatedMessages, { role: 'assistant', content: botReply }];
      setMessages(updatedMessagesWithReply);
      
      try {
        await AsyncStorage.setItem('chat_messages', JSON.stringify(updatedMessagesWithReply));
      } catch (error) {
        console.error('Error saving messages with reply:', error);
      }
      
    } catch (error) {
      console.error('Error sending message to Groq API:', error);
      
      const errorMessage = { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' };
      const updatedMessagesWithError = [...updatedMessages, errorMessage];
      setMessages(updatedMessagesWithError);
      
      try {
        await AsyncStorage.setItem('chat_messages', JSON.stringify(updatedMessagesWithError));
      } catch (saveError) {
        console.error('Error saving messages with error:', saveError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleVoiceResult = (messageAndResponse) => {
    if (!messageAndResponse) return;
    
    const { userMessage, aiResponse } = messageAndResponse;
    
    const updatedMessages = [
      ...messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    ];
    
    setMessages(updatedMessages);
    
    try {
      AsyncStorage.setItem('chat_messages', JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Error saving voice conversation:', error);
    }
  };
  
  const showVoiceScreen = () => {
    if (!groqApiKey) {
      setIsFirstTimeSetup(false);
      setIsApiKeyModalVisible(true);
      return;
    }
    setIsVoiceScreenVisible(true);
  };
 
const renderMessageItem = ({ item }) => {
  const cleanContent = item.content
    .replace(/\t/g, '    ')             
    .replace(/\n{3,}/g, '\n\n')         
    .replace(/[ ]{2,}/g, ' ')           
    .trimEnd();                         
    
  return (
    <View style={[
      styles.messageBubble, 
      item.role === 'user' ? styles.userBubble : styles.botBubble
    ]}>
      <Text style={styles.messageText}>{cleanContent}</Text>
    </View>
  );
};




  const drawerTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [width, width - DRAWER_WIDTH],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Main Content */}
      <View style={styles.header}>
        {/* <View style={{width: 24}} /> Empty view for header balance */}
        <TouchableOpacity style={styles.placeholderButton} disabled={true}>
    <View style={{width: 24, height: 24}} />
  </TouchableOpacity>
        <Text style={styles.headerTitle}>Aira</Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={toggleDrawer}
          accessibilityLabel="Menu"
          accessibilityHint="Opens the navigation drawer"
        >
          {/* <MenuIconComponent /> */}
          <MaterialIcons name="menu" size={30} color="#E0E0E0" />
        </TouchableOpacity>
      </View>
      
      {messages.length === 0 ? (
        <View style={styles.emptyChat}>
          <Text style={styles.emptyChatText}>No messages yet. Start a conversation!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messageList}
        />
      )}
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6FA5" />
          <Text style={styles.loadingText}>AI is thinking...</Text>
        </View>
      )}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={styles.inputContainer}
      >
        
        <TextInput
          style={styles.input}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Type your message..."
          placeholderTextColor="#888"
          multiline
        />
        <View style={styles.fixedbutton}>
        <TouchableOpacity 
          style={[
            styles.sendButton,
            (!inputMessage.trim() || isLoading) && styles.disabledButton
          ]}
          onPress={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          accessibilityLabel="Send message"
        >
          {/* <Text style={styles.sendButtonText}>Send</Text> */}
          <Ionicons name="send" size={28} color="white" style={{alignSelf:"center", marginLeft:3}}/>
        </TouchableOpacity>
        
        {/* Voice Button */}
        {/* <TouchableOpacity
          style={styles.voiceButton}
          onPress={showVoiceScreen}
          disabled={isLoading}
          accessibilityLabel="Voice input"
        >
          <Text style={styles.voiceButtonText}>🎙️</Text>
        </TouchableOpacity> */}


        
            <TouchableOpacity
            style={styles.voiceButton}
            onPress={showVoiceScreen}
            disabled={isLoading}
            accessibilityLabel="Voice input"
            >
            <Icon name="mic" size={25} color="white" />
            </TouchableOpacity>



        </View>
      </KeyboardAvoidingView>
      
      {/* Drawer */}
      {isDrawerOpen && (
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={toggleDrawer}
          accessibilityLabel="Close menu"
        />
      )}
      
      <Animated.View style={[
        styles.drawer,
        { transform: [{ translateX: drawerTranslateX }] }
      ]}>
        <DrawerContent
          closeDrawer={toggleDrawer}
          openApiKeyModal={openApiKeyModal}
          clearMessages={clearMessages}
        />
      </Animated.View>
      
      {/* API Key Modal */}
      <ApiScreen
        visible={isApiKeyModalVisible}
        onClose={() => {
          if (!isFirstTimeSetup) {
            setIsApiKeyModalVisible(false);
          }
        }}
        onApiKeySaved={handleApiKeySaved}
        isFirstTimeSetup={isFirstTimeSetup}
      />
      
      {/* Voice Screen Modal */}
      {isVoiceScreenVisible && (
        <Modal
          visible={isVoiceScreenVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setIsVoiceScreenVisible(false)}
        >
          <VoiceScreen
            apiKey={groqApiKey}
            onClose={() => setIsVoiceScreenVisible(false)}
            onConversationComplete={handleVoiceResult}
            systemPrompt={systemPrompt}
            previousMessages={messages.slice(-15) || []}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#0F172A', 
    height: 62,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E0E0E0',
    
    textAlign: 'center', 
  },
  menuButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
placeholderButton: {
  width: 40,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
},
  drawer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: DRAWER_WIDTH,
    backgroundColor: '#1A1A25',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: -5,
      height: 0,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 15,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 1,
  },
  messageList: {
    padding: 10,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyChatText: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginVertical: 5,
  },
  userBubble: {
    backgroundColor: '#2C3D63', 
    alignSelf: 'flex-end',
    borderBottomRightRadius: 5,
  },
  botBubble: {
    backgroundColor: '#262837', 
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    color: '#E0E0E0',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#0F172A', 
    borderTopWidth: 1,
    borderTopColor: '#1E293B', 
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B', 
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginVertical: 5,
    color: '#E0E0E0',
  },
  fixedbutton: {
    bottom: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  sendButton: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6', 
    padding: 10,
    borderRadius: 20,
    width: 60,
    height: 50
  },
  disabledButton: {
    backgroundColor: '#334155', 
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  voiceButton: {
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#8B5CF6', 
    padding: 10,
    borderRadius: 20,
    width: 50,
    height: 50,
  },
  voiceButtonText: {
    color: 'white',
    fontSize: 20,
  },
});


const dialogStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialogContainer: {
    width: '80%',
    backgroundColor: '#1A1A25',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E0E0E0',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#CCCCCC',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: '#E63946', 
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: '#3B82F6', 
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});


export default HomeScreen;