import { PlaceholderScreen } from '@/components/placeholder-screen';

/**
 * Add / Scan screen.
 *
 * The entry point for putting a new grocery item into the inventory, either by
 * scanning its barcode and letting the product details fill in automatically,
 * or by typing the item in by hand.
 */
export default function AddItemScreen() {
  return (
    <PlaceholderScreen
      title="Add / Scan"
      status="Coming soon"
      description="Scan a barcode to fill in the product automatically, or enter an item by hand."
    />
  );
}
