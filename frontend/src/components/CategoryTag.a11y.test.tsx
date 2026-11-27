import { render, screen } from '@testing-library/react';
import { contrastRatio, parseHex, tintOnWhite } from '@/utils/contrast';
import { CATEGORY_BACKGROUND_ALPHA as BACKGROUND_ALPHA, categoryTagColors } from '@/utils/categoryColors';
import { CategoryTag } from './CategoryTag';

describe('CategoryTag contrast', () => {
  it.each(['#10B981', '#D97706', '#EC4899', '#FDE047', '#4F46E5', '#4B5563'])(
    'keeps %s text readable on its own tint',
    (color) => {
      const { color: text } = categoryTagColors(color);
      const background = tintOnWhite(color, BACKGROUND_ALPHA);

      expect(contrastRatio(parseHex(text)!, parseHex(background)!)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('leaves dark category colours as they are', () => {
    expect(categoryTagColors('#4338CA').color).toBe('#4338CA');
  });

  it('renders the darkened text colour with the original tint', () => {
    render(<CategoryTag category={{ name: 'Bahçe', color: '#10B981' }} />);

    const tag = screen.getByText('Bahçe');
    expect(tag).not.toHaveStyle({ color: '#10B981' });
    expect(tag.getAttribute('style')).toContain('rgba(16, 185, 129');
  });
});
