import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  StatusBar, Dimensions, BackHandler, Animated, Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import AppList from 'react-native-app-list';
import * as IntentLauncher from 'expo-intent-launcher';
import * as ScreenLock from 'expo-screen-lock';

const { width, height } = Dimensions.get('window');

const SHORTCUTS = {
  '6': 'com.supercell.brawlstars',
  '7': 'roosterinfo',
  '8': 'com.whatsapp',
  '9': 'com.android.dialer',
};

const NAME_KEY = '@nexus_name';

export default function App() {
  const [name, setName] = useState('');
  const [input, setInput] = useState('');
  const [view, setView] = useState('loading');
  const [appsList, setAppsList] = useState([]);
  const [gamesList, setGamesList] = useState([]);
  const [info, setInfo] = useState({
    battery: 0, charging: false, ssid: '...', ip: '...', online: false,
  });
  const [shutdown, setShutdown] = useState(false);
  const [fallingChars, setFallingChars] = useState([]);

  const barAnim = useRef(new Animated.Value(0)).current;
  const barCount = 5;
  const barWidths = Array.from({length: barCount}, (_, i) => width * 0.4 + i * 40);

  useEffect(() => {
    (async () => {
      Animated.timing(barAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(async () => {
        const stored = await AsyncStorage.getItem(NAME_KEY);
        if (stored) {
          setName(stored);
          setView('main');
        } else {
          setView('nameInput');
        }
      });
    })();
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      const bat = await Battery.getBatteryLevelAsync();
      const batState = await Battery.getBatteryStateAsync();
      const net = await NetInfo.fetch();
      setInfo({
        battery: Math.round(bat * 100),
        charging: batState === Battery.BatteryState.CHARGING,
        ssid: net.details?.ssid || '(none)',
        ip: net.details?.ipAddress || '...',
        online: net.isConnected,
      });
    };
    const interval = setInterval(fetchInfo, 3000);
    fetchInfo();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    AppList.getApps().then((all) => {
      const userApps = all.filter(a => !a.isSystem && a.type === 'app');
      setAppsList(userApps);
      setGamesList(userApps.filter(a => a.category === 'Game'));
    });
  }, []);

  const saveName = async () => {
    if (input.trim()) {
      const n = input.trim();
      await AsyncStorage.setItem(NAME_KEY, n);
      setName(n);
      setInput('');
      setView('main');
    }
  };

  const handleCommand = useCallback(async (cmd) => {
    setInput('');
    if (cmd === '1') setView('games');
    else if (cmd === '2') setView('apps');
    else if (cmd === '3') {
      IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS);
    } else if (cmd === '0') setView('power');
    else if (SHORTCUTS[cmd]) {
      try {
        IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
          packageName: SHORTCUTS[cmd],
        });
      } catch (e) { alert(`Could not open ${SHORTCUTS[cmd]}`); }
    } else if (cmd.startsWith('open ')) {
      const target = cmd.slice(5).trim().toLowerCase();
      const app = appsList.find(a => a.name.toLowerCase().includes(target) || a.packageName === target);
      if (app) {
        try {
          IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            packageName: app.packageName,
          });
        } catch (e) { alert('Failed to open'); }
      } else alert('App not found');
    }
  }, [appsList]);

  const startShutdown = () => {
    setShutdown(true);
    const chars = [];
    for (let i = 0; i < 60; i++) {
      chars.push({
        key: i,
        x: Math.random() * width,
        y: Math.random() * -200,
        speed: 2 + Math.random() * 4,
        char: Math.random() > 0.5 ? '0' : '1',
      });
    }
    setFallingChars(chars);

    const interval = setInterval(() => {
      setFallingChars(prev => prev.map(c => ({
        ...c,
        y: c.y + c.speed,
        x: c.y > height ? Math.random() * width : c.x,
        y: c.y > height ? Math.random() * -50 : c.y,
        char: c.y > height ? (Math.random() > 0.5 ? '0' : '1') : c.char,
        speed: c.y > height ? 2 + Math.random() * 4 : c.speed,
      })));
    }, 40);

    setTimeout(async () => {
      clearInterval(interval);
      setFallingChars([]);
      setShutdown(false);
      try {
        await ScreenLock.lockAsync();
      } catch (e) {
        BackHandler.exitApp();
      }
    }, 4000);
  };

  if (view === 'loading') {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.center}>
          {Array.from({length: barCount}).map((_, i) => {
            const w = barWidths[i];
            const animatedWidth = barAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, w],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View key={i} style={[styles.bootBar, {
                width: animatedWidth,
                height: 20,
                marginVertical: 4,
              }]} />
            );
          })}
        </View>
      </View>
    );
  }

  if (view === 'nameInput') {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#000" barStyle="light-content" />
        <View style={styles.center}>
          <Text style={styles.ascii}>NEXUS OS</Text>
          <Text style={styles.prompt}>Enter your name:</Text>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={saveName}
            placeholder="Silas"
            placeholderTextColor="#aaa"
            autoFocus
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <View style={styles.topBar}>
        <Text style={styles.text}>
          BAT {info.battery}% {info.charging ? '⚡' : '🔋'} | {info.ssid} | {info.ip} | {info.online ? 'ONLINE' : 'OFFLINE'}
        </Text>
      </View>

      {view === 'main' && (
        <View style={styles.center}>
          <Text style={styles.ascii}>NEXUS OS</Text>
          <Text style={styles.prompt}>Welcome, {name}.</Text>
          <Text style={styles.prompt}>[1] Games  [2] Apps  [3] Settings  [0] Power</Text>
          <Text style={styles.prompt}>Shortcuts: 6 Brawl  7 Rooster  8 WhatsApp  9 Phone</Text>
        </View>
      )}

      {view === 'games' && (
        <ScrollView style={styles.list}>
          {gamesList.map((item, idx) => (
            <Text key={item.packageName} style={styles.listItem}
              onPress={() => {
                IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
                  packageName: item.packageName,
                });
              }}
            >
              [{idx + 1}] {item.name}
            </Text>
          ))}
          <Text style={styles.listItem} onPress={() => setView('main')}>[0] Back</Text>
        </ScrollView>
      )}

      {view === 'apps' && (
        <ScrollView style={styles.list}>
          {appsList.map((item, idx) => (
            <Text key={item.packageName} style={styles.listItem}
              onPress={() => {
                IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
                  packageName: item.packageName,
                });
              }}
            >
              [{idx + 1}] {item.name}
            </Text>
          ))}
          <Text style={styles.listItem} onPress={() => setView('main')}>[0] Back</Text>
        </ScrollView>
      )}

      {view === 'power' && (
        <View style={styles.center}>
          <Text style={styles.prompt}>[1] Lock screen</Text>
          <Text style={styles.prompt} onPress={() => ScreenLock.lockAsync()}>[2] Sleep</Text>
          <Text style={styles.prompt} onPress={startShutdown}>[3] Shutdown</Text>
          <Text style={styles.prompt} onPress={() => setView('main')}>[0] Back</Text>
        </View>
      )}

      {shutdown && (
        <View style={StyleSheet.absoluteFill}>
          {fallingChars.map(c => (
            <Text key={c.key} style={{
              position: 'absolute',
              left: c.x,
              top: c.y,
              color: '#FF0000',
              fontFamily: 'monospace',
              fontSize: 20,
              opacity: 0.8,
            }}>
              {c.char}
            </Text>
          ))}
          <View style={styles.goodbyeWrap}>
            <Text style={styles.goodbyeText}>Goodbye {name}</Text>
          </View>
        </View>
      )}

      {!shutdown && (
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleCommand(input.trim())}
            placeholder="nexus@home:~$"
            placeholderTextColor="#aaa"
            autoFocus
            returnKeyType="go"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 30 },
  topBar: { paddingHorizontal: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#fff' },
  text: { color: '#fff', fontFamily: 'monospace', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ascii: { color: '#0f0', fontFamily: 'monospace', fontSize: 24, marginBottom: 20 },
  prompt: { color: '#0f0', fontFamily: 'monospace', fontSize: 16, marginVertical: 4 },
  list: { flex: 1, paddingHorizontal: 10 },
  listItem: { color: '#fff', fontFamily: 'monospace', fontSize: 14, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#333' },
  inputWrap: { borderTopWidth: 1, borderTopColor: '#fff', paddingHorizontal: 10, paddingVertical: 5 },
  input: { color: '#0f0', fontFamily: 'monospace', fontSize: 16, paddingVertical: 10 },
  goodbyeWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  goodbyeText: { color: '#FF00FF', fontFamily: 'monospace', fontSize: 32, fontWeight: 'bold', textShadowColor: '#FF00FF', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 8 },
  bootBar: { backgroundColor: '#0f0', borderWidth: 1, borderColor: '#fff' },
});