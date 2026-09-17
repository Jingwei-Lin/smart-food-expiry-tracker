import { Ionicons } from '@expo/vector-icons';
import { BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { lookupProduct } from '@/utils/open-food-facts';

/*
 * The retail barcodes a student will actually point this at. Narrowing the list
 * keeps the scanner from locking on to a QR code on the same packet.
 */
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

type ScanStage = 'scanning' | 'looking-up';

/**
 * Barcode scanner, and the first thing the add button opens.
 *
 * Scanning is the point of the app, so it leads — but it is never the only way
 * through: typing the item in by hand is one tap away on every state of this
 * screen, including when the camera is refused or the lookup cannot run.
 */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<ScanStage>('scanning');

  /* A camera fires this repeatedly while the barcode stays in frame. */
  const hasScanned = useRef(false);

  function openManualEntry() {
    router.replace('/add');
  }

  async function handleBarcodeScanned(barcode: string) {
    if (hasScanned.current) {
      return;
    }

    hasScanned.current = true;
    setStage('looking-up');

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
        <ActivityIndicator size="large" color="#2f7d32" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.messageScreen}>
        <Ionicons color="#687269" name="camera-outline" size={48} />

        <Text style={styles.messageTitle}>
          {permission.canAskAgain ? 'Scan a barcode' : 'Camera access is off'}
        </Text>

        <Text style={styles.messageText}>
          {permission.canAskAgain
            ? 'The camera reads the barcode so the product details fill themselves in.'
            : 'Turn the camera on for this app in your device settings, or add the item by hand.'}
        </Text>

        {permission.canAskAgain ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void requestPermission()}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryButtonText}>Allow camera</Text>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={openManualEntry}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.secondaryButtonText}>Type it in instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        facing="back"
        onBarcodeScanned={({ data }) => void handleBarcodeScanned(data)}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />

        <View style={styles.instructions}>
          {stage === 'looking-up' ? (
            <>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.instructionsText}>Looking this product up...</Text>
            </>
          ) : (
            <Text style={styles.instructionsText}>
              Point the camera at the barcode on the packet.
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={stage === 'looking-up'}
          onPress={openManualEntry}
          style={({ pressed }) => [styles.manualButton, pressed ? styles.pressed : null]}
        >
          <Ionicons color="#ffffff" name="create-outline" size={18} />
          <Text style={styles.manualButtonText}>Type it in instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f1a12',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    padding: 24,
  },
  frame: {
    width: '78%',
    aspectRatio: 1.6,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 18,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 26, 18, 0.72)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  instructionsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  manualButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  manualButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  messageScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f8f3',
    padding: 28,
  },
  messageTitle: {
    marginTop: 4,
    color: '#172019',
    fontSize: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageText: {
    color: '#687269',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2f7d32',
    borderRadius: 12,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#2f7d32',
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
