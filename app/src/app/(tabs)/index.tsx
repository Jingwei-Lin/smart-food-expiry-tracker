import { PlaceholderScreen } from '@/components/placeholder-screen';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

/**
 * Inventory screen, and the app's landing tab.
 *
 * Lists the groceries currently being tracked, soonest to expire first, and
 * links through to a single item's detail screen.
 */
export default function InventoryScreen() {
  return (
    <PlaceholderScreen
      title="Inventory"
      status="Coming soon"
      description="Tracked groceries will appear here, sorted so the soonest to expire is always first."
    >
      {/* Stands in for a real row so the navigation into item detail is usable. */}
      <Link href="/item/sample" style={styles.link}>
        Open a sample item
      </Link>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 12,
    fontSize: 15,
    color: '#2f7d32',
    textDecorationLine: 'underline',
  },
});
