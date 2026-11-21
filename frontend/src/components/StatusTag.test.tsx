import { render, screen } from '@testing-library/react';
import { MovementQuantity, OrderStatusTag, StockStatusTag } from './StatusTag';

describe('status tags', () => {
  it('labels order statuses in Turkish', () => {
    render(<OrderStatusTag status="pending" />);

    expect(screen.getByText('Onay Bekliyor')).toBeInTheDocument();
  });

  it('marks products below the minimum stock as critical', () => {
    render(<StockStatusTag stock={3} minStock={10} />);

    expect(screen.getByText('Kritik')).toBeInTheDocument();
  });

  it('prefixes outgoing movements with a minus sign', () => {
    render(<MovementQuantity type="order_out" quantity={2} />);

    expect(screen.getByText('−2')).toBeInTheDocument();
  });
});
