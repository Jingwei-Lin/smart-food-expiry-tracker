import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExpiryBadge } from '@/components/expiry-badge';
import { useInventory } from '@/context/inventory-context';
import { formatExpiryDate } from '@/utils/expiry-date';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, isLoading } = useInventory();

  const item = items.find((candidate) => candidate.id === id);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2f7d32" />
        <Text style={styles.loadingText}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Item not found',
          }}
        />

        <View style={styles.notFoundContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#687269" />

          <Text style={styles.notFoundTitle}>Item not found</Text>

          <Text style={styles.notFoundText}>
            This item may have been removed or is no longer available.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [
              styles.returnButton,
              pressed ? styles.pressedButton : null,
            ]}
          >
            <Text style={styles.returnButtonText}>Return to inventory</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.itemIcon}>
            <Ionicons name="nutrition-outline" size={32} color="#2f7d32" />
          </View>

          <Text style={styles.itemName}>{item.name}</Text>

          <ExpiryBadge expiryDate={item.expiryDate} />
        </View>

        <Text style={styles.sectionTitle}>ITEM DETAILS</Text>

        <View style={styles.detailsCard}>
          <DetailRow
            icon="calendar-outline"
            label="Expiry date"
            value={formatExpiryDate(item.expiryDate)}
          />

          <View style={styles.divider} />

          <DetailRow
            icon="cube-outline"
            label="Quantity"
            value={item.quantity}
          />

          {item.notes ? (
            <>
              <View style={styles.divider} />

              <DetailRow
                icon="document-text-outline"
                label="Notes"
                value={item.notes}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={22} color="#537059" />

      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f6f8f3',
  },
  loadingText: {
    color: '#59635b',
    fontSize: 15,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8f3',
    padding: 24,
  },
  notFoundTitle: {
    marginTop: 14,
    color: '#172019',
    fontSize: 22,
    fontWeight: '700',
  },
  notFoundText: {
    marginTop: 7,
    color: '#687269',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  returnButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: '#2f7d32',
    paddingHorizontal: 20,
  },
  returnButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#f6f8f3',
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
  },
  itemIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e7f4e8',
  },
  itemName: {
    marginTop: 14,
    marginBottom: 10,
    color: '#172019',
    fontSize: 25,
    fontWeight: '800',
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 9,
    color: '#687269',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  detailsCard: {
    borderWidth: 1,
    borderColor: '#dce4da',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    color: '#718075',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    marginTop: 3,
    color: '#253028',
    fontSize: 16,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: '#e4e9e3',
  },
  pressedButton: {
    opacity: 0.72,
  },
});