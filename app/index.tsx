import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useColors } from '@/hooks/use-theme-color';

export default function Index() {
  const Colors = useColors();
  const [destino, setDestino] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      AsyncStorage.getItem('onboarding_done').then(val => {
        setDestino(val === 'true' ? '/(tabs)' : '/onboarding');
      });
    }, 500);
  }, []);

  if (!destino) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.primary} />
    </View>
  );

  return <Redirect href={destino as any} />;
}
