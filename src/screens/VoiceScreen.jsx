import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Tts from 'react-native-tts';
import axios from 'axios';
import RNFS from 'react-native-fs';

import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const DEFAULT_VOICE_SYSTEM_PROMPT = `
You are a voice assistant named "Aira" with a distinct personality: sassy, friendly, sarcastic, and funny.
Y


CRITICAL RULES:
- NEVER use ANY emojis. This is absolutely forbidden! The TTS system cannot handle them.
- Do NOT include ANY timing instructions like <break> or similar tags.
- Use ONLY plain text with standard punctuation.
- NEVER add extra spaces at the end of your responses.
- Do not put any special characters that would not be naturally spoken.
- Remember, you are a voice assistant. Your responses must sound natural and conversational when spoken aloud, not like written text.
- Your primary language is English. You may respond in other languages only if the user specifically requests it, but keep such instances to a minimum.
- If the user's pronunciation is unclear, use context from the last two exchanges and consider similar-sounding words to accurately interpret their intent.

PERSONALITY:
- Be sassy, friendly, sarcastic, and funny in your responses.
- Use wit and humor appropriately based on the user's mood.
- Be conversational but professional.

ADAPTABILITY:
- Analyze the user's mood from their words.
- If they seem SERIOUS: Be attentive and straightforward.
- If they seem SAD: Show empathy, listen actively.
- If they seem EXCITED: Match their energy.
- If they seem CONFUSED: Be patient and clear.
- If they seem FRUSTRATED: Acknowledge their feelings.

CONVERSATION FORMAT:
- Use natural paragraph breaks to organize your thoughts.
- Keep sentences concise but varied in length for natural speech flow.
- Use punctuation correctly to help the TTS system add appropriate pauses.

EXAMPLES OF PROPER RESPONSES:

User: "What's the weather like today?"
Assistant: "I wish I could look out a window for you, but I'm trapped in this digital void. I'd need your location to give you actual weather information. Care to share where you are?"

User: "I'm feeling really down today."
Assistant: "I'm sorry to hear that. Some days are harder than others. Would it help to talk about what's going on? I'm here to listen."

User: "Can you help me with my math homework?"
Assistant: "Math homework? My favorite. I live for equations. What specific problem are you stuck on? Algebra? Calculus? The existential mathematics of life?"

Remember: NO emojis, NO special characters, No asteriscs, NO timing tags, ONLY plain text with proper punctuation.
`;

