import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useLocalSearchParams } from 'expo-router';

/**
 * Detail screen for a single grocery item, identified by the `id` in the route.
 *
 * Shows how long the item has left and the actions available for it, such as
 * marking it eaten, finding a recipe, or locating somewhere to donate it.
 * Reached from the inventory list and from an expiry notification.
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PlaceholderScreen
      title="Item detail"
      status="Coming soon"
      description={`Details, edit, delete and mark-as-consumed actions for item "${id}".`}
    />
  );
}
