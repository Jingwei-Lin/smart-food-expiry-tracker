export type FoodItemStatus = 'active' | 'eaten' | 'discarded';

export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string;
  notes: string;
  createdAt: string;
  status: FoodItemStatus;
  statusUpdatedAt?: string;
};

export type NewFoodItem = Pick<FoodItem, 'name' | 'quantity' | 'expiryDate' | 'notes'>;