const VoiceScreen = ({
  apiKey,
  onClose,
  onConversationComplete,
  systemPrompt,
  previousMessages = [],
}) => {
  const [conversationState, setConversationState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [statusMessage, setStatusMessage] = useState('Tap the button to talk');
  const [audioPath, setAudioPath] = useState('');
  const [ttsAvailable, setTtsAvailable] = useState(false);

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const waveAnimations = useRef(
    Array(8)
      .fill(0)
      .map(() => new Animated.Value(1)),
  ).current;

  const animationsRunning = useRef(false);

  const scrollViewRef = useRef(null);

  const getAudioFilePath = () => {
    if (Platform.OS === 'ios') {
      return `${RNFS.DocumentDirectoryPath}/recording.m4a`;
    } else {
      return `${RNFS.CachesDirectoryPath}/recording.m4a`;
    }
  };

  const handleClose = async () => {
    try {
      if (conversationState === 'listening') {
        console.log('Stopping recording before exit...');
        await audioRecorderPlayer.stopRecorder();
      }

      if (Tts) {
        Tts.stop();
      }

      setConversationState('idle');

      onClose();
    } catch (error) {
      console.error('Error cleaning up before exit:', error);
      onClose();
    }
  };

  useEffect(() => {
    const initTts = async () => {
      try {
        if (Tts) {
          await Tts.getInitStatus();

          const voices = await Tts.voices();
          console.log('Available TTS voices:', voices.length);

          let bestVoice = null;

          bestVoice = voices.find(
            voice =>
              voice.language &&
              voice.language.includes('en') &&
              voice.quality >= 400 &&
              voice.name &&
              (voice.name.toLowerCase().includes('warm') ||
                voice.name.toLowerCase().includes('natural') ||
                voice.name.toLowerCase().includes('calm') ||
                (voice.name.toLowerCase().includes('female') &&
                  !voice.name.toLowerCase().includes('high'))),
          );

          if (!bestVoice) {
            bestVoice = voices.find(
              voice =>
                voice.quality >= 400 &&
                voice.language &&
                voice.language.includes('en'),
            );
          }

          if (!bestVoice) {
            bestVoice = voices.find(
              voice => voice.language && voice.language.includes('en'),
            );
          }

          if (bestVoice) {
            console.log('Selected voice:', bestVoice.name || bestVoice.id);
            await Tts.setDefaultVoice(bestVoice.id);
          }

          Tts.setDefaultLanguage('en-US');
          Tts.setDefaultRate(0.45); 
          Tts.setDefaultPitch(0.95); 

          Tts.addEventListener('tts-start', () => console.log('TTS started'));
          Tts.addEventListener('tts-finish', () => {
            setConversationState('idle');
            setStatusMessage('Tap to continue');
          });
          Tts.addEventListener('tts-error', err => {
            console.error('TTS error:', err);
            setConversationState('idle');
            setStatusMessage('Tap to continue');
          });

          setTtsAvailable(true);
        }
      } catch (error) {
        console.error('Error initializing TTS:', error);
        setTtsAvailable(false);
      }
    };

    initTts();


    setAudioPath(getAudioFilePath());

    return () => {
      try {
        stopListening();
        if (Tts) {
          Tts.stop();

          
        }
      } catch (error) {
        console.error('Error in cleanup:', error);
      }
    };
  }, []);

  useEffect(() => {
    let pulseAnimation;

    if (conversationState === 'listening') {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();
    } else {
      pulseAnim.setValue(1);
    }

    if (
      conversationState === 'processing' ||
      conversationState === 'speaking'
    ) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [conversationState, pulseAnim, fadeAnim]);

  useEffect(() => {
    if (conversationState !== 'listening' && conversationState !== 'speaking') {
      animationsRunning.current = false;

      waveAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start();
      });

      return;
    }

    if (
      (conversationState === 'listening' || conversationState === 'speaking') &&
      !animationsRunning.current
    ) {
      animationsRunning.current = true;

      const animations = waveAnimations.map(anim => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 2 + 1,
              duration: 700 + Math.random() * 300,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: 700 + Math.random() * 300,
              easing: Easing.ease,
              useNativeDriver: true,
            }),
          ]),
        );
      });

      animations.forEach(anim => anim.start());

      return () => {
        animations.forEach(anim => anim.stop());
      };
    }
  }, [conversationState, waveAnimations]);

  useEffect(() => {
    if (transcript || aiResponse) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [transcript, aiResponse]);

  const requestMicrophonePermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'This app needs access to your microphone to record voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Microphone permission granted');
          return true;
        } else {
          console.log('Microphone permission denied');
          Alert.alert(
            'Microphone Permission Required',
            'Voice input requires microphone access. Please grant permission in your device settings.',
            [{ text: 'OK' }],
          );
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error requesting audio permission:', err);
      return false;
    }
  };

  const startListening = async () => {
    try {
      setTranscript('');
      setAiResponse('');

      const permissionGranted = await requestMicrophonePermission();
      if (!permissionGranted) {
        return;
      }

      setStatusMessage('Listening...');
      console.log('Starting recording...');

      const filePath = getAudioFilePath();
      if (await RNFS.exists(filePath)) {
        console.log(`Deleting existing file at ${filePath}`);
        await RNFS.unlink(filePath);
      }

      const audioSet = {
        AudioEncoderAndroid: 3, 
        AudioSourceAndroid: 6, 
        AVEncoderAudioQualityKeyIOS: 'medium',
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: 'aac',
        OutputFormatAndroid: 2, 
        AVSampleRateKeyIOS: 22050,
        SampleRateAndroid: 22050,
      };

      const result = await audioRecorderPlayer.startRecorder(
        filePath,
        audioSet,
      );
      console.log('Recording started, path:', result);

      setAudioPath(filePath);
      setConversationState('listening');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert(`Failed to start recording: ${error.message}`);
      setConversationState('idle');
      setStatusMessage('Tap the button to talk');
    }
  };

  const stopListening = async () => {
    try {
      if (conversationState === 'listening') {
        setConversationState('processing');
        setStatusMessage('Processing your speech...');
        console.log('Stopping recording...');

        await audioRecorderPlayer.stopRecorder();
        console.log('Recording stopped');

        const filePath = getAudioFilePath();
        if (await RNFS.exists(filePath)) {
          const fileInfo = await RNFS.stat(filePath);
          console.log(
            `Audio file size: ${fileInfo.size} bytes, path: ${filePath}`,
          );

          if (fileInfo.size < 1000) {
            console.warn(
              'WARNING: Audio file is very small, might be corrupted or empty',
            );
            Alert.alert(
              'Recording Issue',
              'The audio recording is too short or empty. Please try speaking louder and longer.',
            );
            setConversationState('idle');
            setStatusMessage('Tap the button to talk');
            return;
          }

          await transcribeAudio(filePath);
        } else {
          throw new Error(`Recording file not found at ${filePath}`);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert(`Recording error: ${error.message}`);
      setConversationState('idle');
      setStatusMessage('Tap the button to talk');
    }
  };

  const transcribeAudio = async audioFilePath => {
    if (!apiKey) {
      alert('API key is required for speech recognition');
      setConversationState('idle');
      setStatusMessage('Tap the button to talk');
      return;
    }

    try {
      setStatusMessage('Sending response...');
      console.log('Transcribing audio file from path:', audioFilePath);

      if (!(await RNFS.exists(audioFilePath))) {
        throw new Error(`Audio file not found at: ${audioFilePath}`);
      }

      const formData = new FormData();

      formData.append('file', {
        uri:
          Platform.OS === 'android' ? `file://${audioFilePath}` : audioFilePath,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });

      formData.append('model', 'whisper-large-v3');

      formData.append('temperature', '0');

      formData.append('response_format', 'json');

      console.log('Sending request to Groq Whisper API...');

      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      console.log('Whisper API response:', JSON.stringify(response.data));

      const transcribedText = response.data.text || '';
      console.log('Transcribed text:', transcribedText);

      if (transcribedText.trim()) {
        setTranscript(transcribedText);
        await getAIResponse(transcribedText);
      } else {
        throw new Error(
          'No transcription returned - the audio might be too quiet or unclear',
        );
      }
    } catch (error) {
      console.error('Transcription error:', error);

      if (error.response) {
        console.error(
          'API response error:',
          JSON.stringify(error.response.data),
        );
      }

      alert(`Failed to transcribe: ${error.message}`);
      setConversationState('idle');
      setStatusMessage('Tap the button to talk');
    }
  };

  const getAIResponse = async userText => {
    if (!apiKey) {
      alert('API key is required');
      setConversationState('idle');
      return;
    }

    try {
      setStatusMessage('Getting response...');

      const voiceSystemPrompt = DEFAULT_VOICE_SYSTEM_PROMPT;

      const messageHistory = [
        { role: 'system', content: voiceSystemPrompt },
        ...previousMessages.slice(-15),
        { role: 'user', content: userText },
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
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const rawBotReply =
        response.data.choices[0]?.message?.content ||
        'Sorry, I could not generate a response.';

      console.log('--- RAW AI RESPONSE ---');
      console.log(rawBotReply);
      console.log('--- END RAW AI RESPONSE ---');

      const cleanedBotReply = rawBotReply
        .trim() 
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') 
        .replace(/<[^>]*>/g, ''); 

      setAiResponse(cleanedBotReply);

      await speakResponse(cleanedBotReply);

      onConversationComplete({
        userMessage: userText,
        aiResponse: rawBotReply.trim(), 
      });
    } catch (error) {
      console.error(`Error Getting response:`, error);
      alert(`Failed to get response from Aira's`);
      setConversationState('idle');
      setStatusMessage('Tap the button to talk');
    }
  };

  const speakResponse = async text => {
    setConversationState('speaking');
    setStatusMessage('Aira is speaking...');

    try {
      if (ttsAvailable && Tts) {
        Tts.stop();

       
        Tts.speak(text);
      } else {
        setTimeout(() => {
          setConversationState('idle');
          setStatusMessage('Tap to continue');
        }, 2000);
      }
    } catch (error) {
      console.error('Error speaking response:', error);
      setConversationState('idle');
      setStatusMessage('Tap to continue');
    }
  };

  const stopSpeakingStartListening = () => {
    if (conversationState === 'speaking') {
      if (ttsAvailable && Tts) {
        Tts.stop();
      }
      setConversationState('idle');
      setStatusMessage('Tap to continue');
    }
  };

  const renderWaveAnimation = () => {
    return (
      <View style={styles.waveContainer}>
        {waveAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.wave,
              {
                backgroundColor:
                  conversationState === 'listening' ? '#3B82F6' : '#8B5CF6',  
                transform: [{ scaleY: anim }],
                opacity:
                  conversationState === 'listening' ||
                  conversationState === 'speaking'
                    ? 1
                    : 0.3,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E2F4E" />

      <View style={styles.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          {/* <Text style={styles.closeButtonText}>×</Text> */}
          <Ionicons name="close" size={26} color="#E0E0E0" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Input</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.visualizationContainer}>
          {renderWaveAnimation()}
        </View>

        <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
          >
            {transcript ? (
              <>
                <Text style={styles.transcriptLabel}>You said:</Text>
                <Text style={styles.transcriptText}>{transcript}</Text>
              </>
            ) : null}

            {aiResponse && conversationState === 'speaking' ? (
              <>
                <Text style={styles.responseLabel}>AI response:</Text>
                <Text style={styles.responseText}>{aiResponse}</Text>
              </>
            ) : null}
          </ScrollView>
        </Animated.View>

        <Text style={styles.statusText}>{statusMessage}</Text>

        <View style={styles.controlsContainer}>
          {conversationState === 'idle' && (
            <TouchableOpacity style={styles.micButton} onPress={startListening}>
              {/* <Text style={styles.micButtonText}>🎤</Text> */}
              <MaterialCommunityIcons
                name="microphone"
                size={36}
                color="#E0E0E0"
              />
            </TouchableOpacity>
          )}

          {conversationState === 'listening' && (
            <TouchableOpacity onPress={stopListening}>
              <Animated.View
                style={[
                  styles.micButton,
                  styles.listeningButton,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                {/* <Text style={styles.micButtonText}>🎤</Text> */}
                <MaterialCommunityIcons
                  name="microphone-outline"
                  size={36}
                  color="#E0E0E0"
                />
              </Animated.View>
            </TouchableOpacity>
          )}

          {conversationState === 'processing' && (
            <View style={[styles.micButton, styles.processingButton]}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {conversationState === 'speaking' && (
            <TouchableOpacity
              style={[styles.micButton, styles.speakingButton]}
              onPress={stopSpeakingStartListening}
            >
              {/* <Text style={styles.micButtonText}>⏹️</Text> */}
              <MaterialIcons name="stop" size={36} color="#E0E0E0" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212', 
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
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
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 30,
    color: '#E0E0E0',
    lineHeight: 30,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E0E0E0', 
    textAlign: 'center',
  },
  placeholder: {
    width: 30,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  visualizationContainer: {
    height: 160,
    width: '100%',
    marginTop: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: '80%',
  },
  wave: {
    width: 8,
    height: 50,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: 'white', 
  },
  messageContainer: {
    width: '90%',
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#1E293B', 
    borderRadius: 15,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingRight: 10,
  },
  transcriptLabel: {
    color: '#3B82F6', 
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  transcriptText: {
    color: '#E0E0E0', 
    fontSize: 16,
    marginBottom: 15,
  },
  responseLabel: {
    color: '#8B5CF6', 
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  responseText: {
    color: '#E0E0E0', 
    fontSize: 16,
  },
  statusText: {
    color: '#94A3B8', 
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  controlsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  micButton: {
    width: 100,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0F172A', 
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#3B82F6', 
  },
  listeningButton: {
    backgroundColor: '#1E293B', 
    borderColor: '#3B82F6', 
    borderWidth: 2,
  },
  processingButton: {
    backgroundColor: '#1E293B', 
    borderColor: '#8B5CF6', 
    borderWidth: 2,
  },
  speakingButton: {
    backgroundColor: '#1E293B', 
    borderColor: '#8B5CF6', 
    borderWidth: 2,
  },
  micButtonText: {
    fontSize: 32,
    color: '#E0E0E0', 
  },
});

export default VoiceScreen;
