import { HorizontalItemCard } from './HorizontalItemCard.jsx';

/** Dashboard / profile report row — horizontal card with optional status cycling. */
export function ItemCard({ item, onStatusChange }) {
  return <HorizontalItemCard item={item} onStatusChange={onStatusChange} />;
}
