import { BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScanBarcode, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lookupProduct } from '@/utils/open-food-facts';

const COLORS = {
  background: '#FFFDF5',
  surface: '#FFFFFF',
  primary: '#1E2A16',
  secondary: '#55614D',
  border: '#E4E5D4',
  divider: '#EEEFE5',
  accent: '#A6D45A',
  accentSoft: '#F0F7DB',
  error: '#8B2C25',
};

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

type ScanStage = 'scanning' | 'looking-up';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<ScanStage>('scanning');

  const hasScanned = useRef(false);
  const insets = useSafeAreaInsets();

  function openManualEntry() {
    router.replace('/add');
  }

  async function handleBarcodeScanned(barcode: string) {
    if (hasScanned.current) {
      return;
    }

    hasScanned.current = true;
    setStage('looking-up');

    // lookupProduct never throws: a network failure comes back as 'unavailable'.
    const result = await lookupProduct(barcode);

    if (result.outcome === 'found') {
      router.replace({
        pathname: '/add',
        params: {
          barcode: result.product.barcode,
          name: result.product.name,
          quantity: result.product.quantity,
          expiryDate: result.product.expiryDate,
          shelfLifeLabel: result.product.shelfLifeLabel,
          category: result.product.category,
        },
      });
      return;
    }

    router.replace({
      pathname: '/add',
      params: { barcode, lookupOutcome: result.outcome },
    });
  }

  if (!permission) {
    return (
      <View style={styles.messageScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.messageText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.permissionScreen,
          {
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <X size={24} color={COLORS.primary} />
        </Pressable>

        <View style={styles.permissionContent}>
          <View style={styles.permissionIcon}>
            <ScanBarcode size={38} color={COLORS.primary} />
          </View>

          <Text style={styles.permissionTitle}>
            {permission.canAskAgain ? 'Ready to scan?' : 'Camera access is off'}
          </Text>

          <Text style={styles.permissionDescription}>
            {permission.canAskAgain
              ? 'Allow camera access to scan a food barcode and look up its product details.'
              : 'Turn on camera access in your device settings, or add your food manually.'}
          </Text>

          {permission.canAskAgain ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void requestPermission()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Allow camera</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={openManualEntry}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Type it in instead</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Light text over the dimmed camera; the root layout's dark style returns on close. */}
      <StatusBar style="light" />

      <CameraView
        barcodeScannerSettings={{
          barcodeTypes: BARCODE_TYPES,
        }}
        facing="back"
        onBarcodeScanned={
          stage === 'scanning' ? ({ data }) => void handleBarcodeScanned(data) : undefined
        }
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.cameraTint} />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <X size={24} color={COLORS.primary} />
        </Pressable>

        <View style={styles.heading}>
          <Text style={styles.title}>Scan the barcode</Text>
          <Text style={styles.subtitle}>Hold it inside the frame. It scans by itself.</Text>
        </View>
      </View>

      <View style={styles.scannerArea}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      <View
        style={[
          styles.bottomCard,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          },
        ]}
      >
        <View style={styles.cardHandle} />

        <View style={styles.manualRow}>
          <View style={styles.fruitIcon}>
            {stage === 'looking-up' ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <ScanBarcode size={28} color={COLORS.primary} />
            )}
          </View>

          <View style={styles.manualText}>
            <Text style={styles.manualTitle}>
              {stage === 'looking-up' ? 'Looking up your food...' : 'No barcode?'}
            </Text>
            <Text style={styles.manualSubtitle}>
              {stage === 'looking-up'
                ? 'Checking product details and food category.'
                : 'No worries! You can add your food manually.'}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={stage === 'looking-up'}
          onPress={openManualEntry}
          style={({ pressed }) => [
            styles.manualButton,
            pressed && styles.pressed,
            stage === 'looking-up' && styles.disabledButton,
          ]}
        >
          <Text style={styles.manualButtonText}>Type it in instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  messageScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
  },
  messageText: {
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  permissionIcon: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: COLORS.accentSoft,
  },
  permissionTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 27,
    textAlign: 'center',
  },
  permissionDescription: {
    maxWidth: 310,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  secondaryButton: {
    minHeight: 54,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
  },
  cameraTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 42, 22, 0.72)',
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 12,
    zIndex: 1,
  },
  closeButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  heading: {
    alignItems: 'center',
    marginTop: 38,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 29,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 310,
    marginTop: 4,
    color: '#E4E5D4',
    fontFamily: 'Fredoka_400Regular',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  scannerArea: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 28,
    paddingTop: 58,
    paddingBottom: 12,
  },
  frame: {
    width: '88%',
    maxWidth: 340,
    aspectRatio: 1.18,
  },
  corner: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderWidth: 5,
    borderColor: COLORS.accent,
    borderRadius: 10,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  bottomCard: {
    flexShrink: 0,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.border,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: COLORS.background,
    shadowColor: '#0F1A12',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 2,
  },
  cardHandle: {
    display: 'none',
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  fruitIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
  },
  manualText: {
    flex: 1,
  },
  manualTitle: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 21,
  },
  manualSubtitle: {
    marginTop: 4,
    color: COLORS.secondary,
    fontFamily: 'Fredoka_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  manualButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 18,
  },
  manualButtonText: {
    color: COLORS.primary,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
